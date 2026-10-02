import Lataus from "@/app/components/Lataus"

/*
 * LATAUSILMAISIN PALVELINKOMPONENTEILLE (D-229).
 *
 * Johannes 3.10.2026: *"kun siirryn /today -> /projects latausilmaisin
 * tulee, mutta toiseen suuntaan siirryttaessa ei."*
 *
 * Ero ei ollut ilmaisimessa vaan siina mita sivut ovat. `/projects` on
 * asiakaskomponentti: se piirtyy heti ja hakee datan vasta sitten, joten
 * `loading`-tila ehtii nakya. `/today` on palvelinkomponentti
 * (`force-dynamic`): selain odottaa palvelimen vastausta ja nayttaa
 * siihen asti VANHAA sivua, joten mitaan latausta ei nay.
 *
 * Next.js:n oma ratkaisu on tama tiedosto: se on Suspense-raja, jonka
 * sisalto nakyy palvelinkomponentin valmistumista odottaessa.
 *
 * YKSI TIEDOSTO KATTAA ALIREITIT. Siksi naita on kolme eika
 * kahdeksantoista: `/today`, `/projects/[id]` ja `/tic` (jonka alla on
 * 16 palvelinsivua).
 */
export default function Loading() {
  return <Lataus keskita />
}
