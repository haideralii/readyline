/**
 * Australian Business Number validation (REQ-003 FR-1, AC-8): 11 digits and
 * the ATO weighted checksum. No lookup is performed; the ABN is optional and
 * only has to be well-formed if given.
 */
const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

/** Removes spaces so "51 824 753 556" and "51824753556" are treated alike. */
export function normaliseAbn(input: string): string {
  return input.replace(/\s+/g, "");
}

export function isValidAbn(input: string): boolean {
  const abn = normaliseAbn(input);
  if (!/^\d{11}$/.test(abn)) return false;
  const digits = abn.split("").map(Number);
  digits[0] -= 1;
  const sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
  return sum % 89 === 0;
}
