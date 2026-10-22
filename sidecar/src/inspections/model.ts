import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
const text = z.string().trim().max(2000);
const label = z.string().trim().min(1).max(160);
const date = z.string().date();
export const itemSchema = z.object({ id:z.string().uuid(), room:label, label, kind:z.enum(['condition','inventory','meter','keys']), condition:z.enum(['unchecked','good','fair','poor','missing','not-applicable']), value:text, notes:text, disputed:z.boolean() }).strict();
export const photoSchema = z.object({id:z.string().uuid(),itemId:z.string().uuid(),caption:z.string().max(300),data:z.string().max(400_000)}).strict();
export const contentSchema = z.object({items:z.array(itemSchema).min(1).max(100),photos:z.array(photoSchema).max(20),notes:text}).strict();
export const createSchema = z.object({property:label,propertyId:label,leaseId:label,tenantName:label,operatorName:label,date,kind:z.enum(['move-in','move-out']),mode:z.enum(['tenant-led','together']),checklist:z.array(z.object({room:label,label,kind:z.enum(['condition','inventory','meter','keys'])}).strict()).min(1).max(100),baselineId:z.string().uuid().optional(),amendsId:z.string().uuid().optional(),expiresInDays:z.number().int().min(1).max(90).default(30)}).strict();
export type Role='tenant'|'operator';
export type Content=z.infer<typeof contentSchema>;
export type Inspection={id:string;property:string;propertyId:string;leaseId:string;tenantName:string;operatorName:string;date:string;kind:'move-in'|'move-out';mode:'tenant-led'|'together';revision:number;status:'draft'|'review'|'confirmed';content:Content;baseline?:{id:string;hash:string;content:Content};amendsId?:string;confirmations:Partial<Record<Role,{name:string;at:string;hash:string}>>;audit:{at:string;role:string;action:string;revision:number;detail:string}[];expiresAt:string;revoked:boolean;createdAt:string;hash?:string};
export function hashContent(s:Inspection){return createHash('sha256').update(JSON.stringify({id:s.id,property:s.property,propertyId:s.propertyId,leaseId:s.leaseId,tenantName:s.tenantName,operatorName:s.operatorName,date:s.date,kind:s.kind,mode:s.mode,baselineId:s.baseline?.id,baselineHash:s.baseline?.hash,amendsId:s.amendsId,content:s.content})).digest('hex');}
export function event(s:Inspection,role:string,action:string,detail=''){s.revision++;s.audit.push({at:new Date().toISOString(),role,action,revision:s.revision,detail});}
export function makeInspection(input:unknown,previous?:Inspection):Inspection{
 const d=createSchema.parse(input);
 if(d.baselineId&&d.amendsId)throw Error('Choose a move-in baseline or an amendment, not both');
 if(d.kind==='move-in'&&d.baselineId)throw Error('Only move-out reports use a move-in baseline');
 if(d.baselineId||d.amendsId){
  if(!previous||previous.status!=='confirmed'||previous.id!==(d.baselineId||d.amendsId)||previous.propertyId!==d.propertyId||previous.leaseId!==d.leaseId)throw Error('Source must be a confirmed report for the same property and lease');
  if(d.baselineId&&(previous.kind!=='move-in'||previous.date>d.date))throw Error('Choose an earlier confirmed move-in report');
  if(d.amendsId&&previous.kind!==d.kind)throw Error('Amendment must use the same inspection type');
 }
 const content:Content=d.amendsId?structuredClone(previous!.content):{items:d.checklist.map(i=>({...i,id:randomUUID(),condition:'unchecked',value:'',notes:'',disputed:false})),photos:[],notes:''};
 // Reuse stable baseline item IDs to make comparison unambiguous.
 if(d.baselineId) content.items=previous!.content.items.map(i=>({...i,condition:'unchecked',value:'',notes:'',disputed:false}));
 const s:Inspection={id:randomUUID(),property:d.property,propertyId:d.propertyId,leaseId:d.leaseId,tenantName:d.tenantName,operatorName:d.operatorName,date:d.date,kind:d.kind,mode:d.mode,revision:0,status:'draft',content,confirmations:{},audit:[],expiresAt:new Date(Date.now()+d.expiresInDays*86400000).toISOString(),revoked:false,createdAt:new Date().toISOString(),...(d.amendsId?{amendsId:d.amendsId,baseline:previous!.baseline}:{}),...(d.baselineId?{baseline:{id:previous!.id,hash:previous!.hash!,content:structuredClone(previous!.content)}}:{})};
 event(s,'operator','created');return s;
}
export function validateContent(raw:unknown,s:Inspection):Content{
 const c=contentSchema.parse(raw);
 if(c.items.length!==s.content.items.length||c.items.some((i,n)=>['id','room','label','kind'].some(k=>i[k as keyof typeof i]!==s.content.items[n][k as keyof typeof i])))throw Error('Checklist identity cannot change through a shared link');
 if(new Set(c.photos.map(p=>p.id)).size!==c.photos.length)throw Error('Duplicate photo IDs');
 for(const p of c.photos){
  if(!c.items.some(i=>i.id===p.itemId))throw Error('Photo must belong to a checklist item');
  if(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.data))throw Error('Photos must be PNG images');
  const b=Buffer.from(p.data.split(',')[1],'base64');
  if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(16)<1||b.readUInt32BE(20)<1||b.readUInt32BE(16)>1600||b.readUInt32BE(20)>1600)throw Error('Invalid photo or image dimensions exceed 1600 pixels');
 }
 return c;
}
export const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('save'),revision:z.number().int(),content:contentSchema}).strict(),
 z.object({action:z.literal('submit'),revision:z.number().int()}).strict(),
 z.object({action:z.literal('reopen'),revision:z.number().int(),reason:label}).strict(),
 z.object({action:z.literal('confirm'),revision:z.number().int(),name:label,hash:z.string().length(64),consent:z.literal(true)}).strict(),
]);
export function act(s:Inspection,role:Role,raw:unknown){
 const d=actionSchema.parse(raw);
 if(s.revoked||Date.parse(s.expiresAt)<=Date.now())throw Error('Link expired or revoked');
 if(d.revision!==s.revision)throw Error('Report changed. Reload and review the latest version.');
 if(s.status==='confirmed')throw Error('Confirmed reports are locked. Create an amendment.');
 if(d.action==='save'){
  if(s.status!=='draft')throw Error('Reopen the report before editing');
  s.content=validateContent(d.content,s);event(s,role,'saved');
 }else if(d.action==='submit'){
  if(s.status!=='draft')throw Error('Report is already under review');
  if(s.content.items.some(i=>i.condition==='unchecked'||(['meter','keys'].includes(i.kind)&&i.condition!=='not-applicable'&&!i.value.trim())))throw Error('Complete every condition and enter readings/key counts, or mark not applicable');
  s.status='review';s.hash=hashContent(s);event(s,role,'submitted');
 }else if(d.action==='reopen'){
  if(role!=='operator'||s.status!=='review')throw Error('Only the operator can reopen a report under review');
  s.status='draft';s.confirmations={};delete s.hash;event(s,role,'reopened',d.reason);
 }else{
  if(s.status!=='review'||d.hash!==s.hash||hashContent(s)!==d.hash)throw Error('Review the submitted report before confirming');
  if(s.confirmations[role])throw Error('This role has already confirmed');
  if(d.name.trim()!==(role==='tenant'?s.tenantName:s.operatorName))throw Error('Enter the name shown for your role');
  s.confirmations[role]={name:d.name,at:new Date().toISOString(),hash:d.hash};event(s,role,'confirmed',d.hash);
  if(s.confirmations.tenant&&s.confirmations.operator)s.status='confirmed';
 }
 return s;
}
export function comparisons(s:Inspection){return s.content.items.map(i=>({current:i,before:s.baseline?.content.items.find(b=>b.id===i.id),changed:!!s.baseline&&JSON.stringify([i.condition,i.value,i.notes])!==JSON.stringify((()=>{const b=s.baseline!.content.items.find(b=>b.id===i.id);return [b?.condition,b?.value,b?.notes];})())}));}
