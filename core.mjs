import {timingSafeEqual} from "node:crypto";

export function authorize(value,secret) {
 if(typeof secret!=="string"||secret.length<32||typeof value!=="string")return false;
 const expected=Buffer.from("Bearer "+secret);
 const got=Buffer.from(value);
 return expected.length===got.length&&timingSafeEqual(expected,got);
}
export function safeStatus(config) {
 return {service:"openjarvis-render-preflight",stage:"non-production",mcp:"read-only",database:config?"configured":"not-configured",nativeOpenJarvis:"not-deployed",semanticEmbeddings:"not-deployed"};
}
export function vectorSmokeStatements() {
 return [
  "BEGIN",
  "CREATE TEMP TABLE oj_stage_vector_probe (label TEXT NOT NULL, embedding vector(3) NOT NULL) ON COMMIT DROP",
  "INSERT INTO oj_stage_vector_probe(label,embedding) VALUES ('alpha','[1,0,0]'),('beta','[0,1,0]'),('gamma','[0,0,1]')",
  "SELECT label, embedding <=> '[1,0,0]'::vector AS distance FROM oj_stage_vector_probe ORDER BY distance LIMIT 1",
  "ROLLBACK"
 ];
}
