import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';

const services=['Website','GMB','TikTok','Facebook','Instagram','SEO','Logo/Design','Video Editing','Brand Guidelines','LinkedIn','YouTube Opt','Community Mgmt','Ads Mgmt','Google Ads'];

async function seed(){
  await connectDatabase();
  await User.updateOne({email:env.DIRECTOR_EMAIL.toLowerCase()},{$setOnInsert:{name:'Asad',email:env.DIRECTOR_EMAIL.toLowerCase(),passwordHash:await bcrypt.hash(env.DIRECTOR_PASSWORD,12),role:'DIRECTOR',active:true}},{upsert:true});
  await Service.bulkWrite(services.map(name=>({updateOne:{filter:{name},update:{$setOnInsert:{name,active:true}},upsert:true}})));
  console.log(`Seeded director and ${services.length} services`);
  await disconnectDatabase();
}
seed().catch(async error=>{console.error(error);await disconnectDatabase();process.exit(1);});
