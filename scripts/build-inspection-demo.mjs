import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
for(const name of ['inspection.js','inspection.css'])writeFileSync(new URL('site/'+name,root),readFileSync(new URL('sidecar/src/inspections/public/'+name,root)));
writeFileSync(new URL('site/inspection-demo.html',root),readFileSync(new URL('sidecar/src/inspections/public/inspection.html',root),'utf8').replace('<title>Property handover · vibePMS</title>','<title>Try a property handover · vibePMS demo</title>'));
