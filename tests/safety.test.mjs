import test from "node:test";
import assert from "node:assert/strict";
import {authorize,safeStatus,vectorSmokeStatements} from "../core.mjs";
test("authenticated read tools reject missing or wrong keys",()=>{
 const secret="a".repeat(44);
 assert.equal(authorize("Bearer "+secret,secret),true);
 for(const s of [undefined,"","Bearer wrong","Basic "+secret])assert.equal(authorize(s,secret),false);
 assert.equal(authorize("Bearer short","short"),false);
});
test("staging never advertises an actual native worker",()=>{
 const s=safeStatus(true);
 assert.equal(s.nativeOpenJarvis,"not-deployed");
 assert.equal(s.semanticEmbeddings,"not-deployed");
 assert.equal(s.mcp,"read-only");
});
test("vector probe uses fixed synthetic vectors and a temporary table",()=>{
 const stmts=vectorSmokeStatements();
 assert.ok(stmts.some(x=>x.includes("TEMP TABLE")));
 assert.ok(stmts.some(x=>x.includes("ORDER BY distance")));
 assert.equal(stmts.at(-1),"ROLLBACK");
 assert.equal(stmts.some(x=>/DROP DATABASE|DELETE FROM/i.test(x)),false);
});
