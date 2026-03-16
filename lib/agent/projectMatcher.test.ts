import { findProjectMatch } from "./projectMatcher"

const existingProjects = [
  {
    id: "1",
    name: "As Oy Testikatu 1",
    city: "Helsinki",
    region: "Uusimaa",
    location: "Testikatu 1",
    phase: "Suunnittelussa",
  },
  {
    id: "2",
    name: "Koulukatu 5",
    city: "Tampere",
    region: "Pirkanmaa",
    location: "Koulukatu 5",
    phase: "Suunnittelussa",
  },
]

const candidate = {
  name: "As Oy Testikatu 1",
  city: "Helsinki",
  region: "Uusimaa",
  location: "Testikatu 1",
}

console.log(findProjectMatch(existingProjects, candidate))