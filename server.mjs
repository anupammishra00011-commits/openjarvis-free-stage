import http from "node:http";
import {McpServer} from "@modelcontextprotocol/server";
import {NodeStreamableHTTPServerTransport} from "@modelcontextprotocol/node";
import pg from "pg";
import {authorize,safeStatus,vectorSmokeStatements} from "./core.mjs";
const {Pool}=pg;
const port=Number(process.env.PORT||10000);
const maxBody=8192;
const secret=process.env.STAGE_GATEWAY_KEY||"";
const dbUrl=process.env.DATABASE_URL||"";
const pool=dbUrl?new Pool({connectionString:dbUrl,max:1,idleTimeoutMillis:5000,connectionTimeoutMillis:6000,statement_timeout:8000}):null;
function send(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(body))}
async function bodyJson(req){
 let parts=[],size=0;
 for await(const part of req){size+=part.length;if(size>maxBody)throw Error("Payload too large");parts.push(part)}
 try{return JSON.parse(Buffer.concat(parts).toString("utf8"))}catch{throw Error("Invalid JSON")}
}
async function dbStatus(){
 if(!pool)return {configured:false,reachable:false,vectorAvailable:false,vectorInstalled:false};
 const client=await pool.connect();
 try{
  const r=await client.query("SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='vector') AS available, EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS installed");
  return {configured:true,reachable:true,vectorAvailable:Boolean(r.rows[0].available),vectorInstalled:Boolean(r.rows[0].installed)};
 }finally{client.release()}
}
async function smoke(){
 if(!pool)throw Error("DATABASE_URL missing");
 const client=await pool.connect();
 try{
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");
  const statements=vectorSmokeStatements();let result=null,started=false;
  try{
   for(const statement of statements){if(statement==="BEGIN")started=true;const v=await client.query(statement);if(statement.startsWith("SELECT label"))result=v.rows?.[0]}
  }catch(e){if(started){try{await client.query("ROLLBACK")}catch{}}throw e}
  return {vectorExtensionInstalled:true,syntheticIndexAndSearchPassed:result?.label==="alpha"&&Number(result.distance)<0.0001,sampleTopMatch:result?.label||null,semanticEmbeddingModel:"not-tested"};
 }finally{client.release()}
}
async function makeMcp(){
 const server=new McpServer({name:"openjarvis-stage-readonly",version:"0.1.0"});
 server.registerTool("stage_status",{title:"Read staging status",description:"Read-only status of staging gateway, no user data or credentials.",inputSchema:{}},async()=>({content:[{type:"text",text:JSON.stringify(safeStatus(Boolean(dbUrl)))}]}));
 server.registerTool("pgvector_status",{title:"Read pgvector availability",description:"Inspect available/installed PostgreSQL vector extension without database modification.",inputSchema:{}},async()=>{
  let status;try{status=await dbStatus()}catch{status={configured:Boolean(dbUrl),reachable:false,error:"Database not available"}}
  return {content:[{type:"text",text:JSON.stringify(status)}]};
 });
 return server;
}
const httpServer=http.createServer(async(req,res)=>{
 try{
  const path=(req.url||"").split("?")[0];
  if(path==="/health"&&req.method==="GET")return send(res,200,{ok:true,...safeStatus(Boolean(dbUrl))});
  if(!authorize(req.headers.authorization,secret))return send(res,secret.length<32?503:401,{error:secret.length<32?"Staging key not configured":"Unauthorized"});
  if(path==="/admin/status"&&req.method==="GET"){
   try{return send(res,200,{ok:true,db:await dbStatus()})}catch{return send(res,503,{ok:false,error:"Database unreachable"})}
  }
  if(path==="/admin/vector-smoke"&&req.method==="POST"){
   try{return send(res,200,{ok:true,...await smoke()})}catch{return send(res,503,{ok:false,error:"Vector smoke failed; check database connectivity and extension privileges"})}
  }
  if(path==="/mcp"&&req.method==="POST"){
   const input=await bodyJson(req);
   const mcp=await makeMcp();
   const transport=new NodeStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
   try{await mcp.connect(transport);await transport.handleRequest(req,res,input)}finally{try{await mcp.close()}catch{}}
   return;
  }
  return send(res,404,{error:"Not found"});
 }catch{return send(res,400,{error:"Invalid request"})}
});
httpServer.listen(port,"0.0.0.0",()=>console.log("OpenJarvis staging preflight listening on "+port));
process.on("SIGTERM",()=>{httpServer.close();pool?.end()});
