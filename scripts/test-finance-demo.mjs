import { strict as assert } from 'node:assert';
// Minimal DOM harness: exercise the actual demo event handlers and rendered totals.
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.textContent='';this.disabled=false;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(name,handler){this.listeners[name]=handler;}
 click(){if(!this.disabled)this.listeners.click?.();}
}
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(tag){return new Element(tag);}};
await import('../site/finance-demo.js');
const el=id=>elements.get(id);
const metrics=()=>el('finance-metrics').children.map(c=>c.children[1].textContent);
assert.deepEqual(metrics(),['£0','£0','£5,800','£0','£0','£0']);
el('finance-import').click();
assert.deepEqual(metrics(),['£0','£3,600','£5,800','£0','£0','£0']);
const button=row=>row.children.flatMap(c=>c.tag==='button'?[c]:c.children.filter(x=>x.tag==='button'))[0];
button(el('finance-transactions').children[0]).click();
button(el('finance-transactions').children[1]).click();
el('finance-costs').click();
assert.deepEqual(metrics(),['£2,150','£1,450','£3,650','£450','£570','£1,130']);
assert.equal(button(el('finance-transactions').children[2]),undefined,'ambiguous receipt cannot be approved by the demo');
button(el('finance-transactions').children[0]).click();
assert.deepEqual(metrics(),['£700','£2,900','£5,100','£450','£570','-£320']);
assert.ok(el('finance-audit').children.some(e=>e.textContent.includes('allocation reversed')));
el('finance-reset').click();assert.deepEqual(metrics(),['£0','£0','£5,800','£0','£0','£0']);
console.log('Finance demo: import, partial match, uncertainty, costs, reversal and reset passed.');
