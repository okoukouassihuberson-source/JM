-- Sécurité Supabase : l'API REST publique (clé « anon ») expose par défaut le schéma public.
-- On active la protection RLS sur TOUTES les tables, sans aucune politique : l'API publique ne voit rien.
-- L'application se connecte directement à PostgreSQL avec le rôle propriétaire (qui contourne RLS), donc rien ne change pour elle.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
