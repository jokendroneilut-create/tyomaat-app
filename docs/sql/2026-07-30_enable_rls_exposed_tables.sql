-- 2026-07-30 — Ota RLS käyttöön 16 taululle, jotka olivat avoimia anon-avaimelle.
--
-- Tausta: Supabase Security Advisor -hälytys (rls_disabled_in_public). Koestettu
-- 2026-07-30 anon-avaimella (kirjautumaton, scripts/diag-rls.mjs) — luettavissa
-- oli mm. projects (4052), project_facts (13112), source_documents (4249),
-- potential_projects (4650), project_imports (3365), project_phase_history (3325)
-- sekä user_today_preferences. Koska RLS oli pois, myös INSERT/UPDATE/DELETE oli
-- auki anon-roolille.
--
-- Aja Supabasen SQL-editorissa (repo ei sisällä migraatioajuria).
-- Peruutus tarvittaessa: alter table public.<taulu> disable row level security;
--
-- service_role (SUPABASE_SERVICE_ROLE_KEY, käytössä API-reiteillä ja agentissa)
-- OHITTAA RLS:n aina — siksi puhtaasti palvelinpuolen taulut tarvitsevat vain
-- 'enable', ei policya. Sovellus lukee selaimesta vain projects + phase_history.
--
-- HUOM: projects- ja project_phase_history-tauluilla oli ENNESTÄÄN salliva policy
-- (lepotilassa kun RLS oli pois). Pelkkä 'enable' aktivoi sen ja jätti anon-luvun
-- auki, joten näiltä poistetaan KAIKKI policyt do-blokilla ja luodaan halutut.
--
-- Luokat:
--   A) projects              — kirjautuneet LUKEVAT; vain admin KIRJOITTAA (dashboard)
--   B) project_phase_history — kirjautuneet LUKEVAT; kirjoitus vain palvelimelta
--   C) 14 taulua             — vain service role (agentti/pipeline/API-reitit)


-- ===================== RLS päälle kaikille 16 =====================
alter table public.projects                     enable row level security;
alter table public.project_phase_history         enable row level security;
alter table public.agent_jobs                   enable row level security;
alter table public.agent_runs                   enable row level security;
alter table public.agent_sources                enable row level security;
alter table public.candidate_projects           enable row level security;
alter table public.discovery_pipeline_runs      enable row level security;
alter table public.discovery_runs               enable row level security;
alter table public.discovery_sources            enable row level security;
alter table public.potential_projects           enable row level security;
alter table public.project_duplicate_candidates enable row level security;
alter table public.project_facts                enable row level security;
alter table public.project_imports              enable row level security;
alter table public.project_signals              enable row level security;
alter table public.source_documents             enable row level security;
alter table public.user_today_preferences       enable row level security;


-- ===== Poista vanhat policyt projects + project_phase_history -tauluilta =====
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('projects', 'project_phase_history')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;


-- ========================= A) projects =========================
-- Kaikki kirjautuneet lukevat (jaettu hankekatalogi). Kirjoitus vain adminille:
-- /dashboard on middlewaressa rajattu ADMIN_EMAILS-käyttäjille ja kirjoittaa
-- selaimesta. Agentin importit tulevat service-rolella ja ohittavat tämän.
create policy "projects_select_authenticated"
  on public.projects for select to authenticated
  using (true);

-- HUOM: pidä sähköpostilista synkassa ADMIN_EMAILS-envin kanssa (tai siirry
-- myöhemmin profiles.is_admin-lippuun ja viittaa siihen tässä policyssa).
create policy "projects_write_admin"
  on public.projects for all to authenticated
  using ( (select auth.jwt() ->> 'email') in ('johannessippola@hotmail.com') )
  with check ( (select auth.jwt() ->> 'email') in ('johannessippola@hotmail.com') );


-- ================= B) project_phase_history =================
-- Kirjautuneet lukevat. Kirjoitus vain lib/projects/recordPhaseChange.ts:n kautta,
-- jota kutsutaan ainoastaan API-reiteistä service-rolella -> ei client-policya.
create policy "pph_select_authenticated"
  on public.project_phase_history for select to authenticated
  using (true);


-- ======================= Varmistus =======================
-- 1) node scripts/diag-rls.mjs  -> kaikkien anon-määrien pitää olla 0.
-- 2) Klikkaa läpi /today /projects /dashboard /tic KIRJAUTUNEENA — datan pitää
--    näkyä normaalisti; admin pystyy yhä muokkaamaan hankkeita dashboardissa.
-- 3) Tarkista Dashboard -> Advisors -> Security muiden mahdollisten taulujen varalta.
