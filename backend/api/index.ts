import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';

let connection: Promise<void> | undefined;

async function ensureDatabase() {
  if (!connection) {
    connection = connectDatabase().catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  await connection;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    await ensureDatabase();
    return app(request, response);
  } catch (error) {
    console.error('Database connection failed', error);
    const message = error instanceof Error ? error.message : '';
    const code = envCode(message);
    response.statusCode = 503;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ success: false, error: 'Database unavailable', code }));
  }
}

function envCode(message: string) {
  if (/whitelist|IP address|network access/i.test(message)) return 'ATLAS_NETWORK_ACCESS';
  if (/authentication failed|bad auth/i.test(message)) return 'ATLAS_AUTHENTICATION';
  if (/ENOTFOUND|getaddrinfo|querySrv/i.test(message)) return 'ATLAS_DNS';
  return 'DATABASE_CONNECTION';
}
