import { migrate, pool } from './db.ts';
import { JOBS, runJob } from './jobs.ts';
import { provisionSchema } from './twenty/schema.ts';

const [cmd, arg] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case 'setup':
      await migrate();
      await provisionSchema();
      break;
    case 'job':
      if (!arg || !(arg in JOBS)) throw new Error(`usage: job <${Object.keys(JOBS).join('|')}>`);
      console.log(JSON.stringify(await runJob(arg as keyof typeof JOBS), null, 2));
      break;
    default:
      console.log('usage: tsx src/cli.ts setup | job <name>');
  }
}

main().then(() => pool.end()).catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
