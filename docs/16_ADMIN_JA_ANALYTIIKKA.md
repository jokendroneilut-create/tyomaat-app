# Admin-puoli ja käyttäjäanalytiikka

Elävä dokumentti. Kirjaa ylläpitopuolen (admin) kehityksen, käyttäjien
toimintaa mittaavan analytiikkatyökalun ja siitä saadut konkreettiset tulokset.
Päivitetään kun työkaluun tai havaintoihin tulee olennaista uutta — vanhat
tulokset jätetään paikoilleen mittauspäivineen. Liittyy työmäärä- ja
arviodokumenttiin [15_TYOMAARA_JA_ARVIO.md](15_TYOMAARA_JA_ARVIO.md) ja
käyttäjädokumenttiin [10_USERS.md](10_USERS.md).

---

## 1. Admin-puolen kehitys

Ylläpitopuoli on kasvanut omaksi kokonaisuudekseen tuotannon pyörittämistä
varten. Se kattaa (mitattu 2026-09-13):

- **~24 admin-API-reittiä** (`app/api/admin/*`): käyttäjien kutsu
  (`invite-user`), lukitus (`lock-user`), poisto (`delete-user`), roolit
  (`set-user-role`), tiedote kaikille (`send-broadcast`), viestiloki
  (`message-log`), tilin elinkaaren synkronointi (`sync-account-lifecycle`),
  asiakkaan kohdistus myyjälle (`assign-customer`), lähteiden terveystarkistus
  (`health-check`), duplikaattiskannaus (`scan-duplicates`), käyttöhälytys ja
  -trendi (`usage-alert`, `usage-trend`), käyttöhistoria (`user-activity`) sekä
  hankkeiden elinkaaren huoltoajot (`expire-*`, `auto-complete-projects`,
  `advance-effective-zoning`).
- **Dashboard** (`app/dashboard/*`): käyttäjälista (`users`), analytiikka
  (`analytics`) ja viestit (`messages`).
- **Roolit ja näkyvyysrajat:** myyjärooli näkee vain omat asiakkaansa (sama
  `visibleUsers`-funktio listalla ja käyttöhistoriassa), admin näkee kaiken.
  Näkyvyysraja on testattu reittitasolla (`user-activity/route.spec.ts`).
- **Tilin elinkaari:** `account_lifecycle` on pysyvä päiväkirja tunnuksista;
  tilin luontipäivä luetaan `auth.users.created_at`-kentästä, ei
  `profiles`-taulusta.

---

## 2. Analytiikkatyökalu

Mittaa asiakkaiden todellista toimintaa tuotteessa. Lähde on
`analytics_events`-taulu, joka on kerännyt dataa **14.7.2026 alkaen**
(kirjautumiset, sivulataukset, kestot). Työkalu on kaksi näkymää:

**A. Käyttäjäkohtainen ("Käyttö"-nappi käyttäjälistalla)**
Yhden asiakkaan päivittäinen käyttö: kirjautumiset, istunnot, sivut, aika ja
mitä sivuja hän käytti. Tämä on se näkymä jota myyjä tarvitsee asiakastaan
seuratessaan.

**B. Koko joukon analytiikkasivu (`app/dashboard/analytics`)**
Google Analytics -tyylinen yhteenveto. Keskeiset periaatteet
(`lib/analytics/kayttoyhteenveto.ts`):

- **Istunto päätellään, ei kirjata:** taulussa ei ole istuntotunnusta, joten
  uusi istunto alkaa kun edellisestä tapahtumasta on yli **30 min** — sama
  sääntö kuin GA:ssa, jotta luvut luetaan samalla tavalla.
- **Kesto = sivulatausten summa** (aliarvioi hieman; mieluummin liian pieni
  kuin keksitty).
- **Kirjautumiset tiivistetään** samalla 30 min säännöllä (ks. tulos alla).
- Lisäksi: laitejakauma (mobiili/tietokone), lähdelinkin käyttö
  ("Avaa alkuperäinen ilmoitus", kirjaus 17.8.2026 alkaen), **poikkeavan käytön
  tunnistus** (järjestelmällisen haravoinnin havaitseminen perustasoon
  verraten), hankepalaute (👍/👎 alueittain, kokoluokittain, lähteittäin) ja
  oman käytön suodatus pois luvuista.
- **Aktiivinen käyttäjä ≠ kirjautunut käyttäjä (D-204):** päivän "Aktiiviset
  käyttäjät" on tunnusten määrä, jotka tuottivat tapahtumia. Istunto säilyy
  evästeessä yli viikon, joten käyttö ei vaadi uutta kirjautumista eikä
  `auth.users.last_sign_in_at` päivity. Käyttäjälistan *Viimeksi kirjautunut*
  näyttää lisäksi vain viimeisimmän kirjautumisen — se ei ole päiväkohtainen
  lista eikä kelpaa tämän luvun tarkistukseen.
