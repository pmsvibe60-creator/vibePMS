import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
const mocked=vi.hoisted(()=>({records:[] as any[],failProjection:false,updates:[] as any[]}));
vi.mock('../src/twenty/client.ts',()=>({twenty:{list:async()=>mocked.records,get:async(_p:string,id:string)=>mocked.records.find(r=>r.id===id),update:async(_p:string,id:string,body:any)=>{if(mocked.failProjection)throw Error('offline');mocked.updates.push({id,body});return {id,...body};}}}));
import { runFinanceTool } from '../src/finance/service.ts';
import { migrate, pool } from '../src/db.ts';
const enabled=process.env.FINANCE_TEST_DATABASE_URL===process.env.DATABASE_URL && !!process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname==='/vibepms_finance_test';
const mapping={date:'Date',description:'Reference',amount:'Amount',bankId:'ID',dateFormat:'YMD',decimal:'.',delimiter:','};
const source={account:'test-account',currency:'GBP',mapping,csv:'Date,Reference,Amount,ID\n2027-09-01,RENT-001,1450.00,b1'};
const record=()=>({id:'invoice-1',invoiceNo:'RENT-001',referenceNumber:'RENT-001',unitId:'unit-1',invoiceType:'RENT',invoiceStatus:'SENT',amount:{amountMicros:1450_000_000,currencyCode:'GBP'},paidAmount:{amountMicros:0,currencyCode:'GBP'}});
async function ready(){
 const staged:any=await runFinanceTool('stage_statement_import',source);
 await runFinanceTool('approve_statement_import',{statementId:staged.result.statementId,approved:true,expectedRevision:staged.revision});
 await runFinanceTool('refresh_finance_invoices',{});
 const review:any=await runFinanceTool('review_payment_matches',{});
 return {id:randomUUID(),transactionId:review.result.transactions[0].id,invoiceId:'invoice-1',amount:145000,reason:'Operator reviewed exact reference',approved:true,expectedRevision:review.revision};
}
describe.skipIf(!enabled)('persistent finance ledger + MCP',()=>{
 beforeAll(async()=>{await migrate();});
 beforeEach(async()=>{await pool.query('DELETE FROM finance_workspace');mocked.records=[record()];mocked.failProjection=false;mocked.updates=[];});
 afterAll(async()=>{await pool.end();});
 it('serializes simultaneous approvals, rolls back invalid requests, persists corrections',async()=>{
  const input=await ready();
  const results=await Promise.allSettled([runFinanceTool('approve_payment_allocation',input),runFinanceTool('approve_payment_allocation',{...input,id:randomUUID()})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  const read:any=await runFinanceTool('review_payment_matches',{});expect(read.result.allocations).toHaveLength(1);expect(read.result.invoices[0].outstanding).toBe(0);
  await expect(runFinanceTool('approve_payment_allocation',{...input,id:randomUUID(),amount:1,expectedRevision:read.revision})).rejects.toThrow('exceeds');
  const after:any=await runFinanceTool('review_payment_matches',{});expect(after.revision).toBe(read.revision);
  await runFinanceTool('reverse_payment_allocation',{allocationId:after.result.allocations[0].id,reason:'Wrong allocation',approved:true,expectedRevision:after.revision});
  const stored=await pool.query('SELECT state FROM finance_workspace WHERE id=1');expect(stored.rows[0].state.allocations[0].reversalReason).toBe('Wrong allocation');
 });
 it('rejects a changed invoice and retries dedicated-field projections safely',async()=>{
  const input=await ready();mocked.records[0].amount.amountMicros=1500_000_000;
  await expect(runFinanceTool('approve_payment_allocation',input)).rejects.toThrow('changed');mocked.records=[record()];
  await runFinanceTool('approve_payment_allocation',input);mocked.failProjection=true;
  const failed:any=await runFinanceTool('sync_finance_to_twenty',{});expect(failed.result.pending).toEqual(['invoice-1']);
  mocked.failProjection=false;const synced:any=await runFinanceTool('sync_finance_to_twenty',{});expect(synced.result.pending).toEqual([]);
  expect(mocked.updates[0].body.bankMatchedAmount.amountMicros).toBe(1450_000_000);expect(mocked.updates[0].body).not.toHaveProperty('paidAmount');expect(mocked.updates[0].body).not.toHaveProperty('invoiceStatus');
 });
 it('serves real MCP initialization, discovery, import preview, stage and approval',async()=>{
  const server=createServer(async(req,res)=>{
   if(req.headers.authorization!=='Bearer fixture-secret'){res.writeHead(401);res.end('{}');return;}
   let raw='';for await(const part of req)raw+=part;
   try{const result=await runFinanceTool(req.url!.split('/').at(-1)!,JSON.parse(raw));res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}
   catch(e){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:(e as Error).message}));}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  const child:ChildProcessWithoutNullStreams=spawn(process.execPath,['--import','tsx','src/finance/mcp.ts'],{cwd:process.cwd(),env:{...process.env,VIBEPMS_URL:`http://127.0.0.1:${address.port}`,VIBEPMS_ADMIN_TOKEN:'fixture-secret'},stdio:['pipe','pipe','pipe']});
  let pending='';let id=0;const waiters=new Map<number,{resolve:(x:any)=>void,reject:(e:Error)=>void,timer:ReturnType<typeof setTimeout>}>();
  child.stdout.on('data',chunk=>{pending+=chunk;let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(!line.trim())continue;const msg=JSON.parse(line);const w=waiters.get(msg.id);if(w){clearTimeout(w.timer);waiters.delete(msg.id);w.resolve(msg);}}});
  child.stderr.on('data',()=>{});
  const rpc=(method:string,params:any)=>new Promise<any>((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>{waiters.delete(key);reject(Error('MCP timeout'));},10000);waiters.set(key,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n');});
  try{
   const init=await rpc('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'finance-test',version:'1'}});expect(init.result.serverInfo.name).toBe('vibepms-finance');
   child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
   const list=await rpc('tools/list',{});expect(list.result.tools.map((t:any)=>t.name)).toContain('approve_payment_allocation');expect(list.result.tools.map((t:any)=>t.name)).toContain('create_inspection');
   const call=async(name:string,args:any)=>{const r=await rpc('tools/call',{name,arguments:args});expect(r.error).toBeUndefined();expect(r.result.isError).not.toBe(true);return JSON.parse(r.result.content[0].text);};
   const preview=await call('preview_statement_import',source);expect(preview.result.incoming).toBe(145000);
   const staged=await call('stage_statement_import',source);const imported=await call('approve_statement_import',{statementId:staged.result.statementId,approved:true,expectedRevision:staged.revision});expect(imported.result.imported).toBe(1);
   await call('refresh_finance_invoices',{});const review=await call('review_payment_matches',{});
   await call('approve_payment_allocation',{id:randomUUID(),transactionId:review.result.transactions[0].id,invoiceId:'invoice-1',amount:145000,reason:'Reviewed reference',approved:true,expectedRevision:review.revision});
   const summary=await call('financial_overview',{currency:'GBP',from:'2027-09-01',to:'2027-09-30'});expect(summary.result.matchedRent).toBe(145000);
  }finally{for(const w of waiters.values())clearTimeout(w.timer);child.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
 },20000);
});
