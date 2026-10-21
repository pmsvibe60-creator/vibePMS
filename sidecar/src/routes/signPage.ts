import { config } from '../config.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const T = {
  ET: { title: 'Üürilepingu allkirjastamine', intro: 'Palun tutvuge lepinguga. Allkirjastamiseks trükkige oma täisnimi ja joonistage allkiri.',
    name: 'Täisnimi', sig: 'Allkiri', clear: 'Puhasta', consent: 'Olen lepinguga tutvunud ja nõustun selle tingimustega. Mõistan, et see on õiguslikult siduv elektrooniline allkiri.',
    submit: 'Allkirjasta', done: 'Aitäh! Leping on allkirjastatud.', doneNext: 'Allkirjastatud lepingu koopia saadetakse Teile e-postiga.', open: 'Ava PDF uues aknas', role: { tenant: 'Üürnik', landlord: 'Üürileandja' } },
  EN: { title: 'Sign lease agreement', intro: 'Please review the agreement. To sign, type your full name and draw your signature.',
    name: 'Full name', sig: 'Signature', clear: 'Clear', consent: 'I have read the agreement and accept its terms. I understand this is a legally binding electronic signature.',
    submit: 'Sign', done: 'Thank you! The agreement is signed.', doneNext: 'A copy of the signed agreement will be e-mailed to you.', open: 'Open PDF in new window', role: { tenant: 'Tenant', landlord: 'Landlord' } },
};

export function signPageHtml(opts: { token: string; lang: 'ET' | 'EN'; signerName: string; role: 'tenant' | 'landlord'; sha256: string }) {
  const t = T[opts.lang];
  const pdf = `/sign/${opts.token}/document.pdf`;
  return `<!doctype html><html lang="${opts.lang.toLowerCase()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title}</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#111827;--muted:#6b7280;--accent:#1d4ed8;--border:#e5e7eb}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--fg:#e5e7eb;--muted:#9ca3af;--accent:#60a5fa;--border:#2a2f3a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
h1{font-size:22px;margin:0 0 4px}.muted{color:var(--muted);font-size:13px}
iframe{width:100%;height:60vh;border:1px solid var(--border);border-radius:8px;background:#fff}
label{display:block;font-weight:600;margin:14px 0 6px}
input[type=text]{width:100%;padding:10px 12px;font-size:16px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--fg)}
canvas{width:100%;height:180px;border:1px dashed var(--muted);border-radius:8px;background:#fff;touch-action:none}
.row{display:flex;gap:8px;align-items:flex-start;margin-top:14px}.row input{margin-top:4px}
button{padding:12px 18px;font-size:16px;border-radius:8px;border:0;background:var(--accent);color:#fff;cursor:pointer}
button.secondary{background:transparent;color:var(--accent);padding:4px 0;font-size:13px}
button:disabled{opacity:.5;cursor:not-allowed}.err{color:#dc2626;margin-top:10px}
</style></head><body><main>
<div class="card"><h1>${t.title}</h1><div class="muted">${esc(config.OWNER_NAME)} · ${t.role[opts.role]}: ${esc(opts.signerName)}</div>
<p>${t.intro}</p><iframe src="${pdf}" title="PDF"></iframe><p class="muted"><a href="${pdf}" target="_blank" rel="noopener">${t.open}</a> · SHA-256: <code style="word-break:break-all">${opts.sha256}</code></p></div>
<form class="card" id="f">
<label for="n">${t.name}</label><input id="n" type="text" autocomplete="name" required value="">
<label>${t.sig}</label><canvas id="c"></canvas><button type="button" class="secondary" id="clr">${t.clear}</button>
<div class="row"><input type="checkbox" id="ok"><label for="ok" style="font-weight:400;margin:0">${t.consent}</label></div>
<div style="margin-top:16px"><button id="s" disabled>${t.submit}</button></div><div class="err" id="e"></div>
</form>
<div class="card" id="done" hidden><h1>${t.done}</h1><p>${t.doneNext}</p></div>
</main><script>
(()=>{const c=document.getElementById('c'),x=c.getContext('2d');let drawing=false,dirty=false,last=null;
function size(){const r=c.getBoundingClientRect(),d=window.devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;x.scale(d,d);x.lineWidth=2.2;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#111'}
size();const pos=e=>{const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
c.addEventListener('pointerdown',e=>{drawing=true;last=pos(e);c.setPointerCapture(e.pointerId)});
c.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);x.beginPath();x.moveTo(last.x,last.y);x.lineTo(p.x,p.y);x.stroke();last=p;dirty=true;upd()});
['pointerup','pointercancel','pointerleave'].forEach(t=>c.addEventListener(t,()=>drawing=false));
document.getElementById('clr').onclick=()=>{x.clearRect(0,0,c.width,c.height);dirty=false;upd()};
const n=document.getElementById('n'),ok=document.getElementById('ok'),s=document.getElementById('s');
function upd(){s.disabled=!(dirty&&ok.checked&&n.value.trim().length>=3)}n.oninput=upd;ok.onchange=upd;
document.getElementById('f').onsubmit=async ev=>{ev.preventDefault();s.disabled=true;document.getElementById('e').textContent='';
try{const r=await fetch(location.pathname,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({signedName:n.value,signaturePng:c.toDataURL('image/png'),consent:ok.checked})});
const j=await r.json();if(!r.ok)throw new Error(j.error||'Error');document.getElementById('f').hidden=true;document.getElementById('done').hidden=false}
catch(err){document.getElementById('e').textContent=err.message;s.disabled=false}}})();
</script></body></html>`;
}

export function messagePage(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;font:15px/1.5 system-ui,sans-serif;background:#f6f7f9;color:#111827}main{max-width:560px;margin:10vh auto;padding:24px 16px}
@media (prefers-color-scheme:dark){body{background:#0f1115;color:#e5e7eb}}</style></head><body><main><h1>${esc(title)}</h1><p>${esc(body)}</p></main></body></html>`;
}
