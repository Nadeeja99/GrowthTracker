-- Supabase exposes every table in `public` through its Data API (PostgREST),
-- authenticated only by the project's public anon key. This app never uses
-- that API: the Express server connects directly through Prisma, as the
-- tables' owner. Enabling Row Level Security with no policies denies all
-- Data API access, while the owner (the app) is unaffected, because table
-- owners bypass RLS.
--
-- New tables need the same: add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
-- to their migration (tests/rls.test.ts fails otherwise).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
