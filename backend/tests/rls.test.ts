import { prisma } from './helpers';

afterAll(() => prisma.$disconnect());

// On Supabase, a table without RLS is readable and writable by anyone holding
// the project's public anon key (through its Data API). Every table must have
// RLS enabled; see migrations/20261026000000_enable_row_level_security.
it('every table has Row Level Security enabled', async () => {
  const tables = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'`;
  expect(tables.length).toBeGreaterThan(10);
  expect(tables.filter(t => !t.relrowsecurity).map(t => t.relname)).toEqual([]);
});
