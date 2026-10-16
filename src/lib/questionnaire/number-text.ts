/**
 * QA pass N8 (17 Oct 2026): the number inputs used to strip every character
 * but a digit, so "2.5" workers became 25 and "-1" became 1, silently. The
 * text a person types now survives as a number would read it (digits, one
 * decimal point, a leading minus), and the schema says what is wrong with it
 * ("Enter a whole number of workers", "Count yourself as a worker") instead
 * of the input quietly changing the answer.
 */
export function numberText(raw: string): string {
  let out = "";
  let point = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch >= "0" && ch <= "9") out += ch;
    else if (ch === "." && !point) {
      out += ch;
      point = true;
    } else if (ch === "-" && out === "") out = "-";
  }
  return out;
}
