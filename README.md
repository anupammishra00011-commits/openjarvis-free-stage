# Render Free Staging Preflight — not native agent

A small, deliberately bounded service on Render Free to verify deployment health, secure read-only MCP discovery and pgvector on the existing same-region free PostgreSQL. **This is not the real native OpenJarvis OrchestratorAgent.** The actual native OpenJarvis container remains separately staged in apps/openjarvis-native and needs more RAM/real deployment testing.

## Endpoints

- GET /health — public readiness only; no secrets or data
- GET /admin/status — Bearer STAGE_GATEWAY_KEY; live database/pgvector availability
- POST /admin/vector-smoke — Bearer STAGE_GATEWAY_KEY; installs vector extension if permitted, runs synthetic 3-dimension vector inserts and nearest-neighbor SELECT in temporary transaction then ROLLBACK; no persistent documents
- POST /mcp — Bearer STAGE_GATEWAY_KEY; official stateless Streamable HTTP MCP server with two read-only tools: stage_status, pgvector_status

Environment (secret Render environment values, not Git): STAGE_GATEWAY_KEY (32+ chars), DATABASE_URL (Render database **internal** URL). Running without DATABASE_URL preserves free staging and shows database not configured. No OpenRouter model key is required. Avoid storing any user data or secrets in the test database.

## Safety
No paid compute, no agent shell, no remote write operations, no public DB allowlist, no model inference. Free Render web service spins down when inactive. This service does not replace Vercel Production or prove semantic RAG. Deployment and live smoke tests must be verified independently.
