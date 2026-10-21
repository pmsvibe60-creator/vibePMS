import { describe, expect, it } from 'vitest';
import { emptyState, parseStatement, money, statementDate, importPreview, approveImport, approveAllocation, reverseAllocation, overview, recordCost, markCostBilled, suggestions, type Mapping, type FinanceState, type Invoice } from '../src/finance/engine.ts';
const mapping:Mapping={date:'Date',description:'Description',amount:'Amount',bankId:'ID',dateFormat:'DMY',delimiter:',',decimal:'.'};
const csv='Date,Description,Amount,ID\n01/09/2027,RENT-101,1450.00,b1\n02/09/2027,RENT-102,700.00,b2\n03/09/2027,Unknown sender,1450.00,b3\n04/09/2027,Building utilities,-600.00,b4\n05/09/2027,Insurance,-420.00,b5';
const invoice=(id:string,reference=id):Invoice=>({id,reference,number:id,tenant:'Alex Example',unit:'unit-1',currency:'GBP',amount:145000,externalPaid:0,dueDate:'2027-09-01',type:'RENT',active:true,blocked:false});
function state():FinanceState{
 const s=emptyState();s.statements.push({id:'statement',sourceHash:'hash',account:'client-account',currency:'GBP',mapping,rows:parseStatement(csv,mapping)});approveImport(s,'statement','test');s.invoices=[invoice('RENT-101'),invoice('RENT-102'),invoice('RENT-103'),invoice('RENT-104')];return s;
}
describe('agent-mapped statement import',()=>{
 it('parses quoted fields, BOM, line breaks and exact minor units',()=>{
  const rows=parseStatement('\uFEFFDate,Description,Amount,ID\r\n01/09/2027,"Rent, Alex", "1,450.00",b1'.replace(', "',',"'),mapping);
  expect(rows[0]).toEqual({date:'2027-09-01',description:'Rent, Alex',amount:145000,bankId:'b1'});
  expect(money('1.450,25',',')).toBe(145025);expect(money('-0.01','.')).toBe(-1);
 });
 it('maps separate credit/debit and explicit date formats',()=>{
  const rows=parseStatement('When;Memo;In;Out\n09/01/2027;Rent;1450,00;\n09/02/2027;Repair;;10,50',{date:'When',description:'Memo',credit:'In',debit:'Out',dateFormat:'MDY',delimiter:';',decimal:','});
  expect(rows.map(r=>[r.date,r.amount])).toEqual([['2027-09-01',145000],['2027-09-02',-1050]]);
 });
 it('rejects ambiguous or malformed amounts, dates and columns',()=>{
  for(const v of ['1,45','1.001','NaN','£100','1e3'])expect(()=>money(v,'.')).toThrow();
  expect(()=>statementDate('31/02/2027','DMY')).toThrow();expect(()=>statementDate('01/02/27','DMY')).toThrow();
  expect(()=>parseStatement(csv,{...mapping,amount:'Missing'})).toThrow();
  expect(()=>parseStatement(csv,{...mapping,credit:'Amount'})).toThrow();
  expect(()=>parseStatement('Date,Description,Amount,ID\n01/09/2027,"broken,1,b1',mapping)).toThrow();
 });
 it('stages without transactions, imports once and flags overlaps',()=>{
  const s=emptyState(), statement={id:'s',sourceHash:'h',account:'a',currency:'GBP',mapping,rows:parseStatement(csv,mapping)};s.statements.push(statement);
  expect(importPreview(s,statement).fresh).toHaveLength(5);expect(s.transactions).toHaveLength(0);
  approveImport(s,'s','test');expect(approveImport(s,'s','test').imported).toBe(0);expect(importPreview(s,statement).duplicates).toHaveLength(5);
  expect(()=>importPreview(s,{...statement,rows:[{...statement.rows[0],amount:999}]})).toThrow('changed');
 });
 it('flags indistinguishable rows without bank IDs instead of double counting',()=>{
  const s=emptyState();const rows=parseStatement(csv,{...mapping,bankId:undefined});const preview=importPreview(s,{id:'s',sourceHash:'h',account:'a',currency:'GBP',mapping,rows:[rows[0],rows[0]]});expect(preview.fresh).toHaveLength(1);expect(preview.duplicates).toHaveLength(1);
 });
});
describe('reviewed payment allocation',()=>{
 it('explains reference matches but leaves amount-only ambiguity for review',()=>{
  const s=state();const result=suggestions(s);expect(result[0].candidates[0].evidence).toBe('reference');expect(result[2].status).toBe('needs-review');expect(s.allocations).toHaveLength(0);
 });
 it('supports partial receipts, idempotency and immutable reversals',()=>{
  const s=state();const a={id:'a',transactionId:s.transactions[1].id,invoiceId:'RENT-102',amount:70000,reason:'Reviewed reference'};
  approveAllocation(s,a,'test');approveAllocation(s,a,'test');expect(s.allocations).toHaveLength(1);
  expect(overview(s,'GBP','2027-09-01','2027-09-30').outstandingInvoices.find(i=>i.id==='RENT-102')?.balance).toBe(75000);
  reverseAllocation(s,'a','Wrong month','test');expect(s.allocations[0].reversalReason).toBe('Wrong month');expect(s.audit.at(-1)?.action).toBe('allocation_reversed');
  expect(overview(s,'GBP','2027-09-01','2027-09-30').matchedRent).toBe(0);
 });
 it('rejects overspending, currency mismatch, blocked invoices and key reuse',()=>{
  const s=state();const a={id:'a',transactionId:s.transactions[0].id,invoiceId:'RENT-101',amount:145001,reason:'review'};
  expect(()=>approveAllocation(s,a,'test')).toThrow();s.invoices[0].currency='EUR';expect(()=>approveAllocation(s,{...a,amount:145000},'test')).toThrow('Currency');
  s.invoices[0].currency='GBP';s.invoices[0].blocked=true;expect(()=>approveAllocation(s,{...a,amount:145000},'test')).toThrow('cannot');
  s.invoices[0].blocked=false;approveAllocation(s,{...a,amount:145000},'test');expect(()=>approveAllocation(s,{...a,amount:1},'test')).toThrow('Idempotency');
  expect(()=>approveAllocation(s,{...a,id:'other',invoiceId:'RENT-102',amount:1},'test')).toThrow('exceeds');
 });
 it('splits one receipt and combines receipts without losing amounts',()=>{
  const s=state();const id=s.transactions[0].id;
  approveAllocation(s,{id:'a',transactionId:id,invoiceId:'RENT-101',amount:75000,reason:'split'},'test');
  approveAllocation(s,{id:'b',transactionId:id,invoiceId:'RENT-102',amount:70000,reason:'split'},'test');
  approveAllocation(s,{id:'c',transactionId:s.transactions[1].id,invoiceId:'RENT-101',amount:70000,reason:'remaining'},'test');
  expect(overview(s,'GBP','2027-09-01','2027-09-30').outstandingInvoices[0].balance).toBe(0);
 });
});
describe('cost allocation and financial overview',()=>{
 it('separates owner shares, unbilled costs and unknown receipts',()=>{
  const s=state();for(const [i,amount] of [[0,145000],[1,70000]])approveAllocation(s,{id:String(i),transactionId:s.transactions[i].id,invoiceId:s.invoices[i].id,amount,reason:'reviewed'},'test');
  recordCost(s,{id:'utilities',transactionId:s.transactions[3].id,supplier:'Building',reference:'U1',category:'Utilities',shares:[{unit:'unit-1',amount:45000,kind:'unbilled'},{unit:'vacant-unit',amount:15000,kind:'owner'}]},'test');
  recordCost(s,{id:'insurance',transactionId:s.transactions[4].id,supplier:'Insurer',reference:'I1',category:'Insurance',shares:[{unit:'building',amount:42000,kind:'owner'}]},'test');
  expect(overview(s,'GBP','2027-09-01','2027-09-30')).toMatchObject({incoming:360000,matchedRent:215000,unmatchedReceipts:145000,recordedCosts:102000,ownerCosts:57000,costsAwaitingBilling:45000,matchedRentLessRecordedCosts:113000,unclassifiedOutgoings:0});
  expect(overview(s,'EUR','2027-09-01','2027-09-30').incoming).toBe(0);
 });
 it('requires exact cost shares and a matching issued invoice for rebilling',()=>{
  const s=state();const cost={id:'cost',transactionId:s.transactions[3].id,supplier:'A',reference:'1',category:'Utilities',shares:[{unit:'unit-1',amount:60000,kind:'unbilled' as const}]};
  expect(()=>recordCost(s,{...cost,shares:[{unit:'u',amount:100,kind:'owner'}]},'test')).toThrow();
  recordCost(s,cost,'test');expect(()=>recordCost(s,cost,'test')).toThrow('already');
  expect(()=>markCostBilled(s,'cost',0,'RENT-101','test')).toThrow();
  s.invoices.push({...invoice('utility'),type:'UTILITY',amount:60000});markCostBilled(s,'cost',0,'utility','test');
  expect(overview(s,'GBP','2027-09-01','2027-09-30').costsAwaitingBilling).toBe(0);expect(()=>markCostBilled(s,'cost',0,'utility','test')).toThrow();
 });
});
