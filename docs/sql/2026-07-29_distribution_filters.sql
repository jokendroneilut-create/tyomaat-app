-- Osa 2: esihenkilön jakosuodattimet tiimin jaettavalle joukolle.
-- Rajaa VAIN jaettavaa poolia (tiiminäkymän "Ei omistajaa" + "Jaa tiimille" /
-- "Ota itselle"). Jo vastuutetut hankkeet pysyvät koskemattomina.
-- Muoto: { "phases": string[], "keyword": string }
-- Ks. app/team/page.tsx (matchesDistribution, handleSaveDistributionFilters).
-- Ajettu Supabasen SQL-editorissa 2026-07-29.

alter table public.teams
  add column if not exists distribution_filters jsonb not null default '{}'::jsonb;
