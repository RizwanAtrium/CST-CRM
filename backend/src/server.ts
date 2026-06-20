import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { scheduleJobs } from './jobs/index.js';

async function main() {
  await connectDatabase();
  scheduleJobs();
  app.listen(env.PORT, () => console.log(`CST CRM API listening on port ${env.PORT}`));
}
main().catch((error) => { console.error(error); process.exit(1); });
