-- KOKEILUJAKSON MUISTUTUSTEN LOKI (D-339)
--
-- Aja tama Supabasen SQL-editorissa. Ohjelmallista DDL:aa ei ole.
--
-- MIKSI OMA TAULU. Muistutus lahtee kerran per tunnus per rajapyykki,
-- ja ainoa luotettava tapa estaa tupla on uniikki avain kannassa --
-- ei koodin muisti. Jos ajo kaatuu kesken, jo kirjatut rivit estavat
-- uusintalahetyksen seuraavalla ajolla.
--
-- TILA KERTOO MYOS SEN MITA EI LAHETETTY. Jos ajo on ollut poikki ja
-- tunnus ohitti kaksi rajapyykkia, lahetetaan vain kiireisin ja vanhempi
-- kirjataan tilaan "ohitettu". Ilman tata se lahtisi seuraavana paivana
-- vanhentuneella luvulla ("jaljella 21 paivaa" kun niita on 13).
--
-- KAYTTOONOTTOA EDELTANEITA RAJAPYYKKEJA EI KIRJATA TANNE. Ne jaavat
-- kokonaan pois koodin saannolla (`ALOITUSPAIVA`), koska Johannes hoitaa
-- ne kasin. Nain taulu kertoo vain sen mita palvelu on oikeasti tehnyt.

create table if not exists public.trial_reminder_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  -- Sahkoposti talteen sellaisena kuin se oli lahetyshetkella: tunnus
  -- voi vaihtaa osoitetta tai poistua, eika loki saa muuttua jalkikateen.
  email text,

  -- Montako paivaa kokeilua oli jaljella RAJAPYYKIN mukaan: 21, 14 tai 7.
  virstanpylvas int not null check (virstanpylvas in (7, 14, 21)),

  -- Montako paivaa oli TODELLA jaljella lahetyshetkella. Sama luku kuin
  -- viestissa; eroaa rajapyykista jos ajo myohastyi.
  paivia_jaljella int,

  tila text not null default 'lahetetty'
    check (tila in ('lahetetty', 'ohitettu')),

  sent_at timestamptz not null default now(),

  -- Tama estaa tuplan.
  unique (user_id, virstanpylvas)
);

create index if not exists trial_reminder_log_sent_at_idx
  on public.trial_reminder_log (sent_at desc);

-- Vain palvelinreitti (service role). Loki kertoo kuka on kokeilussa,
-- eika se kuulu asiakkaalle (vrt. 2026-07-30 RLS-korjaus).
alter table public.trial_reminder_log enable row level security;
revoke all on public.trial_reminder_log from anon, authenticated;

-- Tarkistus:
--   select sent_at, email, virstanpylvas, paivia_jaljella, tila
--   from public.trial_reminder_log
--   order by sent_at desc
--   limit 50;
