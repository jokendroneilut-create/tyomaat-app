# Poistumispolut — miten hanke katoaa asiakkaan näkyvistä

Jokaisella poimitulla hankkeella on oltava jokin tapa poistua. Ilman sitä
lista kasvaa yksisuuntaisesti ja myyjä selaa lopulta hankkeita joita ei
ole olemassa.

Tämä dokumentti listaa kaikki poistumispolut, sen mikä laukaisee ne, ja
missä tilanteessa kukin on mitattuna 29.8.2026.

---

## Neljä porttia

Asiakaslista ([app/projects/page.tsx](../app/projects/page.tsx)) hakee vain
julkiset hankkeet ja suodattaa niistä kaksi tilaa:

```ts
.eq('is_public', true)
normalizeLegacyPhase(p.phase) !== 'completed' && p.status !== 'expired'
```

Hanke poistuu näkyvistä siis vain neljällä tavalla:

| # | Portti | Kuka asettaa |
|---|--------|--------------|
| 1 | `phase = Valmistunut` | cron, lähde tai ihminen |
| 2 | `status = expired` | cron tai hyväksyjä |
| 3 | `is_public = false` | ylläpitäjä, kaksoiskappaleen yhdistäminen |
| 4 | rivi poistetaan | vain käsin, ei automaatiota |

---

## Polku per hanketyyppi

### Kilpailutus (248 hanketta)

**Vanhenee ajan myötä.** `expire-tender-projects` (cron 5:30) antaa tilan
`expired` vuoden kuluttua tarjousten määräajasta. Jos voittaja on
selvinnyt, jälki-ilmoitus on jo siirtänyt hankkeen vaiheeseen "Sopimus
myönnetty" eikä se ole enää haarukassa.

Sääntö: [lib/projects/tenderExpiry.ts](../lib/projects/tenderExpiry.ts)

### Rakennushankkeet, joilla on arvioitu valmistuminen (140 hanketta)

**Valmistuu päivämäärän perusteella.** `auto-complete-projects` (cron
5:00) siirtää vaiheeseen "Valmistunut" kun `estimated_completion` on
mennyt. Kenttä poimitaan vapaasta tekstistä ("valmistuu lokakuussa
2026").

### Kaavoitus (2901 hanketta)

**Poistuu kun kaava katoaa kaupungin listalta.**
`expire-unlisted-projects` (cron 5:45) antaa tilan `expired` kun
hankkeen lähdedokumenttia ei ole nähty lähteen sivulla 60
vuorokauteen.

Sääntö ja kynnyksen perustelu:
[lib/projects/unlistedExpiry.ts](../lib/projects/unlistedExpiry.ts)

Tämä polku puuttui kokonaan 29.8.2026 asti: kaavahankkeista 2890 näkyi
asiakkaalle, vanhentuneita oli 0 ja manuaalinen vanhenemispäivä
0:lla. Kaava jäi listalle ikuisesti.

Miksi juuri katoaminen listalta: kaupungin "vireillä olevat" -sivu on se
paikka jossa kaavan elinkaari näkyy. Rivi poistuu kun kaavoitus päättyy
— hyväksyminen, lainvoima, raukeaminen tai sulautuminen toiseen kaavaan.
Poistamisen hetki ei ole säädelty (nähtävilläolot ja kuulutukset ovat,
sivunhoito ei), joten kunnat tekevät sen eri aikaan. Siksi kynnys on
pitkä eikä poistuminen ole peruuttamaton.

### Muut vaiheet (suunnittelu, lupa, rakentaminen — noin 2400 hanketta)

**Ei omaa polkua.** Nämä poistuvat vain jos jokin lähde kertoo
valmistumisen tai ihminen piilottaa hankkeen. Rakentamisvaiheen hanke
päättyy aikanaan, mutta lähde ei yleensä kerro sitä — tämä on tiedossa
oleva aukko, ei ratkaistu asia.

---

## Miksi `last_seen_at` piti lisätä

`updated_at` ei kelpaa mittariksi, ja se ehti johtaa harhaan:

- **Faktojen ja identiteetin poimijat kirjoittavat samaan riviin.**
  `factWorker` ja `identityWorker` päivittävät `updated_at`:n ilman että
  dokumenttia on nähty lähteessä.
- **Osa kerääjistä lukee vain osan listasta kerrallaan.** Oulu lukee 2
  sivua vuorokaudessa, koko kierros noin 10 vuorokautta. Kun katoamisia
  mitattiin `updated_at`:lla, Oulusta näytti kadonneen 39 kaavaa —
  elävää sivua vasten vertailu näytti yhden.

`last_seen_at` kirjoitetaan **vain kerääjästä**, eli silloin kun
dokumentti oikeasti näkyi lähteen listalla. Kenttä jätettiin tyhjäksi
vanhoille riveille: takautuva arvaus olisi juuri se saastunut
`updated_at`. Tyhjä `last_seen_at` ei koskaan vanhenna mitään.

SQL: [docs/sql/2026-08-29_last_seen_at.sql](sql/2026-08-29_last_seen_at.sql)

---

## Suojat väärää vanhentamista vastaan

Vanheneminen on väärä vastaus useammin kuin katoaminen on aito, joten
sääntö kieltäytyy neljässä tilanteessa:

1. **`last_seen_at` on tyhjä** — kenttää ei ole vielä kirjoitettu.
2. **Lähde ei ole terve** — ajon on onnistuttava 3 vrk sisällä JA lähteen
   on täytynyt kirjoittaa jokin dokumentti 7 vrk sisällä. Ilman tätä
   hiljainen lähdevika vanhentaisi koko lähteen kerralla. Liperi ja
   Mänttä-Vilppula olivat juuri tässä tilassa 29.8.2026: onnistunut ajo,
   nolla kirjoitettua dokumenttia.
3. **Rivi on pelkkä listausrivi** (`document_type = "listing"`) — ne
   kirjoitetaan `ignoreDuplicates`-lipulla, joten `last_seen_at` ei
   päivity eikä sen ikä kerro mitään.
4. **Toinen lähde on nähnyt hankkeen** äskettäin.

**Vanheneminen ei ole poisto.** Rivi ja historia säilyvät, ja jos
dokumentti näkyy lähteellä uudelleen, sama cron palauttaa hankkeen
takaisin aktiiviseksi (`revived_at`).

---

## Avoimet aukot

- **Rakentamisvaiheen hankkeille ei ole poistumispolkua.** Noin 2400
  hanketta suunnittelu-, lupa- ja rakentamisvaiheissa jää listalle
  kunnes joku kertoo valmistumisesta.
- **Voimaan tullut kaava jää vaiheeseen "Kaavoitus".** Kerääjä merkitsee
  voimaan tulleen dokumentin valmiiksi käsitellyksi jo kirjoitushetkellä,
  joten jo hyväksytty hanke ei koskaan saa tietoa. Mitattu 29.8.2026: 370
  dokumenttia kertoo voimaantulosta, 130 niistä on meillä hankkeena ja
  127 näkyy yhä vaiheessa "Kaavoitus". Voimaantulo ei ole syy piilottaa —
  se on hetki jolloin rakentaminen tulee mahdolliseksi — vaan syy siirtää
  vaihetta eteenpäin.
- **Kynnys 60 vrk on mitoitettu varmuudella, ei mittauksella.** Kanta on
  kuusi viikkoa vanha, joten todellista katoamisnopeutta ei voi vielä
  laskea. Kynnys kannattaa mitata uudelleen kun `last_seen_at` on
  kerännyt dataa muutaman kuukauden.
