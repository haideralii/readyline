/**
 * Lightweight client-side detector for text that looks like it describes an
 * NDIS participant (CLAUDE.md 4.5 v2; REQ-003 SR-2). It warns, never blocks:
 * the provider owns the decision, we make the risk visible before submit.
 *
 * Deliberately simple patterns; false positives are acceptable, silence is not.
 */
export type ParticipantDataWarning = {
  kind: "name" | "date-of-birth" | "ndis-number" | "address" | "health";
  message: string;
};

const NAME =
  /\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+\b|\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/;
const DOB =
  /\b(?:dob|date of birth|born)\b[^\n]{0,20}\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:19|20)\d{2}\b/i;
const NDIS_NUMBER = /\b43\d{7}\b/;
const ADDRESS =
  /\b\d{1,5}[a-z]?\s+[A-Z][a-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Lane|Ln|Crescent|Cres|Parade|Pde|Highway|Hwy|Way)\b/;
const HEALTH =
  /\b(?:diagnos(?:is|ed)|autism|cerebral palsy|epilep|schizo|down syndrome|intellectual disability|medication for|wheelchair user|dementia|psychosis)\b/i;

/** Capitalised words that make a two-word match a place or organisation, not a person. */
const PLACE_WORDS =
  /^(?:North|South|East|West|Northern|Southern|Eastern|Western|Central|Greater|Inner|Outer|Upper|Lower|New|Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra|Newcastle|Wollongong|Geelong|Gold|Coast|Sunshine|Bay|Region|Shire|Council|Hospital|Centre|Center|Street|Road|Australia|Wales|Territory|Island|Valley|Hills|Park|Beach|River|Lake|Mount|Port|NDIS|Commission|Practice|Standards|Quality|Safeguards)$/;

const COMMON_FALSE_POSITIVES =
  /^(?:New South Wales|Western Australia|South Australia|Northern Territory|Practice Standards|Quality Indicators|Household Tasks|Daily Living|Early Childhood|Support Coordination)$/;

export function detectParticipantData(text: string): ParticipantDataWarning[] {
  const warnings: ParticipantDataWarning[] = [];
  if (!text || text.trim().length === 0) return warnings;

  const nameMatch = [...text.matchAll(new RegExp(NAME.source, "g"))].find(
    (m) =>
      !COMMON_FALSE_POSITIVES.test(m[0]) &&
      !m[0].split(/\s+/).some((w) => PLACE_WORDS.test(w)),
  );
  if (nameMatch) {
    warnings.push({
      kind: "name",
      message:
        "This looks like it contains a person's name. Use a reference code such as P-014 instead of naming a participant.",
    });
  }
  if (DOB.test(text)) {
    warnings.push({
      kind: "date-of-birth",
      message:
        "This looks like it contains a date of birth. Leave participants' dates of birth out.",
    });
  }
  if (NDIS_NUMBER.test(text)) {
    warnings.push({
      kind: "ndis-number",
      message:
        "This looks like an NDIS participant number. Do not enter participant numbers.",
    });
  }
  if (ADDRESS.test(text)) {
    warnings.push({
      kind: "address",
      message:
        "This looks like a street address. Describe your services, not where a participant lives.",
    });
  }
  if (HEALTH.test(text)) {
    warnings.push({
      kind: "health",
      message:
        "This looks like health or disability information about a person. Describe the type of support you deliver instead.",
    });
  }
  return warnings;
}
