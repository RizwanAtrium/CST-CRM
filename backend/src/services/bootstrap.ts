import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';

export const defaultServices = ['Website','GMB','TikTok','Facebook','Instagram','SEO','Logo/Design','Video Editing','Brand Guidelines','LinkedIn','YouTube Opt','Community Mgmt','Ads Mgmt','Google Ads'];

let bootstrapPromise: Promise<void> | undefined;

export async function bootstrapDirectorAdmin() {
  if (!env.AUTO_SEED_DIRECTOR) return;
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }
  await bootstrapPromise;
}

async function runBootstrap() {
  const email = env.DIRECTOR_EMAIL.toLowerCase();
  const existing = await User.findOne({ email }).select('+passwordHash');
  const passwordHash = await bcrypt.hash(env.DIRECTOR_PASSWORD, 12);

  if (!existing) {
    await User.create({
      name: env.DIRECTOR_NAME,
      email,
      passwordHash,
      role: 'DIRECTOR',
      active: true
    });
  } else {
    existing.name = existing.name || env.DIRECTOR_NAME;
    existing.role = 'DIRECTOR';
    existing.active = true;
    existing.passwordHash = passwordHash;
    await existing.save();
  }

  await Service.bulkWrite(defaultServices.map((name) => ({
    updateOne: {
      filter: { name },
      update: { $setOnInsert: { name, active: true } },
      upsert: true
    }
  })));
}
