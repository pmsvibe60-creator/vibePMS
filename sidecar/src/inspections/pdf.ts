import { renderPdf } from '../pdf/render.ts';
import { comparisons, type Inspection } from './model.ts';
import type { Content } from 'pdfmake/interfaces';
export async function inspectionPdf(s:Inspection){
 const content:Content[]=[{text:`${s.kind==='move-in'?'Move-in':'Move-out'} inspection`,style:'title'}, {text:s.property,style:'h2'},{text:`${s.date} | ${s.mode} | ${s.status.toUpperCase()}`},{text:`Tenant: ${s.tenantName}\nOperator: ${s.operatorName}\nReport: ${s.id}\nRevision: ${s.revision}`,margin:[0,8,0,8]}, {text:'Confirmation records acknowledgement of this report, including any disagreements. It does not authorize charges or deposit deductions. Names are self-attested through separate bearer links.',style:'small'}];
 if(s.amendsId)content.push({text:`Amends report ${s.amendsId}`,style:'small'});
 if(s.baseline)content.push({text:`Move-in baseline: ${s.baseline.id}\nBaseline content hash: ${s.baseline.hash}`,style:'small'});
 for(const {current:i,before,changed} of comparisons(s)){
  content.push({text:`${i.room} / ${i.label}`,style:'h2'},{text:`${i.condition}${i.value?' | '+i.value:''}${i.disputed?' | DISAGREEMENT RECORDED':''}`},{text:i.notes||'No comments'});
  if(before)content.push({text:`Move-in: ${before.condition}${before.value?' | '+before.value:''}. ${before.notes}\n${changed?'Changed since move-in':'No recorded change'}`,style:'small'});
  for(const p of s.content.photos.filter(p=>p.itemId===i.id))content.push({stack:[{image:p.data,fit:[350,220],margin:[0,8,0,4]},{text:p.caption||'Inspection photo',style:'small'}],unbreakable:true});
 }
 content.push({text:'General notes',style:'h2'},{text:s.content.notes||'None'},{text:'Confirmations',style:'h2'});
 for(const role of ['tenant','operator'] as const){const c=s.confirmations[role];content.push({text:c?`${role}: ${c.name} | ${c.at}\nContent SHA-256: ${c.hash}`:`${role}: awaiting confirmation`,style:'small'});}
 content.push({text:'History',style:'h2'},...s.audit.map(e=>({text:`${e.at} | ${e.role} | ${e.action} | revision ${e.revision}${e.detail?' | '+e.detail:''}`,style:'small'})));
 return renderPdf({content,footer:(page,total)=>({text:`vibePMS inspection | ${page} / ${total}`,alignment:'center',fontSize:8,margin:[0,15,0,0]})},new Date(s.createdAt));
}
