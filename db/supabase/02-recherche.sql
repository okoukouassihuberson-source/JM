-- JM POISSONNERIE — étape 2/13 : recherche insensible aux accents
create extension if not exists unaccent;
create or replace function unaccent_ci(t text) returns text language sql stable set search_path = public, extensions as 'select lower(unaccent(t))';
