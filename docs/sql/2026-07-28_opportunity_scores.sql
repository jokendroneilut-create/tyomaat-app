-- P1 V4 — per-asiakas relevanssipisteet.
-- Aja Supabasen SQL-editorissa (repo ei sisällä migraatioajuria).
-- Kirjoitetaan kysyntähetkellä (kun /today pisteyttää hankkeet), ks.
-- lib/opportunity/persistScores.ts. Pohja P2-hälytyksille + analytiikka.

create table if not exists public.opportunity_scores (
  user_id    uuid not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  score      integer not null,
  phase_key  text,
  reasons    text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index if not exists opportunity_scores_project_idx
  on public.opportunity_scores (project_id);

create index if not exists opportunity_scores_user_score_idx
  on public.opportunity_scores (user_id, score desc);
