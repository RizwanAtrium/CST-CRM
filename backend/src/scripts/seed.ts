import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { bootstrapDirectorAdmin, defaultServices } from '../services/bootstrap.js';

async function seed(){
  await connectDatabase();
  await bootstrapDirectorAdmin();
  console.log(`Seeded director admin and ${defaultServices.length} services`);
  await disconnectDatabase();
}
seed().catch(async error=>{console.error(error);await disconnectDatabase();process.exit(1);});
