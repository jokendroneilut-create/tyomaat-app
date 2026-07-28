-- P2 — elinkaari-laukaistut hälytykset: lähetettyjen hälytysten loki + dedup.
-- Aja Supabasen SQL-editorissa. Unique-rajoite estää saman hälytyksen
-- lähettämisen kahdesti samasta (käyttäjä, hanke, vaihe) -yhdistelmästä.
-- Ks. app/api/opportunity-alerts/route.ts.

create table if not exists public.opportunity_alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  phase_key  text not null,
  score      integer,
  sent_at    timestamptz not null default now(),
  unique (user_id, project_id, phase_key)
);

create index if not exists opportunity_alerts_user_idx
  on public.opportunity_alerts (user_id, sent_at desc);
