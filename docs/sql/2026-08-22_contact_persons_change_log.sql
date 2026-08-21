-- Yhteystiedon lisäys näkyväksi hakuvahdille
-- ============================================
--
-- ONGELMA. Hakuvahdin muutosviesti (app/api/digests/route.ts) lukee
-- `project_changes`-taulua, jonka kirjoittaa liipaisin
-- `log_project_changes()`. Se seuraa vain SARAKKEITA, ja yhteyshenkilöt
-- ovat `metadata`-kentän sisällä (`metadata->'contact_persons'`).
--
-- Mitattu 22.8.2026: 36 tunnin aikana syntyi 151 muutosriviä
--
--     79 location   34 name   23 city   10 phase
--      7 developer   7 region   6 property_type   5 builder   1 additional_info
--
-- ja NOLLA riviä metadatasta — vaikka samaan aikaan päivitettiin yli
-- 1 400 hankkeen metadata takautuvissa ajoissa. Asiakas ei siis ole
-- saanut tietoa yhdestäkään jälkikäteen lisätystä yhteyshenkilöstä,
-- vaikka juuri se on hänelle hankkeen arvokkain kenttä
-- (docs/00_PRODUCT_BLUEPRINT.md, kohta 1.1).
--
-- RATKAISU. Erillinen liipaisin `log_contact_persons_change()`, EI
-- muutosta olemassa olevaan `log_project_changes()`-funktioon. Syy:
-- funktion runkoa ei ole repossa, ja CREATE OR REPLACE ilman koko
-- runkoa pudottaisi nykyisen saraketunnistuksen. Tämä on lisäävä.
--
-- VAIN KASVU TIEDOTETAAN. `contact_persons` on vain-lisäävä (D-101),
-- joten rivimäärän kasvu on ainoa kiinnostava muutos. Ilman tätä ehtoa
-- jokainen metadatan kirjoitus (kuvauksen päivitys, luokittelu,
-- takautuva ajo) tuottaisi muutosrivin ja hakuvahti kohisisi.
--
-- Aja Supabasen SQL-editorissa.

create or replace function public.log_contact_persons_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vanhoja int;
  uusia   int;
begin
  vanhoja := coalesce(jsonb_array_length(
    case when jsonb_typeof(old.metadata -> 'contact_persons') = 'array'
         then old.metadata -> 'contact_persons' end), 0);

  uusia := coalesce(jsonb_array_length(
    case when jsonb_typeof(new.metadata -> 'contact_persons') = 'array'
         then new.metadata -> 'contact_persons' end), 0);

  if uusia > vanhoja then
    insert into public.project_changes (project_id, changed_fields, before, after)
    values (
      new.id,
      array['contact_persons'],
      jsonb_build_object('contact_persons', old.metadata -> 'contact_persons'),
      jsonb_build_object('contact_persons', new.metadata -> 'contact_persons')
    );
  end if;

  return new;
end;
$$;

-- Ei RPC-rajapintaan (vrt. docs/sql/2026-07-30_function_hardening.sql).
revoke execute on function public.log_contact_persons_change()
  from public, anon, authenticated;

drop trigger if exists trg_log_contact_persons_change on public.projects;

create trigger trg_log_contact_persons_change
  after update of metadata on public.projects
  for each row
  when (old.metadata is distinct from new.metadata)
  execute function public.log_contact_persons_change();


-- VARMISTUS. Lisää yhteyshenkilö yhdelle hankkeelle ja tarkista että
-- rivi syntyy. Korvaa <id> oikealla hankkeella.
--
--   update public.projects
--      set metadata = jsonb_set(
--            metadata, '{contact_persons}',
--            coalesce(metadata->'contact_persons', '[]'::jsonb)
--              || '[{"name":"Testi Testaaja","email":"","phone":"040 000 0000"}]'::jsonb)
--    where id = '<id>';
--
--   select changed_fields, changed_at
--     from public.project_changes
--    where project_id = '<id>'
--    order by changed_at desc limit 1;
--
-- Muista perua testilisäys jälkikäteen.
