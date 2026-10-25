import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/config/database';

// Every table except Prisma's migration history.
export async function resetDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

let counter = 0;

export interface TestUser {
  token: string;
  refreshCookie: string;
  user: { id: string; email: string; timezone: string };
  email: string;
  password: string;
}

export async function registerUser(app: Express, extra: Record<string, unknown> = {}): Promise<TestUser> {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.test`;
  const password = 'correct-horse-9';
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, username: `user${counter}x${Date.now() % 100000}`, password, ...extra });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find(c => c.startsWith('refreshToken='));
  return { token: res.body.data.accessToken, refreshCookie: cookie!.split(';')[0], user: res.body.data.user, email, password };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export { prisma };
