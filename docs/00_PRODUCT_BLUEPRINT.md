Työmaat.fi – Product Blueprint v1.0
1. Purpose

Työmaat.fi helps construction industry companies identify business opportunities as early as possible.

The goal is not to build only a construction project registry. The goal is to build a system that detects, enriches, follows and prioritizes construction-related opportunities throughout their lifecycle.

1.1 Kriittinen tavoite: kolme syytä joiden takia testiasiakkaat eivät jääneet

**Tämä on tuotteen tärkein mittatikku.** Testikäyttäjiltä saadun palautteen
mukaan tilaus jäi tekemättä kolmesta syystä, tässä järjestyksessä:

1. **Liian vähän hankkeita** — kattavuus ei riittänyt siihen että palvelua
   olisi kannattanut seurata päivittäin.
2. **Liian myöhään** — hanke näkyi vasta kun se oli jo kilpailutuksessa tai
   rakenteilla, jolloin myyjä oli myöhässä.
3. **Liian vähän yhteystietoja** — hanke ilman yhteyshenkilöä on
   puolivalmis: käyttäjä tietää että kohde on olemassa, muttei kenelle
   soittaa.

Jokainen uusi lähde, poimija ja ominaisuus on syytä arvioida sitä vasten,
kumpaa näistä kolmesta se parantaa. Jos se ei paranna mitään niistä, se
tuskin ratkaisee sitä miksi asiakas ei maksa.

Nämä eivät ole mielipiteitä vaan syy siihen ettei liikevaihtoa synny, ja
siksi ne ovat tässä dokumentissa eivätkä muistiinpanoissa.

*Nykytila mitattuna 22.8.2026:*

| syy | mittari | tilanne |
|---|---|---|
| hankkeita | hankkeita kannassa | 5 752, kasvu ~150–250 / viikko |
| ajoitus | varhaisin vaihe jossa hanke näkyy | kaava ja rakennuslupa ovat käytössä; ks. D-096 (Lupapisteen PDF paljasti datakeskuksen jota rajapinta ei kertonut) |
| yhteystiedot | näkyviä hankkeita joilla yhteystieto | **4 739 / 5 705 (83,1 %)** — ks. tavoite alla |

**TAVOITE: jokaisella asiakkaalle näkyvällä hankkeella on vähintään yksi
yhteystieto.** Hanke ilman yhteystietoa ei ole myyntivihje vaan uutinen.

*Puute mitattuna 22.8.2026 (`scripts/measure-contact-coverage.ts`):*

```
asiakkaille näkyviä hankkeita          5 705
  ainakin yksi yhteystieto             4 739   83,1 %
  tavoitettava (sposti tai puhelin)    4 590   80,5 %
  nimetty henkilö                      1 184   20,8 %

  EI YHTÄÄN YHTEYSTIETOA                 966   16,9 %
```

*Kehitys 22.8.2026:*

| vaihe | yhteystieto | nimetty henkilö |
|---|---|---|
| lähtötilanne | 1 986 (34,8 %) | – |
| sähköpostiankkuri tiedotteista | 2 756 (48,3 %) | 682 |
| peitetyt osoitteet + puhelinankkuri | 2 941 (51,6 %) | 939 |
| Hilman ilmoitusten osapuolet | 3 099 (54,3 %) | 1 022 |
| Väyläviraston projektipäälliköt (D-103) | 3 222 (56,5 %) | 1 145 |
| kuntien yleiset yhteystiedot (D-104) | 4 709 (82,5 %) | 1 145 |
| Senaatin rakennuttajapäälliköt | **4 739 (83,1 %)** | **1 184** |

Nimettyjen henkilöiden määrä nousi 682 → 1 145 eli **+68 %** — se on
myyjälle arvokkain luku, koska nimetty henkilö on ainoa jolle voi soittaa.

**Huomaa:** yhteystiedon lisääminen jälkikäteen EI tiedota asiakkaalle.
Hakuvahdin muutosseuranta lukee `project_changes`-taulua, jonka kirjoittaa
tietokantaliipaisin `log_project_changes()` — ja se seuraa vain
**sarakkeita**, kun taas `contact_persons` on `metadata`-kentän sisällä.
Mitattu 22.8.2026: 36 tunnin aikana 151 muutosriviä (location, name, city,
phase, developer, region, property_type, builder, additional_info) ja
**nolla riviä metadatasta** — vaikka samaan aikaan päivitettiin yli 1 400
hankkeen metadata. Takautuvat yhteystiedot eivät siis ole tavoittaneet
ketään; korjaus vaatii liipaisimen muutoksen.

Puutteesta valtaosa on lähteitä joissa yhteystietoa ei ole tekstissä
lainkaan (jakauma mitattu ennen viimeisintä ajoa):

```
  459  43 %  käsin luodut
  123  12 %  Hilma
   48   5 %  yva
   35   3 %  Väylävirasto
   33   3 %  Senaatti-kiinteistöt
```

Kunnalliset lähteet (helsinki_paatokset 512, Tampere 119, Lupapiste
110) katosivat listalta kokonaan D-104:n myötä. Jäljellä oleva puute on
luonteeltaan toinen: käsin luodut hankkeet ja yksityiset toimijat,
joille kuntarekisteri ei päde.

Kahdesta luvusta näkee mihin työ kannattaa kohdistaa:

- **222 hanketta** on ilman kuvausta ja lisätietoja — niistä ei voi poimia
  mitään, vaan tieto on haettava lähteestä uudelleen tai lisättävä käsin.
- **1 430 hankkeella osapuoli on tiedossa** (rakennuttaja tai urakoitsija)
  mutta henkilö ei. Näille yrityskohtainen yhteystieto olisi parempi kuin
  ei mitään.

