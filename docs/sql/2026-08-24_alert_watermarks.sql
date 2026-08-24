-- 2026-08-24 — Halytysten vesiraja. Aja Supabasen SQL-editorissa.
--
-- SYY. Tyotilaisuushalytys kaytti kiinteaa 30 tunnin ikkunaa taaksepain
-- nykyhetkesta. Kun yksi ajo jaa valiin, ikkunoiden valiin jaa PYSYVA
-- katve. Niin kavi 24.8.2026 Supabasen 15 tunnin katkossa:
--
--   eilinen ajo  23.8. 08:00 UTC  kattoi  22.8. 02:00 -> 23.8. 08:00
--   24.8. 08:00                   EI AJETTU
--   huominen     25.8. 08:00      kattaa  24.8. 02:00 -> 25.8. 08:00
--                                         ^ 18 tuntia putosi valiin
--
-- Katveeseen jai 54 vaihemuutosta ja 71 hankeilmoitusta kahdeksalle
-- maksavalle asiakkaalle. Ne lahetettiin kasin (?hours=32), mutta vika
-- olisi toistunut jokaisesta tulevasta katkosta.
--
-- Ikkuna alkaa nyt siita mihin edellinen ajo paasi. Sama periaate kuin
-- hakuvahdin last_sent_at-leimassa, joka selvisi samasta katkosta ilman
-- menetyksia. Ks. lib/alerts/window.ts.
--
-- KOODI TOIMII ILMAN TATA TAULUAKIN: jos taulua ei ole, reitti palaa
-- kiinteaan 30 tunnin ikkunaan eli vanhaan kaytokseen. Taman ajaminen
-- vain poistaa katveen.

create table if not exists public.alert_watermarks (
  key               text primary key,
  last_processed_at timestamptz not null,
  updated_at        timestamptz not null default now()
);

comment on table public.alert_watermarks is
  'Mihin asti halytysajo on kasitellyt tapahtumat. Estaa katveen kun ajo jaa valiin.';


-- RLS PAALLE ILMAN POLICYA. Taulua kayttaa vain palvelinpuolen reitti
-- service_role-avaimella, joka ohittaa RLS:n. Ilman policya anon ja
-- authenticated eivat paase riviin kasiksi lainkaan — juuri niin kuin
-- pitaa. Vrt. 2026-07-30_enable_rls_exposed_tables.sql, jossa 16 taulua
-- oli vahingossa auki anon-avaimelle.
alter table public.alert_watermarks enable row level security;

revoke all on public.alert_watermarks from anon, authenticated;


-- Alkuarvo vastaa nykyista kaytosta, jotta ensimmainen ajo tekee saman
-- kuin ennenkin eika hypaha yli tai skannaa liikaa.
insert into public.alert_watermarks (key, last_processed_at)
values ('opportunity_alerts', now() - interval '30 hours')
on conflict (key) do nothing;


-- VARMISTUS.
--   select * from public.alert_watermarks;
--
-- Ensimmaisen oikean ajon (ei dry, ei ?hours) jalkeen last_processed_at
-- pitaa olla sen ajon alkuhetki. Vastauksen windowSource kertoo mita
-- kaytettiin: "watermark" = taulu toimii, "fallback" = taulua ei loydy.
