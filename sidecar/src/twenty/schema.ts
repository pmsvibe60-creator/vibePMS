import { twenty } from './client.ts';

/**
 * Declarative PMS data model, provisioned into Twenty through the metadata API.
 * Idempotent: existing objects/fields (matched by name) are left untouched.
 */
type Opt = [value: string, label: string, color: string];
type FieldDef =
  | { name: string; label: string; type: 'TEXT' | 'NUMBER' | 'DATE' | 'DATE_TIME' | 'CURRENCY' | 'LINKS' | 'ADDRESS' | 'BOOLEAN' | 'EMAILS'; icon?: string; description?: string }
  | { name: string; label: string; type: 'SELECT'; options: Opt[]; defaultValue?: string; icon?: string; description?: string }
  | { name: string; label: string; type: 'RELATION'; target: string; targetLabel: string; targetIcon: string; icon?: string; description?: string };

type ObjectDef = { nameSingular: string; namePlural: string; labelSingular: string; labelPlural: string; icon: string; description: string; fields: FieldDef[] };

export const LEASE_STATUS = ['DRAFT', 'READY_TO_SIGN', 'SIGNED', 'AWAITING_PAYMENT', 'ACTIVE', 'NOTICE_GIVEN', 'ENDED', 'CANCELLED'] as const;
export const INVOICE_STATUS = ['DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED', 'REFUND_NEEDED'] as const;

