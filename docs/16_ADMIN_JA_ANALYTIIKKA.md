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
  admin-tapahtumien suodatus pois luvuista.

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
- **Poikkeavan käytön perustaso:** hankkeita avanneiden asiakkaiden mediaani ja
  maksimi lasketaan, jotta järjestelmällinen haravointi erottuu kertaluokkana
  eikä muutamana kymmenenä avauksena.

**Opetus, joka toistuu:** mittarin premissi voi vanheta huomaamatta. Työkalun
tuottama luku on avattava lähteestä ennen kuin sen perusteella toimitaan
(ks. [15_TYOMAARA_JA_ARVIO.md](15_TYOMAARA_JA_ARVIO.md) menetelmäajattelu).

---

## Päivityshistoria

- **2026-09-13** — Dokumentti luotu. Kirjattu admin-puolen laajuus (~24 reittiä,
  dashboard, roolit/näkyvyysrajat), analytiikkatyökalun kaksi näkymää ja
  periaatteet, sekä siitä saadut tulokset (D-166 ensimittaus, kirjautumisluvun
  korjaus 17→4 / 350→18, nollarivihälytyksen premissin vanheneminen D-083→D-184,
  kestoraja, poikkeavan käytön perustaso).
