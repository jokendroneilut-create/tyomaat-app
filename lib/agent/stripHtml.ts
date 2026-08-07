/*
 * HTML-rungon muunnos luettavaksi tekstiksi.
 *
 * Jaettu moduuli, koska useampi lähde saa rungon HTML:nä: KAS:n WordPress-API,
 * SRV:n Cision-data ja Pohjola Rakennuksen listaus. Aiemmin tämä oli yhden
 * poimijan sisällä, jolloin muut joko toistivat sen tai jättivät rungon
 * kokonaan käyttämättä.
 */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return ""

  return (
    value
      /*
       * Lohkotason tagit korvataan välilyönnillä ennen poistoa, jottei
       * kappaleiden viimeinen ja seuraavan ensimmäinen sana liimaudu yhteen
       * ("...RaisiossaSRV on...").
       */
      .replace(/<\/?(?:p|br|div|li|h[1-6]|tr)\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&#8211;/g, "–")
      .replace(/&#8217;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
  )
}
