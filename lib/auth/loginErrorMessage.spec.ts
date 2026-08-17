import { describe, it, expect } from "vitest"
import { loginErrorMessage } from "./loginErrorMessage"

describe("loginErrorMessage", () => {
  /* Tämä on se viesti jonka lukittu käyttäjä näkee — todennettu 18.8.2026. */
  it("suomentaa lukitun tunnuksen ja kertoo mihin ottaa yhteyttä", () => {
    const message = loginErrorMessage("User is banned")
    expect(message).toContain("lukittu")
    expect(message).toContain("info@tyomaat.fi")
  })

  it("suomentaa väärän salasanan", () => {
    expect(loginErrorMessage("Invalid login credentials")).toBe(
      "Sähköposti tai salasana on väärin."
    )
  })

  it("ei paljasta löytyikö sähköposti", () => {
    /* Sama viesti molemmille, ettei kirjautumissivu toimi osoitehakuna. */
    expect(loginErrorMessage("User not found")).toBe(
      loginErrorMessage("Invalid login credentials")
    )
  })

  it("suomentaa aktivoimattoman tunnuksen", () => {
    expect(loginErrorMessage("Email not confirmed")).toContain("aktivoitu")
  })

  /*
   * Tuntematon virhe säilyy sellaisenaan: geneerinen suomennos piilottaisi
   * syyn myös silloin kun se olisi ollut hyödyllinen.
   */
  it("palauttaa tuntemattoman virheen muuttumattomana", () => {
    expect(loginErrorMessage("Something unexpected happened")).toBe(
      "Something unexpected happened"
    )
  })

  it("antaa varaviestin tyhjälle", () => {
    expect(loginErrorMessage("")).toContain("epäonnistui")
    expect(loginErrorMessage(null)).toContain("epäonnistui")
  })
})
