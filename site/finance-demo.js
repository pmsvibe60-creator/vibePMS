import {emptyState, parseStatement, importPreview, approveImport, approveAllocation, reverseAllocation, recordCost, overview, suggestions} from './finance-engine.js?v=ebe5f80d2a4f';
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n/100);
const csv = 'Date,Description,Amount,ID\n2027-09-01,RENT-101 Alex Morgan,1450.00,EX001\n2027-09-02,RENT-102 Jamie Reed,700.00,EX002\n2027-09-03,Transfer from unknown sender,1450.00,EX003\n2027-09-04,Building utilities,-600.00,EX004\n2027-09-05,Building insurance,-420.00,EX005';
let state, statement;
function reset(){
 state=emptyState();
 state.invoices=['Alex Morgan','Jamie Reed','Taylor Lane','Casey Brook'].map((tenant,n)=>({id:'invoice-'+n,number:'RENT-'+(101+n),tenant,unit:'Flat '+(n+1),currency:'GBP',amount:145000,externalPaid:0,reference:'RENT-'+(101+n),dueDate:'2027-09-01',type:'RENT',blocked:false,active:true}));
 const mapping={date:'Date',description:'Description',amount:'Amount',bankId:'ID',dateFormat:'YMD',delimiter:',',decimal:'.'};
 statement={id:crypto.randomUUID(),sourceHash:'fictional-demo',account:'Sample operating account',currency:'GBP',mapping,rows:parseStatement(csv,mapping)};
 state.statements.push(statement);
 $('finance-import').disabled=false; $('finance-costs').disabled=true;
 $('finance-status').textContent='Mapping ready for review. Five fictional rows, £3,600 incoming and £1,020 outgoing. No records saved yet.';
 render();
}
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function render(){
 const summary=overview(state,'GBP','2027-09-01','2027-09-30');
 const metrics=[['Matched rent',summary.matchedRent],['Unidentified receipts',summary.unmatchedReceipts],['Current unpaid rent',summary.outstandingInvoices.reduce((n,i)=>n+i.balance,0)],['Costs awaiting billing',summary.costsAwaitingBilling],['Owner costs',summary.ownerCosts],['Matched rent less costs',summary.matchedRentLessRecordedCosts]];
 $('finance-metrics').replaceChildren(...metrics.map(([label,value])=>{const el=node('div','','finance-metric');el.append(node('span',label),node('strong',money(value)));return el;}));
 const list=$('finance-transactions');list.replaceChildren();
 const rows=state.transactions.length?state.transactions:statement.rows;
 for(const t of rows){
  const row=node('div','','finance-row');const detail=node('div','');detail.append(node('strong',t.description),node('small',t.date));row.append(detail,node('strong',money(t.amount)));
  if(t.id && t.amount>0){
   const match=suggestions(state).find(s=>s.transaction.id===t.id);
   const candidate=match?.candidates.find(c=>c.evidence==='reference');
   const allocation=state.allocations.find(a=>a.transactionId===t.id&&!a.reversedAt);
   if(candidate){const b=node('button','Approve '+candidate.invoiceNumber,'finance-action');b.type='button';b.addEventListener('click',()=>{approveAllocation(state,{id:crypto.randomUUID(),transactionId:t.id,invoiceId:candidate.invoiceId,amount:candidate.proposedAmount,reason:candidate.reasons.join('; ')},'Demo operator');$('finance-status').textContent='Approved '+money(candidate.proposedAmount)+' against '+candidate.invoiceNumber+'. Recorded in the demo audit trail.';render();});const box=node('div','');box.append(node('small',candidate.reasons.join(' · ')),b);row.append(box);}
   else if(allocation){const b=node('button','Undo match','finance-action');b.type='button';b.addEventListener('click',()=>{reverseAllocation(state,allocation.id,'Operator corrected the demo match','Demo operator');$('finance-status').textContent='Match reversed; original approval and correction remain in the audit trail.';render();});row.append(b);}
   else row.append(node('span','Needs review · amount alone is not enough','finance-flag'));
  }else row.append(node('span',t.id?'Outgoing · review cost allocation':'Awaiting import','finance-flag'));
  list.append(row);
 }
 $('finance-audit').replaceChildren(...state.audit.slice().reverse().map(e=>node('li',e.action.replaceAll('_',' ')+' · '+e.actor)));
 $('finance-costs').disabled=!state.transactions.length||!!state.costs.length;
 $('finance-cost-note').textContent=state.costs.length?'Recorded: £450 utilities awaiting tenant billing, £150 utilities retained by the owner, £420 owner insurance. Unclassified outgoing: £0.':'Proposed: £600 utilities → £450 unbilled tenant share + £150 owner share. £420 insurance → owner. Approval records these classifications.';
}
$('finance-import').addEventListener('click',()=>{const preview=importPreview(state,statement);approveImport(state,statement.id,'Demo operator');$('finance-import').disabled=true;$('finance-status').textContent=preview.fresh.length+' rows imported. Review each reference match below; the unidentified payment stays unresolved.';render();});
$('finance-costs').addEventListener('click',()=>{for(const [id,supplier,shares] of [['EX004','Sample Utilities',[{unit:'Flat 1',amount:45000,kind:'unbilled'},{unit:'Building',amount:15000,kind:'owner'}]],['EX005','Sample Insurance',[{unit:'Building',amount:42000,kind:'owner'}]]]){recordCost(state,{id:crypto.randomUUID(),transactionId:state.transactions.find(t=>t.bankId===id).id,supplier,reference:id,category:'Building costs',shares},'Demo operator');}$('finance-status').textContent='Cost allocation approved. The £450 tenant share remains unbilled until linked to an issued invoice.';render();});
$('finance-reset').addEventListener('click',reset);
reset();
