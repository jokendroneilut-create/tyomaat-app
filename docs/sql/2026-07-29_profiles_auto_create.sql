-- Luo profiles-rivin automaattisesti jokaiselle uudelle auth-käyttäjälle.
-- Ilman tätä profiles-rivi syntyi vain tiimiä luodessa, jolloin muita
-- käyttäjiä ei voinut kutsua tiimiin (kutsu etsii käyttäjän profiles-taulusta
-- sähköpostilla). Ks. app/team/page.tsx handleInviteMember.
-- Ajettu Supabasen SQL-editorissa 2026-07-29. Olemassa olevat 15 puuttuvaa
-- profiilia backfillattiin erikseen scriptillä.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    -- Oikea nimi metadatasta jos on; muuten siisti muotoilu sähköpostin
    -- etuliitteestä: "johannes.sippola" -> "Johannes Sippola".
    coalesce(
      new.raw_user_meta_data->>'full_name',
      initcap(replace(replace(split_part(new.email, '@', 1), '.', ' '), '_', ' '))
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
