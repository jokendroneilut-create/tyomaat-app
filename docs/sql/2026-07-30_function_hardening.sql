-- 2026-07-30 — Funktioiden kovennus (Supabase Security Advisor, WARN-taso).
-- Aja Supabasen SQL-editorissa. Ei kriittinen kuten RLS-korjaus, vaan
-- defense-in-depth. Ks. myös 2026-07-30_enable_rls_exposed_tables.sql.
--
-- Warningit:
--   * function_search_path_mutable: set_updated_at
--   * anon/authenticated_security_definer_function_executable:
--       handle_new_user(), log_project_changes()  = trigger-funktioita
--       is_team_leader(uuid), is_team_member(uuid) = RLS-apufunktioita


-- 1) set_updated_at: kiinnitä search_path (estää search_path-manipuloinnin).
alter function public.set_updated_at() set search_path = '';


-- 2) Trigger-funktiot: peru EXECUTE kaikilta. Triggerit ajavat silti
--    (trigger-mekanismi ei vaadi kutsujalta EXECUTE-oikeutta), joten tämä ei
--    riko mitään mutta poistaa ne RPC-rajapinnasta (/rest/v1/rpc/...).
revoke execute on function public.handle_new_user()   from public, anon, authenticated;
revoke execute on function public.log_project_changes() from public, anon, authenticated;


-- 3) RLS-apufunktiot: peru anonilta. SÄILYTÄ authenticated — RLS-policyt
--    (tiimitaulut) kutsuvat näitä kirjautuneen käyttäjän kontekstissa, joten
--    authenticated tarvitsee EXECUTE:n. Siksi "authenticated can execute"
--    -warning jää näille kahdelle TARKOITUKSELLA (ne ovat SECURITY DEFINER
--    juuri RLS-rekursion välttämiseksi, eikä niitä voi tehdä INVOKERiksi).
revoke execute on function public.is_team_leader(uuid) from public, anon;
revoke execute on function public.is_team_member(uuid) from public, anon;


-- Varmistus: aja tiimitoiminnot läpi kirjautuneena (/team) — jäsenyys ja
-- vastuutukset toimivat yhä. Advisorin pitäisi näyttää enää 2 warningia
-- (is_team_* / authenticated, tarkoituksellinen) + Leaked Password Protection
-- (kytketään erikseen Auth-asetuksista, ei SQL:llä).
