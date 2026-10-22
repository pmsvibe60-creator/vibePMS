import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFile } from 'node:fs/promises';
import { accessInspection, createInspection, revokeInspection } from './store.ts';
import { inspectionPdf } from './pdf.ts';
import { pool } from '../db.ts';
export function registerInspections(app:FastifyInstance,admin:(req:FastifyRequest,reply:FastifyReply)=>boolean){
 const headers=(reply:FastifyReply)=>reply.header('Cache-Control','no-store').header('Referrer-Policy','no-referrer').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 for(const [path,file,type] of [['/inspection','inspection.html','text/html'],['/inspection.js','inspection.js','text/javascript'],['/inspection.css','inspection.css','text/css']])app.get(path,async(_req,reply)=>{headers(reply);return reply.type(type).send(await readFile(new URL('./public/'+file,import.meta.url)));});
 app.post('/admin/inspections',async(req,reply)=>{if(!admin(req,reply))return;headers(reply);try{return await createInspection(req.body);}catch(e){return reply.code(400).send({error:(e as Error).message});}});
 app.get('/admin/inspections',async(req,reply)=>{if(!admin(req,reply))return;headers(reply);return (await pool.query("SELECT id,state->>'property' AS property,state->>'date' AS date,state->>'kind' AS kind,state->>'status' AS status FROM inspections ORDER BY state->>'createdAt' DESC LIMIT 100")).rows;});
 app.get<{Params:{id:string}}>('/admin/inspections/:id',async(req,reply)=>{if(!admin(req,reply))return;headers(reply);const row=(await pool.query('SELECT state FROM inspections WHERE id=$1',[req.params.id])).rows[0];return row?row.state:reply.code(404).send({error:'Not found'});});
 app.get<{Params:{id:string}}>('/admin/inspections/:id/report.pdf',async(req,reply)=>{if(!admin(req,reply))return;headers(reply);const row=(await pool.query('SELECT state FROM inspections WHERE id=$1',[req.params.id])).rows[0];if(!row)return reply.code(404).send({error:'Not found'});return reply.type('application/pdf').send(await inspectionPdf(row.state));});
 app.post<{Params:{id:string}}>('/admin/inspections/:id/revoke',async(req,reply)=>{if(!admin(req,reply))return;try{return await revokeInspection(req.params.id);}catch{return reply.code(400).send({error:'Report not found'});}});
 for(const method of ['GET','POST'] as const)app.route({method,url:'/inspection-api',bodyLimit:8_500_000,handler:async(req,reply)=>{
  headers(reply);try{const token=(req.headers.authorization??'').replace(/^Bearer /,'');return await accessInspection(token,method==='POST'?req.body:undefined);}catch(e){return reply.code(400).send({error:(e as Error).message});}
 }});
 app.get('/inspection-report.pdf',async(req,reply)=>{headers(reply);try{const {state}=await accessInspection((req.headers.authorization??'').replace(/^Bearer /,''));return reply.type('application/pdf').header('Content-Disposition','attachment; filename="inspection.pdf"').send(await inspectionPdf(state));}catch{return reply.code(400).send({error:'Cannot export report. Check link validity and photo files.'});}});
}