export const OBJECTS: ObjectDef[] = [
  {
    nameSingular: 'unit', namePlural: 'units', labelSingular: 'Unit', labelPlural: 'Units', icon: 'IconBuilding',
    description: 'Apartment / rentable unit',
    fields: [
      { name: 'unitAddress', label: 'Address', type: 'ADDRESS' },
      { name: 'apartmentNo', label: 'Apartment no.', type: 'TEXT' },
      { name: 'cadastralNo', label: 'Registry / cadastral no.', type: 'TEXT' },
      { name: 'areaM2', label: 'Area m²', type: 'NUMBER' },
      { name: 'rooms', label: 'Rooms', type: 'NUMBER' },
      { name: 'unitStatus', label: 'Status', type: 'SELECT', defaultValue: 'VACANT', options: [
        ['VACANT', 'Vacant', 'yellow'], ['OCCUPIED', 'Occupied', 'green'], ['RENOVATION', 'Renovation', 'orange'], ['INACTIVE', 'Inactive', 'gray'] ] },
      { name: 'buildingManagerName', label: 'Building manager', type: 'TEXT' },
      { name: 'buildingManagerContact', label: 'Building management contact', type: 'TEXT' },
      { name: 'meterInfo', label: 'Meters (IDs, locations)', type: 'TEXT' },
      { name: 'inventory', label: 'Inventory list', type: 'TEXT' },
      { name: 'unitNotes', label: 'Notes', type: 'TEXT' },
    ],
  },
  {
    nameSingular: 'lease', namePlural: 'leases', labelSingular: 'Lease', labelPlural: 'Leases', icon: 'IconFileText',
    description: 'Tenancy agreement for a unit',
    fields: [
      { name: 'unit', label: 'Unit', type: 'RELATION', target: 'unit', targetLabel: 'Leases', targetIcon: 'IconFileText' },
      { name: 'tenant', label: 'Tenant', type: 'RELATION', target: 'person', targetLabel: 'Leases', targetIcon: 'IconFileText' },
      { name: 'leaseStatus', label: 'Status', type: 'SELECT', defaultValue: 'DRAFT', options: [
        ['DRAFT', 'Draft', 'gray'], ['READY_TO_SIGN', 'Ready to sign', 'sky'], ['SIGNED', 'Signed', 'blue'],
        ['AWAITING_PAYMENT', 'Awaiting move-in payment', 'purple'], ['ACTIVE', 'Active', 'green'],
        ['NOTICE_GIVEN', 'Notice given', 'orange'], ['ENDED', 'Ended', 'gray'], ['CANCELLED', 'Cancelled', 'red'] ] },
      { name: 'startDate', label: 'Start date', type: 'DATE' },
      { name: 'endDate', label: 'End date (empty = open-ended)', type: 'DATE' },
      { name: 'rentAmount', label: 'Monthly rent', type: 'CURRENCY' },
      { name: 'dueDay', label: 'Rent due day', type: 'NUMBER' },
      { name: 'depositAmount', label: 'Deposit', type: 'CURRENCY' },
      { name: 'depositMode', label: 'Deposit mode', type: 'SELECT', defaultValue: 'CHOICE', options: [
        ['CHOICE', 'Tenant chooses', 'sky'], ['DEPOSIT_UPFRONT', 'Paid upfront', 'blue'], ['DEPOSIT_GUARANTEED', 'CasaPay guarantee', 'purple'] ] },
      { name: 'agreementType', label: 'CasaPay agreement type', type: 'SELECT', defaultValue: 'ONTIME', options: [
        ['ONTIME', 'On-time (payout on due date)', 'green'], ['COVER', 'Cover (payout +30 days)', 'blue'], ['PAYMENT_LINK', 'Payment link (no guarantee)', 'gray'] ] },
      { name: 'utilitiesPolicy', label: 'Utilities', type: 'SELECT', defaultValue: 'REBILL_ACTUAL', options: [
        ['REBILL_ACTUAL', 'Re-billed by actual invoices', 'sky'], ['INCLUDED', 'Included in rent', 'green'], ['TENANT_DIRECT', 'Tenant pays suppliers directly', 'gray'] ] },
      { name: 'noticePeriodDays', label: 'Notice period (days)', type: 'NUMBER' },
      { name: 'contractLanguage', label: 'Contract language', type: 'SELECT', defaultValue: 'EN', options: [['EN', 'English', 'gray']] },
      { name: 'specialTerms', label: 'Special terms', type: 'TEXT' },
      { name: 'referenceBase', label: 'Reference base', type: 'TEXT', description: 'Set by PMS; base for invoice references' },
      { name: 'signingStatus', label: 'Signing', type: 'SELECT', defaultValue: 'NOT_SENT', options: [
        ['NOT_SENT', 'Not sent', 'gray'], ['SENT', 'Sent to tenant', 'sky'], ['TENANT_SIGNED', 'Tenant signed', 'blue'], ['COMPLETED', 'Fully signed', 'green'], ['DECLINED', 'Declined', 'red'] ] },
      { name: 'signedAt', label: 'Signed at', type: 'DATE_TIME' },
      { name: 'contract', label: 'Contract PDF', type: 'LINKS' },
      { name: 'signingLink', label: 'Signing link', type: 'LINKS' },
      { name: 'casapayAgreementId', label: 'CasaPay agreement id', type: 'TEXT' },
      { name: 'casapayAgreementRef', label: 'CasaPay agreement ref', type: 'TEXT' },
      { name: 'casapayEmailAlias', label: 'Utility invoice email (CasaPay)', type: 'TEXT', description: 'Forward utility bills here — CasaPay bills the tenant' },
      { name: 'moveInCheckout', label: 'Move-in checkout', type: 'LINKS' },
      { name: 'depositResolution', label: 'Deposit resolution', type: 'TEXT' },
    ],
  },
  {
    nameSingular: 'invoice', namePlural: 'invoices', labelSingular: 'Invoice', labelPlural: 'Invoices', icon: 'IconReceipt',
    description: 'Rent, utility and other charges to tenants',
    fields: [
      { name: 'lease', label: 'Lease', type: 'RELATION', target: 'lease', targetLabel: 'Invoices', targetIcon: 'IconReceipt' },
      { name: 'unit', label: 'Unit', type: 'RELATION', target: 'unit', targetLabel: 'Invoices', targetIcon: 'IconReceipt' },
      { name: 'invoiceType', label: 'Type', type: 'SELECT', defaultValue: 'RENT', options: [
        ['RENT', 'Rent', 'blue'], ['MOVE_IN', 'Move-in (rent + deposit)', 'purple'], ['UTILITY', 'Utilities', 'turquoise'], ['OTHER', 'Other', 'gray'] ] },
      { name: 'invoiceStatus', label: 'Status', type: 'SELECT', defaultValue: 'DRAFT', options: [
        ['DRAFT', 'Draft', 'gray'], ['SENT', 'Sent', 'sky'], ['PAID', 'Paid', 'green'], ['PARTIAL', 'Partially paid', 'yellow'],
        ['OVERDUE', 'Overdue', 'red'], ['CANCELLED', 'Cancelled', 'gray'], ['REFUND_NEEDED', 'Refund / credit needed', 'orange'] ] },
      { name: 'invoiceNo', label: 'Invoice no.', type: 'TEXT' },
      { name: 'referenceNumber', label: 'Reference no.', type: 'TEXT' },
      { name: 'period', label: 'Period (YYYY-MM)', type: 'TEXT' },
      { name: 'amount', label: 'Amount', type: 'CURRENCY' },
      { name: 'paidAmount', label: 'Paid', type: 'CURRENCY' },
      { name: 'dueDate', label: 'Due date', type: 'DATE' },
      { name: 'bankMatchedAmount', label: 'Bank matched amount', type: 'CURRENCY' },
      { name: 'bankOutstandingAmount', label: 'Bank outstanding balance', type: 'CURRENCY' },
      { name: 'bankPaymentStatus', label: 'Bank reconciliation', type: 'SELECT', options: [['UNMATCHED', 'Unmatched', 'gray'], ['PARTIAL', 'Partially matched', 'yellow'], ['SETTLED', 'Settled', 'green']] },
      { name: 'paidAt', label: 'Paid at', type: 'DATE_TIME' },
      { name: 'payoutStatus', label: 'Payout status', type: 'TEXT' },
      { name: 'checkoutUrl', label: 'Payment link', type: 'LINKS' },
      { name: 'pdf', label: 'Invoice PDF', type: 'LINKS' },
      { name: 'casapayInvoiceId', label: 'CasaPay invoice id', type: 'TEXT' },
      { name: 'casapaySessionId', label: 'CasaPay session id', type: 'TEXT' },
      { name: 'lastPaymentError', label: 'Last payment error', type: 'TEXT' },
    ],
  },
];

