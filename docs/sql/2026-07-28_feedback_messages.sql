-- Sovelluksen sisäinen palauteluukku: käyttäjien kirjoittamat palautteet.
-- Aja Supabasen SQL-editorissa. Korvaa aiemman mailto:info@tyomaat.fi-linkin
-- (palaute tallennetaan tänne JA lähetetään Resendillä info@tyomaat.fi).
-- Ks. app/api/feedback/route.ts.

create table if not exists public.feedback_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  context    text,
  message    text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_created_idx
  on public.feedback_messages (created_at desc);
