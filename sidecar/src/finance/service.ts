import { createHash, randomUUID } from 'node:crypto';
import { twenty, type TwentyRecord } from '../twenty/client.ts';
import { currency as currencyField } from '../lib/money.ts';
import { toolDefinitions } from './contracts.ts';
import { withFinanceState } from './store.ts';
import { allocatedTo, approveAllocation, approveImport, audit, importPreview, markCostBilled, minor, outstanding, overview, parseStatement, recordCost, reverseAllocation, statementDate, suggestions, type FinanceState, type Invoice, type Statement } from './engine.ts';

export function invoiceSnapshot(r:TwentyRecord):Invoice {
  function cents(value:any){
    const micros=Number(value?.amountMicros??0);
    if(!Number.isSafeInteger(micros)||micros%10_000!==0||!minor(micros/10_000))throw new Error(`Invoice ${r.id}: unsupported or invalid currency amount`);
    return micros/10_000;
  }
  const currency=r.amount?.currencyCode;
  if(!['GBP','EUR','USD','CAD','AUD','NZD'].includes(currency))throw new Error(`Invoice ${r.id}: unsupported or missing currency`);
  if(r.paidAmount?.currencyCode && r.paidAmount.currencyCode!==currency)throw new Error(`Invoice ${r.id}: payment currency mismatch`);
  return {id:r.id,number:r.invoiceNo||r.name||r.id,tenant:r.lease?.tenant?.name ? [r.lease.tenant.name.firstName,r.lease.tenant.name.lastName].filter(Boolean).join(' '):'',unit:r.unitId||r.unit?.id||r.lease?.unitId||'',currency,amount:cents(r.amount),externalPaid:cents(r.paidAmount),reference:r.referenceNumber||'',dueDate:r.dueDate?.slice(0,10)||'',type:r.invoiceType||'',blocked:!!(r.casapayInvoiceId||r.casapaySessionId||!['RENT','UTILITY','OTHER'].includes(r.invoiceType)),active:['SENT','PARTIAL','OVERDUE','PAID'].includes(r.invoiceStatus)};
}
function assertCurrent(previous:Invoice,current:Invoice){
  for(const field of ['amount','externalPaid','currency','active','blocked','unit','type'] as const)
    if(previous[field]!==current[field])throw new Error('Invoice changed in Twenty. Refresh finance invoices and review again before approving.');
}
const actor='workspace-admin-token';
export async function runFinanceTool(name:string,input:unknown){
  const definition=toolDefinitions.find(t=>t.name===name);
  if(!definition)throw new Error('Unknown finance tool');
  const data:any=definition.schema.parse(input);
  return withFinanceState(async s=>{
    if('expectedRevision' in data && data.expectedRevision!==s.revision)throw new Error('Finance state changed. Review again and use its current revision.');
    switch(name){
      case 'preview_statement_import':case 'stage_statement_import':{
        const rows=parseStatement(data.csv,data.mapping);
        const hash=createHash('sha256').update(JSON.stringify([data.csv,data.mapping,data.account,data.currency])).digest('hex');
        const existing=s.statements.find(x=>x.sourceHash===hash);
        const statement:Statement=existing??{id:randomUUID(),sourceHash:hash,account:data.account,currency:data.currency,mapping:data.mapping,rows};
        const preview=importPreview(s,statement);
        if(name==='stage_statement_import'&&!existing){
          if(s.statements.length>=200)throw new Error('Preview ledger limit: 200 statements');
          s.statements.push(statement);audit(s,'statement_staged',{id:statement.id,sourceHash:hash,account:statement.account,currency:statement.currency,mapping:statement.mapping,rowCount:rows.length},actor);
        }
        return {statementId:name==='stage_statement_import'?statement.id:undefined,alreadyApproved:!!existing?.approvedAt,mapping:data.mapping,account:data.account,currency:data.currency,sourceHash:hash,rows:preview.fresh,duplicates:preview.duplicates,incoming:preview.incoming,outgoing:preview.outgoing,unit:'minor currency units',next:'Show mapping, normalized rows, totals and duplicate warnings to the operator before approval.'};
      }
      case 'approve_statement_import':return approveImport(s,data.statementId,actor);
      case 'refresh_finance_invoices':{
        const records=await twenty.list('invoices',{depth:2});
        const invoices:Invoice[]=[];const skipped:{id:string;reason:string}[]=[];
        for(const r of records){try{invoices.push(invoiceSnapshot(r));}catch(e){skipped.push({id:r.id,reason:(e as Error).message});}}
        for(const previous of s.invoices){
          const current=invoices.find(i=>i.id===previous.id);
          if(!current){invoices.push({...previous,active:false,blocked:true});}
        }
        for(const i of invoices)if(allocatedTo(s,i.id)>i.amount-i.externalPaid)throw new Error(`Invoice ${i.number}: external amounts conflict with approved bank allocations. Reverse/review allocations before refreshing.`);
        s.invoices=invoices;s.invoiceSyncAt=new Date().toISOString();
        s.projectionPending=[...new Set([...s.projectionPending,...s.allocations.map(a=>a.invoiceId)])];
        audit(s,'invoices_refreshed',{count:invoices.length,skipped},actor);return {count:invoices.length,skipped,syncedAt:s.invoiceSyncAt};
      }
      case 'review_payment_matches':return {invoiceSyncAt:s.invoiceSyncAt,statements:s.statements.map(x=>({id:x.id,account:x.account,currency:x.currency,mapping:x.mapping,approvedAt:x.approvedAt,rowCount:x.rows.length})),suggestions:suggestions(s),transactions:s.transactions,allocations:s.allocations,costs:s.costs,invoices:s.invoices.map(i=>({...i,bankMatched:allocatedTo(s,i.id),outstanding:outstanding(s,i)})),projectionPending:s.projectionPending};
      case 'approve_payment_allocation':{
        const i=s.invoices.find(i=>i.id===data.invoiceId);if(!i)throw new Error('Refresh invoices before matching');
        assertCurrent(i,invoiceSnapshot(await twenty.get('invoices',i.id,2)));
        return approveAllocation(s,{id:data.id,transactionId:data.transactionId,invoiceId:data.invoiceId,amount:data.amount,reason:data.reason},actor);
      }
      case 'reverse_payment_allocation':return reverseAllocation(s,data.allocationId,data.reason,actor);
      case 'record_property_cost':return recordCost(s,{id:data.id,transactionId:data.transactionId,supplier:data.supplier,reference:data.reference,category:data.category,shares:data.shares},actor);
      case 'link_rebilled_cost':{
        const i=s.invoices.find(i=>i.id===data.invoiceId);if(!i)throw new Error('Refresh invoices first');
        assertCurrent(i,invoiceSnapshot(await twenty.get('invoices',i.id,2)));
        return markCostBilled(s,data.costId,data.shareIndex,data.invoiceId,actor);
      }
      case 'financial_overview':{
        statementDate(data.from,'YMD');statementDate(data.to,'YMD');if(data.from>data.to)throw new Error('Start date must not be after end date');return overview(s,data.currency,data.from,data.to);
      }
      case 'finance_audit_history':return s.audit.slice(-data.limit);
      case 'sync_finance_to_twenty':return project(s);
      default:throw new Error('Unknown tool');
    }
  });
}
async function project(s:FinanceState){
  const result:{invoiceId:string;ok:boolean;error?:string}[]=[];
  for(const id of [...s.projectionPending]){
    try{
      const i=s.invoices.find(i=>i.id===id);if(!i)throw new Error('Invoice snapshot missing');
      assertCurrent(i,invoiceSnapshot(await twenty.get('invoices',id,2)));
      const matched=allocatedTo(s,id),balance=outstanding(s,i);
      await twenty.update('invoices',id,{bankMatchedAmount:currencyField(matched/100,i.currency),bankOutstandingAmount:currencyField(balance/100,i.currency),bankPaymentStatus:balance===0?'SETTLED':matched>0?'PARTIAL':'UNMATCHED'});
      s.projectionPending=s.projectionPending.filter(x=>x!==id);audit(s,'bank_projection_synced',{invoiceId:id,matched,balance},actor);result.push({invoiceId:id,ok:true});
    }catch{result.push({invoiceId:id,ok:false,error:'Projection failed. Check Twenty connection, schema setup and invoice changes; refresh/review and retry.'});}
  }
  return {results:result,pending:s.projectionPending,note:'Only dedicated bank reconciliation fields are written. Payment-provider fields remain authoritative for their own payments.'};
}
