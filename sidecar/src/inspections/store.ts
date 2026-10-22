import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../db.ts';
import { config } from '../config.ts';
import { createSchema, makeInspection, act, event, type Inspection, type Role } from './model.ts';
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function createInspection(raw:unknown){
 const d=createSchema.parse(raw);let previous:Inspection|undefined;
 if(d.baselineId||d.amendsId)previous=(await pool.query('SELECT state FROM inspections WHERE id=$1',[d.baselineId||d.amendsId])).rows[0]?.state;
 const state=makeInspection(d,previous),tenant=randomBytes(32).toString('hex'),operator=randomBytes(32).toString('hex');
 await pool.query('INSERT INTO inspections(id,state,tenant_hash,operator_hash) VALUES($1,$2,$3,$4)',[state.id,JSON.stringify(state),digest(tenant),digest(operator)]);
 const url=config.PUBLIC_URL.replace(/\/$/,'')+'/inspection#';
 return {id:state.id,revision:state.revision,expiresAt:state.expiresAt,tenantUrl:url+tenant,operatorUrl:url+operator,note:'Private bearer links: share the tenant link only with the tenant. Names are self-attested; link possession is not identity verification.'};
}
export async function accessInspection(token:string,action?:unknown){
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid inspection link');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const hash=digest(token);
  const row=(await client.query('SELECT state,tenant_hash FROM inspections WHERE tenant_hash=$1 OR operator_hash=$1 FOR UPDATE',[hash])).rows[0];
  if(!row)throw Error('Invalid inspection link');
  const state:Inspection=row.state,role:Role=row.tenant_hash===hash?'tenant':'operator';
  if(state.revoked||Date.parse(state.expiresAt)<=Date.now())throw Error('Link expired or revoked');
  if(action){act(state,role,action);await client.query('UPDATE inspections SET state=$1 WHERE id=$2',[JSON.stringify(state),state.id]);}
  await client.query('COMMIT');return {state,role};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function revokeInspection(id:string){
 const client=await pool.connect();try{
  await client.query('BEGIN');const row=(await client.query('SELECT state FROM inspections WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)throw Error('Report not found');
  const s:Inspection=row.state;s.revoked=true;event(s,'operator','links_revoked');await client.query('UPDATE inspections SET state=$1 WHERE id=$2',[JSON.stringify(s),id]);await client.query('COMMIT');return {id,revoked:true};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
