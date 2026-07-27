# Työmaat.fi – Construction Knowledge Log

## Purpose

This document stores construction market observations, assumptions and expert knowledge before they are converted into rules, inference logic or product features.

The goal is to preserve domain knowledge separately from code.

---

## Format

Each note should include:

- Observation
- Why it matters
- Possible system use
- Confidence
- Status

---

## Notes

### KL-001 – Cibus and Lidl

Observation:
Cibus Nordic Real Estate AB often owns and develops buildings used by Lidl.

Why it matters:
If an early permit or planning document names Cibus as applicant, the final tenant or user may likely be Lidl even if Lidl is not mentioned.

Possible system use:
Entity Extractor detects Cibus.
Inference Engine suggests likely tenant Lidl.

Confidence:
Medium / High

Status:
Candidate for future inference rule.

---

### KL-002 – Customer role depends on customer type

Observation:
Different customer groups need different contacts from the same construction project.

Examples:
- Equipment rental companies often look for project managers or site managers.
- Concrete suppliers often look for procurement managers.
- Architects often look for developers or project owners.
- Building material suppliers often look for procurement or project management contacts.

Why it matters:
The same Candidate Project should be presented differently to different customer profiles.

Possible system use:
Customer Matching Engine recommends the most relevant contact role per customer profile.

Confidence:
High

Status:
Partially represented in customerProfiles.ts.

---

### KL-003 – Kuntien vuokrataloyhtiöiden nimi kertoo kunnan

Observation:
Kuntien vuokrataloyhtiöt rakennuttavat käytännössä vain oman kuntansa alueella,
ja niiden nimi/lyhenne kertoo kunnan luotettavasti. Esim. **VAV** (VAV Asunnot Oy
= Vantaan Vuokra-asunnot) → kaikki hankkeet Vantaalla. Vastaavia: Heka
(Helsinki), TVT (Turku), Espoon Asunnot (Espoo). HUOM: TA/Y-Säätiö, Kojamo/Lumo,
SATO ym. ovat valtakunnallisia (eivät päde) — lisää vain kunnat jotka ovat varmoja.

Why it matters:
Hilma-ilmoituksen työmaan kaupunki puuttuu usein rakenteisesta datasta ja
vapaasta tekstistä (tilaajan osoite = hankintayksikkö, ei työmaa). Tilaajan nimi
on tällöin luotettavin sijaintivihje. Ilman kaupunkia hanke ei näy alueittain
suodatetuissa näkymissä (mm. Tänään).

Possible system use:
`hilmaResolver.ts` → `KNOWN_LOCAL_BUYER_CITIES` -taulukko (sanarajalla `\bvav\b`,
ettei "Nivavaara"/"Rovavaara" osu). Laajennettavissa uusilla varmennetuilla
paikallistoimijoilla. Lisäksi resolveri päättelee kaupungin, jos työmaa on
samalla kadulla kuin tilaajan osoite (kiinteistönomistaja remontoi omaa taloaan).

Confidence:
High (VAV varmistettu käyttäjältä). Uusia yhtiöitä lisättävä vain kun kunta on
varma — valtakunnalliset toimijat eivät päde.

Status:
VAV (Vantaa), Heka (Helsinki), TVT (Turku) ja Espoon Asunnot (Espoo) toteutettu
koodissa; muut lisätään tapauskohtaisesti kun kunta on varma.