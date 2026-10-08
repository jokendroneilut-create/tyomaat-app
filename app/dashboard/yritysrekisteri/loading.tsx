import Lataus from "@/app/components/Lataus"

/*
 * Yritysrekisteri on palvelinkomponentti ja ensimmainen haku kokoaa
 * koko kannan (useita sekunteja, D-253) — ilman tata selain nayttaisi
 * vanhaa sivua sen ajan. Ks. app/tic/loading.tsx (D-229).
 */
export default function Loading() {
  return <Lataus keskita />
}
