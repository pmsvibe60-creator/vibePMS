/** Shared deterministic finance rules. Used by the server and the public sample-data demo. */
export type Mapping = { date: string; description: string; amount?: string; credit?: string; debit?: string; bankId?: string; dateFormat: 'YMD' | 'DMY' | 'MDY'; delimiter: ',' | ';' | '\t'; decimal: '.' | ',' };
export type BankRow = { date: string; description: string; amount: number; bankId: string };
export type Transaction = BankRow & { id: string; account: string; currency: string; importId: string };
export type Invoice = { id: string; number: string; tenant: string; unit: string; currency: string; amount: number; externalPaid: number; reference: string; dueDate: string; type: string; blocked: boolean; active: boolean };
export type Allocation = { id: string; transactionId: string; invoiceId: string; amount: number; reason: string; createdAt: string; reversedAt?: string; reversalReason?: string };
export type CostShare = { unit: string; amount: number; kind: 'owner' | 'unbilled' | 'unallocated' | 'billed'; invoiceId?: string };
export type Cost = { id: string; transactionId: string; supplier: string; reference: string; category: string; shares: CostShare[] };
export type Audit = { id: string; at: string; action: string; actor: string; detail: unknown };
export type Statement = { id: string; sourceHash: string; account: string; currency: string; mapping: Mapping; rows: BankRow[]; approvedAt?: string };
export type FinanceState = { version: 1; revision: number; statements: Statement[]; transactions: Transaction[]; invoices: Invoice[]; allocations: Allocation[]; costs: Cost[]; audit: Audit[]; invoiceSyncAt?: string; projectionPending: string[] };
export const emptyState = (): FinanceState => ({ version: 1, revision: 0, statements: [], transactions: [], invoices: [], allocations: [], costs: [], audit: [], projectionPending: [] });
const fail = (message: string): never => { throw new Error(message); };
export const minor = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 100_000_000_00;
const positive = (n: number) => minor(n) && n > 0;
const norm = (s: string) => s.normalize('NFKC').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function money(text: string, decimal: '.' | ','): number {
  const raw = text.trim();
  if (!raw) return 0;
  // Require a single explicit convention; never guess ambiguous separators or currency symbols.
  const grouped = decimal === '.' ? /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/ : /^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  if (!grouped.test(raw)) return fail(`Invalid amount: ${raw}`);
  const clean = raw.replaceAll(decimal === '.' ? ',' : '.', '');
  const [whole, fraction = ''] = clean.replace(/^-/, '').split(decimal);
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!minor(result)) return fail('Amount outside supported range');
  return raw.startsWith('-') ? -result : result;
}
export function statementDate(value: string, format: Mapping['dateFormat']): string {
  const parts = value.trim().split(/[-/.]/);
  if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) return fail(`Invalid date: ${value}`);
  const [y, m, d] = format === 'YMD' ? parts : format === 'DMY' ? [parts[2], parts[1], parts[0]] : [parts[2], parts[0], parts[1]];
  if (y.length !== 4 || +y < 1900 || +y > 2200) return fail(`Use a four-digit year: ${value}`);
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d) return fail(`Invalid calendar date: ${value}`);
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
export function csvRows(csv: string, delimiter: string): string[][] {
  if (csv.length > 500_000) return fail('CSV exceeds 500 KB; split the statement');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const input = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === delimiter || c === '\n') {
      row.push(cell); cell = ''; closed = false;
      if (c === '\n') { if (row.some(v => v.trim())) rows.push(row); row = []; }
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else if (closed || c === '"') return fail('Malformed quoted CSV field');
    else cell += c;
  }
  if (quoted) return fail('Unclosed CSV quote');
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2 || rows.length > 1001) return fail('Provide a header and 1–1000 transaction rows');
  return rows;
}
export function parseStatement(csv: string, mapping: Mapping): BankRow[] {
  const [rawHeader, ...rows] = csvRows(csv, mapping.delimiter);
  const header = rawHeader.map(s => s.trim());
  if (new Set(header).size !== header.length || header.some(h => !h)) return fail('CSV headers must be non-empty and unique');
  if (!!mapping.amount === !!(mapping.credit || mapping.debit)) return fail('Map either signed amount, or credit/debit columns');
  const fields = [mapping.date, mapping.description, mapping.amount, mapping.credit, mapping.debit, mapping.bankId].filter((v): v is string => !!v);
  if (new Set(fields).size !== fields.length) return fail('Each mapped column must be distinct');
  for (const field of fields) if (!header.includes(field)) return fail(`Missing CSV column: ${field}`);
  return rows.map((row, i) => {
    if (row.length !== header.length) return fail(`Row ${i + 2}: column count does not match header`);
    const get = (name?: string) => name ? row[header.indexOf(name)].trim() : '';
    const credit = money(get(mapping.credit), mapping.decimal), debit = money(get(mapping.debit), mapping.decimal);
    if (credit < 0 || debit < 0 || (credit > 0 && debit > 0)) return fail(`Row ${i + 2}: use separate positive credit or debit`);
    const amount = mapping.amount ? money(get(mapping.amount), mapping.decimal) : credit - debit;
    if (amount === 0) return fail(`Row ${i + 2}: zero or missing amount`);
    const description = get(mapping.description);
    if (!description || description.length > 500) return fail(`Row ${i + 2}: description must contain 1–500 characters`);
    const bankId = get(mapping.bankId);
    if (mapping.bankId && !bankId) return fail(`Row ${i + 2}: missing bank transaction ID`);
    if (bankId.length > 200) return fail('Bank transaction ID too long');
    return { date: statementDate(get(mapping.date), mapping.dateFormat), description, amount, bankId };
  });
}
export const bankKey = (r: BankRow, account: string, currency: string) => JSON.stringify([account, currency, r.bankId || [r.date, r.amount, norm(r.description)]]);
export function importPreview(state: FinanceState, s: Statement) {
  const seen = new Map(state.transactions.map(t => [bankKey(t, t.account, t.currency), t]));
  const fresh: BankRow[] = [], duplicates: { row: number; reason: string }[] = [];
  for (const [index, row] of s.rows.entries()) {
    const key = bankKey(row, s.account, s.currency), old = seen.get(key);
    if (old) {
      if (row.bankId && (old.amount !== row.amount || old.date !== row.date || old.description !== row.description)) return fail(`Bank transaction ID changed: ${row.bankId}. Review the source; no automatic overwrite.`);
      duplicates.push({ row: index + 2, reason: row.bankId ? 'Bank ID already seen' : 'Same account, date, amount and description; possible duplicate requires separate investigation' });
    } else { fresh.push(row); seen.set(key, { ...row, account: s.account, currency: s.currency, id: '', importId: '' }); }
  }
  return { fresh, duplicates, incoming: fresh.reduce((n,r) => n + Math.max(r.amount,0),0), outgoing: fresh.reduce((n,r) => n + Math.max(-r.amount,0),0) };
}
export function audit(state: FinanceState, action: string, detail: unknown, actor: string) {
  state.audit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action, detail, actor }); state.revision++;
}
export function approveImport(state: FinanceState, id: string, actor: string) {
  const s = state.statements.find(s => s.id === id) ?? fail('Statement not found');
  if (s.approvedAt) return { alreadyApproved: true, imported: 0 };
  const preview = importPreview(state, s);
  if (state.transactions.length + preview.fresh.length > 10_000) return fail('Preview ledger limit: 10,000 transactions');
  for (const row of preview.fresh) state.transactions.push({ ...row, id: crypto.randomUUID(), account: s.account, currency: s.currency, importId: s.id });
  s.approvedAt = new Date().toISOString();
  audit(state, 'statement_approved', { statementId: id, imported: preview.fresh.length, duplicates: preview.duplicates }, actor);
  return { imported: preview.fresh.length, duplicates: preview.duplicates };
}
export const activeAllocations = (s: FinanceState) => s.allocations.filter(a => !a.reversedAt);
export const allocatedTo = (s: FinanceState, invoiceId: string) => activeAllocations(s).filter(a => a.invoiceId === invoiceId).reduce((n,a) => n + a.amount,0);
export const remainingReceipt = (s: FinanceState, transactionId: string) => (s.transactions.find(t => t.id === transactionId)?.amount ?? 0) - activeAllocations(s).filter(a => a.transactionId === transactionId).reduce((n,a) => n+a.amount,0);
export const outstanding = (s: FinanceState, i: Invoice) => i.amount - i.externalPaid - allocatedTo(s,i.id);
export function suggestions(s: FinanceState) {
  return s.transactions.filter(t => t.amount > 0 && remainingReceipt(s,t.id)>0).map(t => {
    const available = remainingReceipt(s,t.id);
    const candidates = s.invoices.filter(i => i.active && !i.blocked && i.currency===t.currency && outstanding(s,i)>0).map(i => {
      const desc = ` ${norm(t.description)} `;
      const exactReference = [i.reference,i.number].some(ref => norm(ref).length>=3 && desc.includes(` ${norm(ref)} `));
      const tenantName = norm(i.tenant).length>=5 && desc.includes(` ${norm(i.tenant)} `);
      const amountMatch = outstanding(s,i)===available;
      return { invoiceId:i.id, invoiceNumber:i.number, tenant:i.tenant, unit:i.unit, outstanding:outstanding(s,i), proposedAmount:Math.min(available,outstanding(s,i)), evidence:exactReference?'reference':tenantName?'tenant-name':'amount-only', reasons:[...(exactReference?['Exact invoice/reference text in bank description']:[]),...(tenantName?['Tenant name appears in bank description']:[]),...(amountMatch?['Amount equals outstanding balance']:['Partial or excess receipt: review allocation'])], relevant:exactReference||tenantName||amountMatch };
    }).filter(c=>c.relevant).sort((a,b)=>['reference','tenant-name','amount-only'].indexOf(a.evidence)-['reference','tenant-name','amount-only'].indexOf(b.evidence));
    return { transaction:t, available, status:candidates.length===1 && candidates[0].evidence!=='amount-only'?'suggested':'needs-review', candidates:candidates.slice(0,10) };
  });
}
export function approveAllocation(s: FinanceState, input: { id: string; transactionId: string; invoiceId: string; amount: number; reason: string }, actor: string) {
  const prior=s.allocations.find(a=>a.id===input.id);
  if(prior){if(prior.transactionId!==input.transactionId||prior.invoiceId!==input.invoiceId||prior.amount!==input.amount||prior.reason!==input.reason) return fail('Idempotency key reused for different allocation');return prior;}
  const t=s.transactions.find(t=>t.id===input.transactionId)??fail('Transaction not found');
  const i=s.invoices.find(i=>i.id===input.invoiceId)??fail('Invoice not found; refresh invoices');
  if(!i.active||i.blocked) return fail('Invoice cannot accept bank allocations (inactive, mixed deposit, or provider-managed)');
  if(t.currency!==i.currency) return fail('Currency mismatch');
  if(!positive(input.amount)||t.amount<=0||input.amount>remainingReceipt(s,t.id)||input.amount>outstanding(s,i)) return fail('Allocation exceeds available receipt or outstanding invoice');
  if(!input.reason.trim()) return fail('Record the reviewed matching reason');
  const entry={...input,createdAt:new Date().toISOString()};s.allocations.push(entry);
  s.projectionPending=[...new Set([...s.projectionPending,i.id])];audit(s,'allocation_approved',entry,actor);return entry;
}
export function reverseAllocation(s: FinanceState,id:string,reason:string,actor:string){
  const a=s.allocations.find(a=>a.id===id)??fail('Allocation not found');
  if(a.reversedAt)return a;
  if(!reason.trim())return fail('Correction reason required');
  a.reversedAt=new Date().toISOString();a.reversalReason=reason;s.projectionPending=[...new Set([...s.projectionPending,a.invoiceId])];audit(s,'allocation_reversed',{id,reason},actor);return a;
}
export function recordCost(s:FinanceState,input:Cost,actor:string){
  if(s.costs.some(c=>c.id===input.id||c.transactionId===input.transactionId))return fail('This outgoing transaction already has a cost record');
  const t=s.transactions.find(t=>t.id===input.transactionId)??fail('Transaction not found');
  if(t.amount>=0||input.shares.length===0||input.shares.some(a=>!positive(a.amount)||!a.unit.trim())||input.shares.reduce((n,a)=>n+a.amount,0)!==-t.amount)return fail('Cost shares must exactly allocate the outgoing transaction');
  if(input.shares.some(a=>a.kind==='billed'||a.invoiceId))return fail('Start with owner/unbilled/unallocated shares; link an issued invoice separately');
  s.costs.push(input);audit(s,'cost_recorded',input,actor);return input;
}
export function markCostBilled(s:FinanceState,costId:string,index:number,invoiceId:string,actor:string){
  const cost=s.costs.find(c=>c.id===costId)??fail('Cost not found');const share=cost.shares[index]??fail('Cost share not found');
  if(share.kind!=='unbilled')return fail('Only approved, unbilled shares can be linked');
  const i=s.invoices.find(i=>i.id===invoiceId)??fail('Invoice not found; refresh invoices');
  const t=s.transactions.find(t=>t.id===cost.transactionId)!;
  const already=s.costs.flatMap(c=>c.shares).filter(a=>a.invoiceId===invoiceId).reduce((n,a)=>n+a.amount,0);
  if(!i.active||!['UTILITY','OTHER'].includes(i.type)||i.currency!==t.currency||i.unit!==share.unit||share.amount+already>i.amount)return fail('Issued invoice must match the unit/currency and cover the linked cost shares');
  share.kind='billed';share.invoiceId=invoiceId;audit(s,'cost_share_billed',{costId,index,invoiceId},actor);return share;
}
export function overview(s:FinanceState,currency:string,from:string,to:string){
  const tx=s.transactions.filter(t=>t.currency===currency&&t.date>=from&&t.date<=to);const ids=new Set(tx.map(t=>t.id));
  const allocations=activeAllocations(s).filter(a=>ids.has(a.transactionId));
  const matchedRent=allocations.filter(a=>s.invoices.find(i=>i.id===a.invoiceId)?.type==='RENT').reduce((n,a)=>n+a.amount,0);
  const matchedReceipts=allocations.reduce((n,a)=>n+a.amount,0);
  const incoming=tx.reduce((n,t)=>n+Math.max(t.amount,0),0),outgoing=tx.reduce((n,t)=>n+Math.max(-t.amount,0),0);
  const costs=s.costs.filter(c=>ids.has(c.transactionId));
  const recordedCosts=costs.reduce((n,c)=>n+c.shares.reduce((m,a)=>m+a.amount,0),0);
  const shares=costs.flatMap(c=>c.shares);
  return {currency,from,to,statementCoverage:s.statements.filter(x=>x.approvedAt&&x.currency===currency).map(x=>({account:x.account,from:x.rows.map(r=>r.date).sort()[0],to:x.rows.map(r=>r.date).sort().at(-1)})),incoming,outgoing,matchedRent,matchedOtherReceipts:matchedReceipts-matchedRent,unmatchedReceipts:incoming-matchedReceipts,recordedCosts,unclassifiedOutgoings:outgoing-recordedCosts,ownerCosts:shares.filter(a=>a.kind==='owner').reduce((n,a)=>n+a.amount,0),costsAwaitingBilling:shares.filter(a=>a.kind==='unbilled').reduce((n,a)=>n+a.amount,0),unallocatedCosts:shares.filter(a=>a.kind==='unallocated').reduce((n,a)=>n+a.amount,0),matchedRentLessRecordedCosts:matchedRent-recordedCosts,outstandingInvoices:s.invoices.filter(i=>i.currency===currency&&i.active).map(i=>({id:i.id,number:i.number,unit:i.unit,balance:outstanding(s,i),providerManaged:i.blocked})),projectionPending:s.projectionPending,notice:'Amounts are integer minor units. Recorded transactions only; not accounting profit. Unmatched receipts are excluded from rent. Invoices show current balances, not a historical period-end position. Deposits and provider-managed invoices cannot receive bank allocations in this release.'};
}