2. Core Vision

Työmaat.fi is a construction market intelligence platform.

It answers three questions:

What has just happened in the construction market?
What is likely to happen next?
Who should act on this information now?

The long-term goal is to show the right opportunity to the right customer at the right time.

3. Product Philosophy

Työmaat.fi should not show everything.

It should reduce noise and surface the most relevant opportunities.

The system should collect broadly, but only promote high-quality and relevant information to users.

4. Primary Customer Value

Customers use Työmaat.fi to:

find projects earlier
identify upcoming tender opportunities
see which companies have won contracts
track projects before competitors notice them
discover relevant companies and contacts
save time by avoiding irrelevant information

The product is valuable when it helps customers win more business or avoid wasted sales effort.

5. Key Product Principle

If a feature does not improve data quality, speed up opportunity discovery, or help customers win more business, it should not be built.

6. Strategic Differentiation

The most valuable asset of Työmaat.fi is not the software itself.

The most valuable asset is the continuously growing Construction Knowledge Base.

This Knowledge Base improves with every:

signal collected
source monitored
candidate project enriched
user decision
customer interaction
market event

Over time, this becomes difficult to copy.

7. Main Concepts
Signal

A signal is a raw market observation.

Examples:

city news item
zoning update
building permit
procurement notice
contractor announcement
project cancellation
tender winner
construction start

Signals are not shown directly to customers by default.

Candidate Project

A Candidate Project is the system’s current best understanding of a possible construction project.

It may contain multiple signals from multiple sources.

Candidate Projects are used internally in Työmaat Intelligence Center before being promoted to public projects.

Project

A Project is a customer-facing construction project published inside Työmaat.fi.

Projects should be cleaner, more reliable and more relevant than raw signals.

Työmaat Intelligence Center (TIC)

TIC is the internal daily command center.

It helps decide:

what requires attention today
which candidates should become projects
which signals are irrelevant
which sources are failing
which market areas are becoming active

TIC is not just an admin page. It is the operational brain of Työmaat.fi.

8. High-Level Flow

The intended long-term flow is:

Discovery Engine
→ Raw Documents
→ Signals
→ Rule Engine
→ Optional AI
→ Identity Resolver
→ Candidate Projects
→ Candidate Enrichment
→ Promotion Engine
→ Projects
→ Customers

9. AI Principle

AI is optional.

The platform must remain functional without AI.

When AI is disabled:

Discovery Engine
→ Rule Engine
→ Review Queue
→ Candidate Projects

When AI is enabled, it should only be used where it clearly adds value.

AI should not be used for every signal by default.

The preferred approach is:

rules first
AI only for uncertain or high-value cases
human review where needed
10. Noise Filtering Principle

The system should collect more information than it shows.

Low-value items such as private home extensions, small garages, terraces, saunas and irrelevant schedule updates may still be stored as signals, but they should not become Candidate Projects or customer-facing Projects unless there is a strong reason.

The goal is:

Collect broadly.
Filter intelligently.
Promote carefully.

11. Candidate Layer Principle

Projects should not be created directly from individual signals.

Instead:

Signal
→ Candidate Project
→ Project

This prevents duplicate projects and allows the system to follow the full lifecycle of a construction opportunity.

A single construction project may appear in:

city news
zoning documents
building permits
procurement notices
contractor announcements
media articles
company websites

These should eventually merge into one Candidate Project.

12. Lifecycle Thinking

A construction project can change over time.

It may be:

early idea
zoning phase
permit phase
tender phase
contractor selected
construction started
paused
cancelled
completed

Työmaat.fi should track the lifecycle, not just the moment when a project is first found.

Cancelled or paused projects are also valuable information.

13. Opportunity Thinking

The same project has different value for different customers.

For example:

architects care about early planning and zoning
contractors care about tenders
subcontractors care about selected main contractors
material suppliers care about construction start and selected contractors
consultants may care about early-stage public investments

The long-term goal is personalized opportunity scoring.

14. TIC Daily Question

TIC should primarily answer:

“What should I do today?”

Examples:

5 signals require your decision
2 high-priority construction opportunities were found
7 tender opportunities opened
3 sources failed last night
data centers are gaining customer attention
12 candidates are ready for review

Lists are secondary. Decisions and actions are primary.

15. Long-Term Product Direction

Työmaat.fi should evolve from:

construction project list

to:

construction market intelligence platform

to:

personalized opportunity engine for construction industry companies.

16. Development Rule

Major architectural decisions should be documented.

The documentation should explain not only what was built, but why it was built.

The docs/ directory is the official project memory.

Future development should follow this rhythm:

design
update docs if needed
implement
test
commit
deploy
17. Current Strategic Milestones
Milestone 1 – Discovery Engine

Status: first version implemented.

Includes:

source registry
generic RSS collector
RSS parser
signal storage
deduplication
Milestone 2 – Intelligence Core

Status: in progress.

Includes:

rule-based classification
Candidate Layer
Candidate Enricher v1
ignored-signal filtering
TIC first version
Milestone 3 – Candidate Dashboard

Status: next focus.

Goal:

TIC shows Candidate Projects instead of raw signals.

Milestone 4 – Promotion Engine

Goal:

Candidate Projects can be promoted into customer-facing Projects.

Milestone 5 – Business Intelligence

Goal:

User behavior, watchlists, CRM activity and customer interest influence opportunity scoring.

18. Guiding Sentence

Työmaat.fi does not aim to show users everything.

Työmaat.fi aims to show the right construction opportunity to the right user at the right time.