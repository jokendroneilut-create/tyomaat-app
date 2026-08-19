import Link from "next/link"

export const dynamic = "force-dynamic"

/*
 * Käyttäjän ohjeet.
 *
 * YKSI SIVU, EI ALISIVUJA. Yhdeltä sivulta löytää selaimen haulla, se ei
 * vaadi navigaatiota eikä siihen eksy. Jako alisivuiksi on helppo tehdä
 * myöhemmin jos sivu kasvaa liian pitkäksi.
 *
 * EI KUVAKAAPPAUKSIA. Ne vanhenevat jokaisessa käyttöliittymämuutoksessa —
 * Tänään-näkymän yläosa muuttui kolmesti yhden työpäivän aikana. Teksti
 * kuvaa siksi toimintaa, ei ulkoasua.
 *
 * Kirjautuminen vaaditaan (ks. middleware.ts): sivu kertoo mitä lähteitä ja
 * logiikkaa palvelu käyttää, eikä sitä ole syytä näyttää ulospäin.
 */

const SECTIONS = [
  { id: "mika", title: "Mikä Työmaat.fi on" },
  { id: "tanaan", title: "Tänään-näkymä" },
  { id: "mukauta", title: "Mukauta näkymää" },
  { id: "kartta", title: "Kartta ja haku" },
  { id: "hakuvahdit", title: "Hakuvahdit" },
  { id: "omat", title: "Omat: suosikit ja merkinnät" },
  { id: "tehtavat", title: "Tehtävät" },
  { id: "tiimi", title: "Tiiminäkymä" },
  { id: "ilmoitukset", title: "Ilmoitukset ja sähköpostit" },
  { id: "rikastuminen", title: "Hankkeet rikastuvat ajan myötä" },
  { id: "tiedot", title: "Hankkeen tiedot ja niiden alkuperä" },
  { id: "ukk", title: "Usein kysyttyä" },
  { id: "palaute", title: "Palaute ja yhteydenotto" },
]

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-10 scroll-mt-6 border-t border-gray-200 pt-6 text-xl font-bold text-gray-900"
    >
      {children}
    </h2>
  )
}