export const PERSON_FIELDS: FieldDef[] = [
  { name: 'personalCode', label: 'Identity reference (optional)', type: 'TEXT' },
  { name: 'kycStatus', label: 'KYC (CasaPay)', type: 'SELECT', defaultValue: 'NONE', options: [
    ['NONE', 'Not started', 'gray'], ['PENDING', 'Pending review', 'yellow'], ['APPROVED', 'Approved', 'green'], ['FAILED', 'Failed', 'red'] ] },
];

type MetaObject = { id: string; nameSingular: string; fieldsList: { id: string; name: string }[] };

async function loadObjects(): Promise<Map<string, MetaObject>> {
  const data = await twenty.metadata<{ objects: { edges: { node: MetaObject }[] } }>(
    `query { objects(paging: { first: 1000 }) { edges { node { id nameSingular fieldsList { id name } } } } }`,
  );
  return new Map(data.objects.edges.map((e) => [e.node.nameSingular, e.node]));
}

function fieldInput(objectMetadataId: string, f: FieldDef, objects: Map<string, MetaObject>) {
  const base = { objectMetadataId, name: f.name, label: f.label, icon: f.icon, description: f.description, isNullable: true };
  if (f.type === 'SELECT') {
    return {
      ...base, type: 'SELECT',
      defaultValue: f.defaultValue ? `'${f.defaultValue}'` : null,
      options: f.options.map(([value, label, color], position) => ({ value, label, color, position })),
    };
  }
  if (f.type === 'RELATION') {
    const target = objects.get(f.target);
    if (!target) throw new Error(`Relation target ${f.target} not found`);
    return {
      ...base, type: 'RELATION',
      relationCreationPayload: { type: 'MANY_TO_ONE', targetObjectMetadataId: target.id, targetFieldLabel: f.targetLabel, targetFieldIcon: f.targetIcon },
    };
  }
  return { ...base, type: f.type };
}

async function createField(objectId: string, f: FieldDef, objects: Map<string, MetaObject>) {
  await twenty.metadata(
    `mutation($input: CreateOneFieldMetadataInput!) { createOneField(input: $input) { id name } }`,
    { input: { field: fieldInput(objectId, f, objects) } },
  );
}

export async function provisionSchema(log: (m: string) => void = console.log) {
  let objects = await loadObjects();

  for (const o of OBJECTS) {
    if (objects.has(o.nameSingular)) continue;
    log(`+ object ${o.nameSingular}`);
    await twenty.metadata(
      `mutation($input: CreateOneObjectInput!) { createOneObject(input: $input) { id } }`,
      { input: { object: { nameSingular: o.nameSingular, namePlural: o.namePlural, labelSingular: o.labelSingular, labelPlural: o.labelPlural, icon: o.icon, description: o.description } } },
    );
  }
  objects = await loadObjects();

  const ensureFields = async (nameSingular: string, fields: FieldDef[]) => {
    const obj = objects.get(nameSingular);
    if (!obj) throw new Error(`Object ${nameSingular} missing after provisioning`);
    const existing = new Set(obj.fieldsList.map((f) => f.name));
    for (const f of fields) {
      if (existing.has(f.name)) continue;
      log(`  + ${nameSingular}.${f.name} (${f.type})`);
      await createField(obj.id, f, objects);
    }
  };

  for (const o of OBJECTS) await ensureFields(o.nameSingular, o.fields);
  await ensureFields('person', PERSON_FIELDS);
  log('Schema up to date.');
}
