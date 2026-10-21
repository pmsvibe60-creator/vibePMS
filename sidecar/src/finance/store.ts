import { pool } from '../db.ts';
import { emptyState, type FinanceState } from './engine.ts';
export async function withFinanceState<T>(fn:(state:FinanceState)=>Promise<T>|T):Promise<{revision:number;result:T}>{
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO finance_workspace (id, state) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(emptyState())]);
    const {rows}=await client.query<{state:FinanceState}>('SELECT state FROM finance_workspace WHERE id=1 FOR UPDATE');
    const state=rows[0].state;const revision=state.revision;
    const result=await fn(state);
    if(state.revision!==revision)await client.query('UPDATE finance_workspace SET state=$1::jsonb, updated_at=now() WHERE id=1',[JSON.stringify(state)]);
    await client.query('COMMIT');return {revision:state.revision,result};
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
}
