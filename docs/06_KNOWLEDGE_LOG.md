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