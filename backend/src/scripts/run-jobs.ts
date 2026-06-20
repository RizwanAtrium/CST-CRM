import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { runAllJobs } from '../jobs/index.js';

async function main(){await connectDatabase();console.log(await runAllJobs());await disconnectDatabase();}
main().catch(async error=>{console.error(error);await disconnectDatabase();process.exit(1);});
