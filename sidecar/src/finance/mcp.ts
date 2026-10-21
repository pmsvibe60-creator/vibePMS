import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { toolDefinitions } from './contracts.ts';

const raw = process.env.VIBEPMS_URL;
const token = process.env.VIBEPMS_ADMIN_TOKEN;
if (!raw || !token) throw new Error('Set VIBEPMS_URL and VIBEPMS_ADMIN_TOKEN in your MCP client environment. Never put credentials in prompts.');
const base = new URL(raw);
if (base.username || base.password || base.search || base.hash || !['http:','https:'].includes(base.protocol)) throw new Error('Use a plain sidecar HTTP(S) base URL without credentials, query or fragment.');
if (base.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(base.hostname)) throw new Error('Remote finance connections require HTTPS.');

export function createFinanceMcp() {
  const server = new McpServer({ name:'vibepms-finance', version:'0.1.0' });
  for (const tool of toolDefinitions) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.schema,
      annotations: { readOnlyHint:tool.readOnly, destructiveHint:!tool.readOnly, idempotentHint:false, openWorldHint:false },
    }, async (input:unknown) => {
      try {
        const url = new URL(`${base.pathname.replace(/\/$/,'')}/admin/finance/${tool.name}`,base.origin);
        const response = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(45_000)});
        if(response.status===401) return {isError:true,content:[{type:'text' as const,text:'Authentication failed. Check the finance connection credentials in your client settings.'}]};
        const body=await response.json();
        return {isError:!response.ok,content:[{type:'text' as const,text:JSON.stringify(body)}]};
      } catch {
        return {isError:true,content:[{type:'text' as const,text:'Finance request failed or timed out. Check the connection, then review current state before retrying; the operation may already have committed.'}]};
      }
    });
  }
  return server;
}
void serveStdio(createFinanceMcp);
