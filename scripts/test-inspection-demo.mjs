import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {strict as assert} from 'node:assert';
const ids=new Map();
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.textContent='';this.value='';this.disabled=false;this.checked=false;}
 set id(value){this._id=value;ids.set(value,this);}get id(){return this._id;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 setAttribute(name,value){this[name]=value;}
 addEventListener(name,handler){this.listeners[name]=handler;}
 click(){if(!this.disabled)this.listeners.click?.();}
}
for(const id of ['demo','description','status','report']){const e=new Element('div');e.id=id;}
const elements=()=>[...ids.values()].flatMap(function descend(e){return [e,...e.children.flatMap(descend)];});
const document={getElementById:id=>ids.get(id),createElement:tag=>new Element(tag),querySelectorAll:()=>elements().filter(e=>['button','input','select','textarea'].includes(e.tag))};
await vm.runInNewContext(readFileSync(new URL('../site/inspection.js',import.meta.url),'utf8'),{document,location:{pathname:'/inspection-demo.html',hash:''},crypto:webcrypto,structuredClone,TextEncoder,URL,Date,window:{print(){}},setTimeout,fetch(){throw Error('Demo must not contact the backend');}});
const click=async text=>{const b=elements().find(e=>e.tag==='button'&&e.textContent===text);assert.ok(b,'Button exists: '+text);b.click();for(let i=0;i<20;i++)await new Promise(resolve=>setImmediate(resolve));};
assert.ok(elements().some(e=>e.tag==='input'&&e.type==='file'&&e.capture==='environment'));
assert.ok(elements().some(e=>e.tag==='input'&&e.type==='file'&&!e.capture));
await click('Save & submit for review');
assert.ok(elements().some(e=>e.textContent==='Review this exact version'));
const fillConfirm=name=>{const labels=elements().filter(e=>e.tag==='label');labels.find(e=>e.textContent.startsWith('Type your name exactly:')).children[0].value=name;labels.find(e=>e.textContent.startsWith('I have reviewed')).children[0].checked=true;};
fillConfirm('Alex Morgan');await click('Confirm as tenant');
await click('Operator view');fillConfirm('Sam Parker');await click('Confirm as operator');
assert.ok(elements().some(e=>e.textContent.startsWith('Both parties confirmed')));
await click('Try move-out comparison');
assert.ok(elements().some(e=>e.textContent.startsWith('Move-in: good')));
assert.equal(ids.get('disputed-0').checked,true);
await click('Save & submit for review');await click('Operator view');
const reason=elements().find(e=>e.tag==='label'&&e.textContent.startsWith('Reason for reopening'));reason.children[0].value='Review scuff with tenant';await click('Reopen for corrections');
assert.ok(elements().some(e=>e.tag==='button'&&e.textContent==='Save progress'));
console.log('Inspection demo: submission, separate confirmations, lock, move-out comparison and reopening passed.');
