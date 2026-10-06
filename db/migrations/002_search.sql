create extension if not exists unaccent;
-- unaccent() n'est pas IMMUTABLE ; wrapper pour la recherche insensible aux accents/casse.
create or replace function unaccent_ci(t text) returns text language sql stable as $$ select lower(unaccent(t)) $$;