export default function OhjeetPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900">Ohjeet</h1>

      <p className="mt-2 text-gray-600">
        Miten Työmaat.fi toimii ja mitä sen eri osilla tekee.
      </p>

      <nav className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-900">Sisältö</p>

        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={"#" + section.id}
                className="text-blue-700 underline-offset-2 hover:underline"
              >
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="text-[15px] leading-relaxed text-gray-800">
        <H id="mika">1. Mikä Työmaat.fi on</H>

        <p className="mt-3">
          Työmaat.fi kokoaa Suomen rakennushankkeet yhteen paikkaan ja nostaa
          niistä esiin ne, jotka ovat yrityksellesi myynnin kannalta
          ajankohtaisia. Tarkoitus on, että näet hankkeen oikea-aikaisesti
          silloin kun on paras ajankohta olla yhteydessä. Lisäksi voit selailla
          hankkeita karttanäkymässä ja suodattaa niitä haluamallasi tavalla.
        </p>

        <p className="mt-3">
          Tiedot kerätään julkisista lähteistä: kuntien kaavoitus- ja
          lupapäätöksistä, hankintailmoituksista, YVA-menettelyistä,
          viranomaisten hankesivuilta sekä rakennusliikkeiden ja
          suunnittelutoimistojen omista tiedotteista ja projektisivuilta.
          Lähteitä on satoja, ja niitä lisätään jatkuvasti.
        </p>

        <p className="mt-3">
          Palvelu ei ole tarjouslaskentaohjelma eikä CRM. Se kertoo mitä on
          tulossa ja kenelle kannattaa olla yhteydessä.
        </p>

        <H id="tanaan">2. Tänään-näkymä</H>

        <p className="mt-3">
          Tänään on etusivu, joka nostaa esiin päivän kiinnostavimmat hankkeet
          asetustesi mukaan. Se on valikoima, ei koko hankelista — koko lista
          löytyy kohdasta <strong>Hankkeet / Kartta</strong>.
        </p>

        <p className="mt-3">
          Jokaisella hankekortilla on <strong>osuma-prosentti</strong>. Se
          kertoo kuinka hyvin hanke sopii sinulle: mukana ovat toimialasi ja
          roolisi, hankkeen vaihe suhteessa siihen milloin sinun kannattaa olla
          yhteydessä, sijainti valitsemillasi alueilla sekä hankkeen koko ja
          tuoreus. Korkea prosentti ei tarkoita että hanke on iso, vaan että se
          on <em>sinulle</em> ajankohtainen.
        </p>

        <p className="mt-3">
          👍👎 <strong>Peukut ovat tärkein tapa parantaa näkymää.</strong> Kun
          annat hankkeelle peukun alas, kerrot ettei tämänkaltainen hanke ole
          sinulle relevantti, ja vastaavat hankkeet laskevat listalla. Peukku
          ylös toimii samoin toiseen suuntaan. Muutama peukku päivässä riittää;
          näkymä tarkentuu sitä mukaa.
        </p>

        <H id="mukauta">3. Mukauta näkymää</H>

        <p className="mt-3">
          <strong>Mukauta näkymää</strong> -napista asetat neljä asiaa, ja ne
          ohjaavat kaikkea mitä Tänään näyttää:
        </p>

        <ul className="mt-3 space-y-2">
          <li>
            <strong>Rooli ja toimiala</strong> — mitä yrityksesi tekee.
            Aliurakoitsija, konevuokraaja ja suunnittelutoimisto tarvitsevat
            hankkeen eri vaiheessa, joten tämä vaikuttaa eniten.
          </li>
          <li>
            <strong>Myyntihetket</strong> — missä vaiheessa haluat kuulla
            hankkeesta. Kaavoitusvaihe on vuosia ennen urakkaa; rakennuslupa tai
            urakkakilpailu on lähempänä kauppaa.
          </li>
          <li>
            <strong>Alueet</strong> — maakunnat joilla toimit.
          </li>
          <li>
            <strong>Tietolähteet</strong> — mistä hankkeet saa näkyviin.
          </li>
        </ul>

        <p className="mt-3">
          Asetukset kannattaa käydä läpi kerran huolella. Jos näkymä tuntuu
          osumattomalta, syy on useimmiten liian laajassa aluevalinnassa tai
          siinä että myyntihetkiä on valittu liikaa.
        </p>

        <H id="kartta">4. Kartta ja haku</H>

        <p className="mt-3">
          <strong>Hankkeet / Kartta</strong> näyttää kaikki hankkeet kartalla ja
          listana. Voit rajata näkymää alueen, vaiheen, kohdetyypin ja hankkeen
          koon mukaan. Kartta on hyvä silloin kun mietit tiettyä aluetta; haku
          silloin kun etsit tiettyä hanketta tai yritystä.
        </p>

        <p className="mt-3">
          Hankkeen avaamalla näet sen tiedot, osapuolet ja linkin alkuperäiseen
          ilmoitukseen. Lähdelinkkiä kannattaa käyttää aina ennen yhteydenottoa
          — siellä on usein enemmän kuin mitä olemme poimineet.
        </p>

        <H id="hakuvahdit">5. Hakuvahdit</H>

        <p className="mt-3">
          Hakuvahti on tallennettu haku, joka ilmoittaa sähköpostilla kun
          ehtoihin osuu uusia hankkeita tai seuraamaasi hankkeeseen tulee uutta
          tietoa. Voit valita päivittäisen tai viikoittaisen tahdin.
        </p>

        <H id="omat">6. Omat: suosikit ja merkinnät</H>

        <p className="mt-3">
          <strong>Omat</strong> kokoaa hankkeet, jotka olet ottanut seurantaan.
          Hankkeen voi lisätä suosikiksi, ja sille voi antaa{" "}
          <strong>merkinnän</strong> myynnin tilasta — esimerkiksi{" "}
          <em>kontaktoitu</em> tai <em>tarjous lähetetty</em>.
        </p>

        <p className="mt-3">
          Merkinnät ovat henkilökohtaisia, ellet käytä tiiminäkymää. Ne ovat
          muistiksi siitä missä vaiheessa olet kunkin hankkeen kanssa, eivät
          korvaamassa varsinaista CRM-järjestelmää.
        </p>

        <H id="tehtavat">7. Tehtävät</H>

        <p className="mt-3">
          <strong>Tehtävät</strong> on yksinkertainen muistilista: voit lisätä
          omia tehtäviä, merkitä ne tehdyiksi ja poistaa. Se sopii hankkeisiin
          liittyviin muistutuksiin, mutta tehtäviä ei ole sidottu yksittäiseen
          hankkeeseen.
        </p>

        <H id="tiimi">8. Tiiminäkymä</H>

        <p className="mt-3">
          Tiiminäkymä on sitä varten, ettei kaksi myyjää ole yhteydessä samaan
          hankkeeseen eikä yksikään hanke jää ilman hoitajaa. Hankkeille
          asetetaan omistaja, ja jokainen näkee kuka hoitaa mitäkin.
        </p>

        <p className="mt-4 font-semibold text-gray-900">Jos olet esihenkilö</p>

        <ul className="mt-2 space-y-2">
          <li>
            <strong>Luot tiimin</strong> ja lisäät jäsenet
            sähköpostiosoitteella.
          </li>
          <li>
            <strong>Jaat hankkeet</strong> valitsemalla kullekin omistajan.
            Jakaa voi käsin yksi kerrallaan tai isompina kertaerinä, jolloin
            järjestelmä jakaa hankkeet satunnaisesti mutta tasaisesti tiimin
            kesken. Omistajan voi vaihtaa milloin tahansa.
          </li>
          <li>
            <strong>Asetat jakosuodattimet</strong> tiimin asetuksista: mitkä
            alueet ja vaiheet kuuluvat tiimin vastuulle. Näin &quot;ilman
            omistajaa&quot; -lista näyttää vain ne hankkeet joilla on teille
            merkitystä.
          </li>
          <li>
            <strong>Seuraat kattavuutta</strong> — näet montako hanketta on
            jaettu, montako on ilman omistajaa ja miten työ jakautuu jäsenten
            kesken.
          </li>
          <li>
            <strong>Poistat jäseniä</strong> tarvittaessa.
          </li>
        </ul>

        <p className="mt-4 font-semibold text-gray-900">Jos olet tiimin jäsen</p>

        <ul className="mt-2 space-y-2">
          <li>
            <strong>Näet omat hankkeesi</strong> suodattimella, joka näyttää
            vain sinulle osoitetut. Se on käytännössä oma työlistasi.
          </li>
          <li>
            <strong>Näet kuka hoitaa muut hankkeet</strong>, joten tiedät
            kenelle viedä tieto eteenpäin jos kuulet jotain.
          </li>
          <li>
            <strong>Et voi vaihtaa omistajaa</strong> — sen tekee esihenkilö.
            Jos hanke kuuluisi sinulle tai et pysty hoitamaan omaasi, pyydä
            esihenkilöä muuttamaan omistajuus.
          </li>
          <li>
            Suosikit, merkinnät ja tehtävät ovat tiimissäkin henkilökohtaisia.
          </li>
        </ul>

        <H id="ilmoitukset">9. Ilmoitukset ja sähköpostit</H>

        <p className="mt-3">
          Palvelu lähettää kahdenlaista postia: <strong>hakuvahtien</strong>{" "}
          ilmoituksia ja tiedon siitä jos joku hanke etenee sinulle otolliseen
          ajankohtaan. Jälkimmäinen ilmoitus perustuu Tänään-näkymässä antamiisi
          asetuksiin. Molempien tahdin ja sen, tuleeko niitä lainkaan, säädät
          kohdasta <strong>Asetukset → Ilmoitukset</strong>.
        </p>

        <p className="mt-3">
          Jos postia tulee liikaa, harvenna tahtia ennen kuin suljet sen
          kokonaan — viikoittainen kooste on useimmille sopiva.
        </p>

        <H id="rikastuminen">10. Hankkeet rikastuvat ajan myötä</H>

        <p className="mt-3">
          Hanke ei ole valmis silloin kun se ilmestyy palveluun. Sama hanke
          näkyy tyypillisesti useassa lähteessä eri aikoina: ensin
          kaavoituspäätöksenä, myöhemmin rakennuslupana, sitten
          hankintailmoituksena ja lopulta urakoitsijan omana tiedotteena.
          Jokainen näistä tuo mukanaan jotain uutta.
        </p>

        <p className="mt-3">
          Kun uutta tietoa tulee, se{" "}
          <strong>täydennetään olemassa olevaan hankkeeseen</strong> — ei luoda
          uutta hanketta. Käytännössä avaamasi hanke voi näyttää parin viikon
          päästä erilaiselta: rakennuttaja on tarkentunut, pääurakoitsija on
          selvinnyt, kustannusarvio tai aikataulu on ilmestynyt, vaihe on
          edennyt suunnittelusta rakentamiseen.
        </p>

        <p className="mt-3">
          Tästä seuraa kaksi käytännön asiaa. Ensinnäkin{" "}
          <strong>
            tyhjä kenttä tänään ei tarkoita ettei tietoa koskaan tule
          </strong>{" "}
          — kiinnostava hanke kannattaa lisätä suosikkeihin ja palata siihen.
          Toiseksi hanke kannattaa avata uudelleen ennen yhteydenottoa, koska
          osapuolet ovat voineet tarkentua sen jälkeen kun näit sen viimeksi.
        </p>

        <H id="tiedot">11. Hankkeen tiedot ja niiden alkuperä</H>

        <p className="mt-3">
          Kaikki tiedot on poimittu julkisista lähteistä, ja jokaisella
          hankkeella on linkki alkuperäiseen ilmoitukseen. Poiminta tehdään
          koneellisesti, ja se noudattaa yhtä periaatetta:{" "}
          <strong>mieluummin tyhjä kenttä kuin väärä tieto</strong>.
        </p>

        <p className="mt-3">
          Siksi näet tyhjiä kenttiä. Jos esimerkiksi rakennuttaja on tekstissä
          muodossa, jota ei voi tulkita yksiselitteisesti, kenttä jätetään
          tyhjäksi sen sijaan että arvattaisiin. Arvattu yritysnimi olisi
          pahempi kuin puuttuva: sen varassa oltaisiin yhteydessä väärään
          paikkaan, eikä virhettä huomaisi kukaan.
        </p>

        <p className="mt-3">
          <strong>Jos huomaat virheellisen tiedon</strong>, kerro siitä. Virheen
          korjaaminen parantaa kaikkien käyttäjien palvelua.
        </p>

        <H id="ukk">12. Usein kysyttyä</H>

        <p className="mt-4 font-semibold text-gray-900">
          Tiedän hankkeen, mutta sitä ei löydy palvelusta. Miksi?
        </p>
        <p className="mt-1">
          Todennäköisimmin sen lähdettä ei vielä seurata. Yksityiset hankkeet
          ovat vaikeimpia: ne eivät välttämättä näy hankintailmoituksissa,
          kunnan päätöksissä eivätkä kaavoissa. Kerro puuttuvasta hankkeesta,
          niin selvitämme mistä sen olisi voinut löytää — juuri näin uusia
          lähteitä on löytynyt.
        </p>

        <p className="mt-4 font-semibold text-gray-900">
          Sama hanke näkyy kahteen kertaan.
        </p>
        <p className="mt-1">
          Kahdesta lähteestä tullut hanke pyritään yhdistämään automaattisesti,
          mutta jos esimerkiksi kaupunki on kirjattu eri tavalla, yhdistäminen
          voi jäädä tekemättä. Ilmoita tuplasta, niin ne yhdistetään ja tiedot
          siirtyvät samalle riville.
        </p>

        <p className="mt-4 font-semibold text-gray-900">
          Kuinka tuoretta tieto on?
        </p>
        <p className="mt-1">
          Lähteitä käydään läpi jatkuvasti, ja uusi hanke ilmestyy tyypillisesti
          muutaman vuorokauden sisällä siitä kun se on julkaistu lähteessä. Osaa
          lähteistä päivitetään harvemmin kuin toisia.
        </p>

        <p className="mt-4 font-semibold text-gray-900">
          Miksi Tänään näyttää vähän hankkeita?
        </p>
        <p className="mt-1">
          Tänään on valikoima, ei koko lista. Jos hankkeita on liian vähän,
          laajenna alueita tai myyntihetkiä kohdasta{" "}
          <strong>Mukauta näkymää</strong>. Koko hankekanta on aina saatavilla
          kohdassa <strong>Hankkeet / Kartta</strong>.
        </p>

        <H id="palaute">13. Palaute ja yhteydenotto</H>

        <p className="mt-3">
          <strong>Palaute on tämän palvelun tärkein kehitystyökalu.</strong>{" "}
          Jokainen <strong>Anna palautetta</strong> -napin kautta tullut viesti
          luetaan, ja iso osa parannuksista on lähtenyt liikkeelle yhden
          käyttäjän huomiosta.
        </p>

        <p className="mt-3">Kannattaa kertoa erityisesti näistä:</p>

        <ul className="mt-2 space-y-1">
          <li>hanke, jonka tiedot ovat väärin tai puutteelliset</li>
          <li>hanke, jonka tiedät olevan olemassa mutta jota ei löydy</li>
          <li>näkymä, joka nostaa esiin vääränlaisia hankkeita</li>
          <li>ominaisuus, jota jäät kaipaamaan</li>
        </ul>

        <p className="mt-3">
          Näistä on hyötyä myös muille käyttäjille: yksittäisen hankkeen korjaus
          saattaa johtaa parannukseen, joka vaikuttaa positiivisesti lukuisiin
          hankkeisiin.
        </p>

        <p className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          Ongelmatilanteissa, kysymyksissä ja kaikessa muussa voit olla
          yhteydessä osoitteeseen{" "}
          <a
            href="mailto:info@tyomaat.fi"
            className="font-semibold text-blue-700 underline"
          >
            info@tyomaat.fi
          </a>
          . Vastaamme mahdollisimman pian.
        </p>
      </div>

      <div className="mt-10 border-t border-gray-200 pt-6">
        <Link href="/today" className="text-sm text-blue-700 hover:underline">
          ← Takaisin Tänään-näkymään
        </Link>
      </div>
    </main>
  )
}