- **Oma käyttö on oma listansa:** rajaus tulee `ADMIN_EMAILS`-listan lisäksi
  `ANALYTICS_EXCLUDE_EMAILS`-muuttujasta ja `user_roles`-taulun admin-riveistä
  (`lib/analytics/omaKaytto.ts`). Erillinen muuttuja siksi, että
  `ADMIN_EMAILS` antaisi myös oikeudet — testitunnus on olemassa asiakkaan
  näkymän katsomista varten.

---

## 3. Analytiikasta saadut tulokset

Konkreettiset havainnot, jotka työkalu on tuottanut (mittauspäivät mukana,
koska luvut ovat piste ajassa):

- **Ensimmäinen 30 vrk mittaus (D-166):** käyttäjiä 43 (+187 %), istuntoja 342
  (+111 %), sivulatauksia 13 205 (−10 %), istunnon keskikesto 27 min (−57 %).
  Taulussa oli tuolloin 36 019 riviä. (Kasvuprosentit ovat pieneltä pohjalta,
  keskikeston lasku ja sivulatausten pieni lasku syytä pitää silmällä.)
- **Kirjautumisluku oli reilusti yliarvioitu:** `login` kirjataan Supabasen
  `SIGNED_IN`-signaalista, joka laukeaa myös istunnon palautuksesta ja
  välilehden avauksesta. Yksi asiakas näytti **17 kirjautumista** päivänä jona
  istuntoja oli 4; 34 tapahtumasta 17 tuli alle minuutin päässä edellisestä,
  neljä samaan sekuntiin. Tiivistys 30 min säännöllä korjasi luvut
  **17 → 4** ja **350 → 18**.
- **Kirjautumista ei voi lukea tapahtumamääränä** — sama havainto laukaisi
  yleisemmän säännön: raaka tapahtumaluku ei ole käyttökerta.
- **Nollarivihälytyksen premissi vanheni (D-083 → D-184):** "tapahtuma ilman
  käyttäjätunnistetta" tarkoitti aiemmin tuntematonta kirjoittajaa, koska yhtään
  tiliä ei ollut poistettu. Kun kokeilutunnusten siivous alkoi 24.8.2026,
  poisto alkoi itse tuottaa nollarivejä (SET NULL, tapahtuma säilyy tilastossa).
  Hälytys muutettiin **erotukseksi** (todellinen − poistoista odotettu), ettei
  se jää pysyvästi päälle.
- **Kestoansa:** yksi tapaus kirjasi 2 131 658 s käyttöaikaa; kesto rajataan nyt
  tuntiin per tapahtuma.
- **Oma käyttö vuoti asiakaslukuihin (D-204, mitattu 20.9.2026):** suodatus
  nojasi yhteen `ADMIN_EMAILS`-osoitteeseen, ja `user_roles`-taulussa oli nolla
  admin-riviä, joten ylläpitäjän kaksi muuta tunnusta laskettiin asiakkaiksi.
  30 vrk jaksolla 27 päivästä **15 näytti 1–2 käyttäjää liikaa**, jakson eri
  käyttäjiä **39 → 37** ja sivulatauksia **3 522 → 3 081 (−14 %)**. Luvut
  korjautuvat tuotannossa vasta kun `ANALYTICS_EXCLUDE_EMAILS` on asetettu.
- **Käyttö ilman kirjautumista on tavallista, ei poikkeus (D-204):** 30 vrk
  jaksolla aktiivisia käyttäjäpäiviä 139, `login`-tapahtumia 115,
  `last_sign_in_at`-osumia samalle päivälle vain 36. Päivänä 20.9. kolme
  asiakasta käytti tuotetta ilman yhtäkään `login`-tapahtumaa.
- **Poikkeavan käytön perustaso:** hankkeita avanneiden asiakkaiden mediaani ja
  maksimi lasketaan, jotta järjestelmällinen haravointi erottuu kertaluokkana
  eikä muutamana kymmenenä avauksena.

**Opetus, joka toistuu:** mittarin premissi voi vanheta huomaamatta. Työkalun
tuottama luku on avattava lähteestä ennen kuin sen perusteella toimitaan
(ks. [15_TYOMAARA_JA_ARVIO.md](15_TYOMAARA_JA_ARVIO.md) menetelmäajattelu).

---

## Päivityshistoria

- **2026-09-20** — Lisätty D-204: aktiivinen käyttäjä ≠ kirjautunut käyttäjä
  (kortin otsikko `Käyttäjät` → `Aktiiviset käyttäjät`), ja oman käytön
  suodatuksen vuoto asiakaslukuihin (39 → 37 käyttäjää, 3 522 → 3 081
  sivulatausta 30 vrk jaksolla). Mittausskripti
  `scripts/diag-analytics-vs-signin.mjs`.
- **2026-09-13** — Dokumentti luotu. Kirjattu admin-puolen laajuus (~24 reittiä,
  dashboard, roolit/näkyvyysrajat), analytiikkatyökalun kaksi näkymää ja
  periaatteet, sekä siitä saadut tulokset (D-166 ensimittaus, kirjautumisluvun
  korjaus 17→4 / 350→18, nollarivihälytyksen premissin vanheneminen D-083→D-184,
  kestoraja, poikkeavan käytön perustaso).
