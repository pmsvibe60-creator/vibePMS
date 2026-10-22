(async()=>{
'use strict';
const demo=location.pathname.endsWith('inspection-demo.html');
const token=location.hash.slice(1);
let state,role,busy=false;
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const status=text=>$('status').textContent=text;
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',()=>run(fn));return b;};
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=true);try{await fn();}catch(e){status(e.message+' Your unsaved edits remain on this page.');}finally{busy=false;document.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=false);}}
async function api(action){
 if(demo)return simulate(action);
 const response=await fetch('inspection-api',{method:action?'POST':'GET',headers:{Authorization:'Bearer '+token,...(action?{'Content-Type':'application/json'}:{})},...(action?{body:JSON.stringify(action)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to open report');return data;
}
async function load(){const data=await api();state=data.state;role=data.role;render();status('Latest saved report loaded.');}
async function action(input){const data=await api({revision:state.revision,...input});state=data.state;role=data.role;render();status(input.action==='confirm'?'Your confirmation is recorded.':input.action==='save'?'Progress saved. You can return using this same link.':'Report '+state.status+'.');}
function field(parent,title,input){const label=el('label',title);label.append(input);parent.append(label);return input;}
function input(value,type='text'){const i=el('input');i.type=type;i.value=value;return i;}
function draft(){const content=structuredClone(state.content);content.items.forEach((i,n)=>{i.condition=$('condition-'+n).value;i.value=$('value-'+n).value;i.notes=$('notes-'+n).value;i.disputed=$('disputed-'+n).checked;});content.notes=$('general-notes').value;return content;}
function render(){
 const root=$('report');root.replaceChildren();
 $('description').textContent=state.property+' · '+state.date+' · '+state.kind.replace('-',' ')+' inspection';
 const meta=el('div','','meta');for(const text of [state.status.toUpperCase(),role.toUpperCase()+' LINK',state.mode,'Revision '+state.revision])meta.append(el('span',text,'pill'+(state.status==='confirmed'?' complete':'')));root.append(meta);
 root.append(el('p','Tenant: '+state.tenantName+' · Operator: '+state.operatorName,'notice'));
 if(state.status==='draft')root.append(el('p','Walk through each item, add photos and mark anything you disagree with. Save progress before leaving or switching devices.','notice'));
 if(state.status==='confirmed')root.append(el('div','Both parties confirmed this version. The report is locked; any amendment must be created as a new linked report.','summary'));
 for(const [n,item] of state.content.items.entries()){
  const card=el('section','','card');card.append(el('h2',item.room),el('h3',item.label));
  const before=state.baseline?.content.items.find(i=>i.id===item.id);
  if(before){const prev=el('div','Move-in: '+before.condition+(before.value?' · '+before.value:'')+(before.notes?' · '+before.notes:''),'previous');const photos=el('div','','photos');for(const p of state.baseline.content.photos.filter(p=>p.itemId===item.id)){const img=el('img');img.src=p.data;img.alt=p.caption||'Move-in photo';photos.append(img);}prev.append(photos);card.append(prev);}
  if(state.status==='draft'){
   const grid=el('div','','grid');const select=el('select');select.id='condition-'+n;for(const value of ['unchecked','good','fair','poor','missing','not-applicable']){const o=el('option',value.replaceAll('-',' '));o.value=value;select.append(o);}select.value=item.condition;field(grid,'Condition',select);
   const value=input(item.value);value.id='value-'+n;value.maxLength=2000;field(grid,item.kind==='meter'?'Reading and unit (e.g. 12450 kWh)':item.kind==='keys'?'Keys / quantity':'Quantity or details (optional)',value);card.append(grid);
   const notes=el('textarea');notes.id='notes-'+n;notes.value=item.notes;notes.maxLength=2000;field(card,'Comments / disagreements',notes);
   const dispute=input('','checkbox');dispute.checked=item.disputed;dispute.id='disputed-'+n;field(card,'Flag a disagreement for review',dispute);
   const file=input('','file');file.accept='image/png,image/jpeg';field(card,'Add a photo (PNG or JPEG; maximum 20 per report)',file);
   file.addEventListener('change',()=>run(async()=>{if(!file.files[0])return;if(state.content.photos.length>=20)throw Error('Maximum 20 photos');const data=await resizePhoto(file.files[0]);state.content=draft();state.content.photos.push({id:crypto.randomUUID(),itemId:item.id,caption:item.room+' / '+item.label,data});render();status('Photo added locally. Save progress to upload it.');}));
  }else{card.append(el('p',item.condition+(item.value?' · '+item.value:'')),el('p',item.notes||'No comments'));if(item.disputed)card.append(el('p','Disagreement recorded','dispute'));}
  const photos=el('div','','photos');for(const p of state.content.photos.filter(p=>p.itemId===item.id)){const f=el('figure'),img=el('img');img.src=p.data;img.alt=p.caption;f.append(img,el('figcaption',p.caption));if(state.status==='draft')f.append(button('Remove photo',()=>{state.content=draft();state.content.photos=state.content.photos.filter(x=>x.id!==p.id);render();status('Photo removed locally. Save progress to persist.');}));photos.append(f);}card.append(photos);root.append(card);
 }
 const notes=el('section','','card');notes.append(el('h2','General notes'));if(state.status==='draft'){const t=el('textarea');t.id='general-notes';t.value=state.content.notes;t.maxLength=2000;field(notes,'Anything else to record?',t);}else notes.append(el('p',state.content.notes||'None'));root.append(notes);
 const controls=el('div','','actions sticky');
 if(state.status==='draft'){
  controls.append(button('Save progress',()=>action({action:'save',content:draft()}),'primary'),button('Save & submit for review',async()=>{await action({action:'save',content:draft()});await action({action:'submit'});}));
 }else if(state.status==='review'){
  const review=el('section','','card');review.append(el('h2','Review this exact version'),el('p','Read the report and any disagreements above before confirming. Confirmation records acknowledgement, not agreement to a charge. Names are self-attested; there is no identity verification.'));
  for(const r of ['tenant','operator'])review.append(el('p',r+': '+(state.confirmations[r]?'Confirmed by '+state.confirmations[r].name:'Awaiting confirmation')));
  review.append(el('p','Content SHA-256: '+state.hash,'hash'));
  if(!state.confirmations[role]){const name=input('');field(review,'Type your name exactly: '+(role==='tenant'?state.tenantName:state.operatorName),name);const consent=input('','checkbox');field(review,'I have reviewed this report, including any recorded disagreements.',consent);review.append(button('Confirm as '+role,()=>{if(!consent.checked)throw Error('Please confirm you reviewed the report');return action({action:'confirm',name:name.value,hash:state.hash,consent:true});},'primary'));}
  if(role==='operator'){const reason=input('');reason.maxLength=160;field(review,'Reason for reopening (if changes are needed)',reason);review.append(button('Reopen for corrections',()=>action({action:'reopen',reason:reason.value})));}
  root.append(review);
 }
 controls.append(button('Reload saved version',load));
 controls.append(button(demo?'Print / save demo PDF':'Download PDF',async()=>{if(demo){window.print();return;}const res=await fetch('inspection-report.pdf',{headers:{Authorization:'Bearer '+token}});if(!res.ok)throw Error('Could not export report');const url=URL.createObjectURL(await res.blob());const a=el('a');a.href=url;a.download='inspection.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}));root.append(controls);
 const history=el('details');history.append(el('summary','History and confirmations'));const list=el('ol');for(const a of state.audit)list.append(el('li',a.at+' · '+a.role+' · '+a.action+' · revision '+a.revision));history.append(list);root.append(history);
}
async function resizePhoto(file){
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>12_000_000)throw Error('Choose a PNG/JPEG under 12 MB');
 const image=await createImageBitmap(file);try{for(const max of [1200,900,600,400]){const scale=Math.min(1,max/image.width,max/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/png');if(data.length<=400000)return data;}throw Error('Photo is too detailed. Try a smaller image');}finally{image.close();}
}
let demoState;
function resetDemo(moveOut=false){
 const items=[['Living room','Walls and flooring','condition','good',''],['Kitchen','Oven and appliances','inventory','good','1 oven'],['Hallway','Electricity meter','meter','good','12450 kWh'],['Entrance','Keys handed over','keys','good','2 sets']].map(([room,label,kind,condition,value])=>({id:crypto.randomUUID(),room,label,kind,condition,value,notes:'',disputed:false}));
 demoState={id:'fictional-demo',property:'Flat 4, 24 Willow Mews, London, UK',tenantName:'Alex Morgan',operatorName:'Sam Parker',date:moveOut?'2028-08-31':'2027-09-01',kind:moveOut?'move-out':'move-in',mode:'together',revision:1,status:'draft',content:{items,photos:[],notes:''},confirmations:{},audit:[]};
 if(moveOut){demoState.baseline={content:structuredClone(demoState.content)};demoState.content.items[0].condition='fair';demoState.content.items[0].notes='Small scuff beside the doorway. Please review together.';demoState.content.items[0].disputed=true;demoState.content.items[2].value='13920 kWh';}
 role='tenant';
}
async function simulate(d){
 if(d){if(d.revision!==demoState.revision)throw Error('Reload the latest report');
  if(d.action==='save'){if(demoState.status!=='draft')throw Error('Reopen first');demoState.content=structuredClone(d.content);}
  if(d.action==='submit'){if(demoState.content.items.some(i=>i.condition==='unchecked'||(['meter','keys'].includes(i.kind)&&i.condition!=='not-applicable'&&!i.value.trim())))throw Error('Complete every condition and reading/key count');demoState.status='review';demoState.hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(demoState.content))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
  if(d.action==='confirm'){if(d.name!==(role==='tenant'?demoState.tenantName:demoState.operatorName))throw Error('Enter the name shown for your role');demoState.confirmations[role]={name:d.name};if(demoState.confirmations.tenant&&demoState.confirmations.operator)demoState.status='confirmed';}
  if(d.action==='reopen'){if(role!=='operator'||!d.reason.trim())throw Error('Operator must provide a reason');demoState.status='draft';demoState.confirmations={};}
  demoState.revision++;demoState.audit.push({at:new Date().toISOString(),role,action:d.action,revision:demoState.revision});
 }return {state:structuredClone(demoState),role};
}
if(demo){resetDemo();const box=$('demo');box.hidden=false;box.append(el('p','FICTIONAL DEMO · No server, tenant invitation or real signature. Changes last until reload. Role switching is available only in this demo.'));
 box.append(button('Tenant view',async()=>{role='tenant';await load();}),button('Operator view',async()=>{role='operator';await load();}),button('Reset move-in',async()=>{resetDemo();await load();}),button('Try move-out comparison',async()=>{resetDemo(true);await load();}));}
try{await load();}catch(e){status(e.message);$('description').textContent='Ask the operator for a valid private inspection link.';}
})();
