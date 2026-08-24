-- 2026-08-24 — account_lifecycle_no_delete -funktion kovennus.
-- Jatkoa tiedostolle 2026-07-30_function_hardening.sql. Aja SQL-editorissa.
--
-- TAUSTA. Security Advisor nayttaa nelja varoitusta. Kolme niista on
-- selvitetty eika vaadi toimia:
--
--   * is_team_leader(uuid) ja is_team_member(uuid) — TARKOITUKSELLISIA.
--     Ne ovat SECURITY DEFINER RLS-rekursion valttamiseksi, ja
--     authenticated tarvitsee EXECUTE:n koska RLS-policyt kutsuvat niita.
--     anon on jo peruttu. Runko paattelee kutsujan itse auth.uid():lla,
--     eika ota sita parametrina, joten kayttaja saa tietaa vain oman
--     jasenyytensa. Ei vuoto.
--
--   * Leaked Password Protection — kytkin Auth-asetuksissa, ei SQL.
--
-- Tama tiedosto korjaa neljannen: account_lifecycle_no_delete tehtiin
-- heinakuun kovennuksen JALKEEN, joten se jai kasittelematta.
--
-- RISKI ON OLEMATON, korjaus tehdaan johdonmukaisuuden vuoksi. Funktio on
-- security_definer = false ja sen koko runko on yksi raise exception —
-- se ei viittaa yhteenkaan tauluun, joten asettamaton search_path ei voi
-- johtaa minnekaan. Trigger-funktiota ei myoskaan voi kutsua RPC:na.
-- Samat kaksi lausetta tehtiin heinakuussa muille trigger-funktioille.

alter function public.account_lifecycle_no_delete() set search_path = '';

revoke execute on function public.account_lifecycle_no_delete()
  from public, anon, authenticated;


-- VARMISTUS. Triggeri toimii yha: trigger-mekanismi ei vaadi kutsujalta
-- EXECUTE-oikeutta. Poiston pitaa yha kaatua samaan virheeseen
-- ("account_lifecycle on pysyva loki").
--
-- HUOM: "where false" EI kelpaa testiksi. Rivikohtainen triggeri laukeaa
-- vasta kun rivi oikeasti poistetaan, joten tyhja delete menisi lapi ja
-- antaisi vaaran varmuuden. Testi on tehtava oikealla rivilla ja
-- peruutettava — rollback suojaa vaikka triggeri olisi rikki:
--
--   begin;
--   delete from public.account_lifecycle
--    where id = (select id from public.account_lifecycle limit 1);
--   rollback;
--
-- Advisorin pitaisi tamon jalkeen nayttaa 3 varoitusta: is_team_* (2 kpl,
-- tarkoituksellisia) ja Leaked Password Protection kunnes se kytketaan.
