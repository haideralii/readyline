/**
 * The identity's colour tokens (REQ-014 FR-1, FR-4), one source for the
 * stylesheet and the contrast test. `src/app/globals.css` declares the same
 * values as CSS variables; `tokens.test.ts` parses the stylesheet and fails
 * if they drift, and checks every text pair below against WCAG AA in both
 * themes. Ink, not black; paper, not white; one warm accent.
 */
export type ThemeName = "light" | "dark";

export const TOKEN_NAMES = [
  "paper",
  "mist",
  "ink",
  "slate",
  "ochre",
  "moss",
  "signal",
  "sky",
  // REQ-028 FR-2 (D-2802): the surface ladder's second step, the two borders, the track and the two washes.
  "surface",
  "rule",
  "line",
  "track",
  "signal-wash",
  "ochre-wash",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

export const TOKENS: Record<ThemeName, Record<TokenName, string>> = {
  light: {
    paper: "#F7F3EC",
    mist: "#E6E0D6",
    ink: "#1C2B2A",
    slate: "#4A5553",
    ochre: "#B4461F",
    moss: "#2F6B4F",
    signal: "#9A2B2B",
    sky: "#DCE8E6",
    surface: "#FFFDF9",
    rule: "#D4CCBF",
    // v4 (Dev response 1(c)): D-2802's #7E8785 measured 2.81:1 on mist; this holds 3:1 on paper, surface and mist.
    line: "#74807D",
    track: "#CFC7B9",
    "signal-wash": "#F3E4E2",
    "ochre-wash": "#F6E6DC",
  },
  dark: {
    paper: "#1B2422",
    mist: "#27322F",
    ink: "#F1EDE6",
    slate: "#B8C0BD",
    ochre: "#E0734A",
    moss: "#6FBF95",
    // Not in the PO's list: chosen for 4.5:1 on dark paper (checked by the test).
    signal: "#E07A7A",
    sky: "#1E3330",
    surface: "#222D2A",
    rule: "#34403D",
    // v4 (Dev response 1(c)): D-2802's #6B7673 measured 2.82:1 on dark mist.
    line: "#737F7C",
    track: "#3A4442",
    "signal-wash": "#33201F",
    "ochre-wash": "#3A2A22",
  },
};

/**
 * Every foreground/background pair the UI uses for text or UI parts, with
 * the AA minimum it must meet: 4.5 for text, 3 for large text and UI.
 */
export const TEXT_PAIRS: ReadonlyArray<{
  fg: TokenName;
  bg: TokenName;
  /** 4.5 for text, 3 for large text and UI parts, 1.4 for a rule that must still be seen (D-2802, the PO's floor, not a WCAG one). */
  min: 4.5 | 3 | 1.4;
  use: string;
}> = [
  { fg: "ink", bg: "paper", min: 4.5, use: "body text on the page" },
  { fg: "slate", bg: "paper", min: 4.5, use: "secondary text on the page" },
  { fg: "ink", bg: "mist", min: 4.5, use: "text on cards and notices" },
  { fg: "slate", bg: "mist", min: 4.5, use: "secondary text on cards" },
  {
    fg: "ochre",
    bg: "paper",
    min: 4.5,
    use: "accent text and links on the page",
  },
  { fg: "moss", bg: "paper", min: 4.5, use: "ready and success text" },
  { fg: "signal", bg: "paper", min: 4.5, use: "error text" },
  { fg: "paper", bg: "ochre", min: 4.5, use: "primary button label" },
  { fg: "paper", bg: "ink", min: 4.5, use: "inverted surfaces" },
  { fg: "ink", bg: "sky", min: 4.5, use: "text on info backgrounds" },
  { fg: "ochre", bg: "mist", min: 3, use: "the ready line on its track" },
  { fg: "moss", bg: "mist", min: 3, use: "the done segment on its track" },
  { fg: "ochre", bg: "paper", min: 3, use: "focus ring" },
  // REQ-028 FR-2, AC-2 (D-2802): ink and slate on every surface and the two
  // washes; ochre, moss and signal on paper and surface (never on mist, sky
  // or a wash); the control border on the three surfaces it sits on at 3:1;
  // the rule on paper at the PO's 1.4 floor.
  { fg: "ink", bg: "surface", min: 4.5, use: "body text on a card" },
  { fg: "slate", bg: "surface", min: 4.5, use: "helper text on a card" },
  { fg: "ink", bg: "sky", min: 4.5, use: "body text on an info surface" },
  { fg: "slate", bg: "sky", min: 4.5, use: "helper text on an info surface" },
  {
    fg: "ink",
    bg: "signal-wash",
    min: 4.5,
    use: "body text in the error summary",
  },
  {
    fg: "slate",
    bg: "signal-wash",
    min: 4.5,
    use: "helper text in the error summary",
  },
  { fg: "ink", bg: "ochre-wash", min: 4.5, use: "body text in a note" },
  { fg: "slate", bg: "ochre-wash", min: 4.5, use: "helper text in a note" },
  {
    fg: "ochre",
    bg: "surface",
    min: 4.5,
    use: "accent text and links on a card",
  },
  { fg: "moss", bg: "surface", min: 4.5, use: "done text on a card" },
  { fg: "signal", bg: "surface", min: 4.5, use: "error text on a card" },
  {
    fg: "signal",
    bg: "signal-wash",
    min: 4.5,
    use: "the error summary's text",
  },
  { fg: "line", bg: "paper", min: 3, use: "a control's border on the page" },
  { fg: "line", bg: "surface", min: 3, use: "a control's border on a card" },
  { fg: "line", bg: "mist", min: 3, use: "a control's border on a notice" },
  {
    fg: "ochre",
    bg: "track",
    min: 3,
    use: "the ready line's still-to-do segment",
  },
  { fg: "moss", bg: "track", min: 3, use: "the ready line's done segment" },
  { fg: "rule", bg: "paper", min: 1.4, use: "a decoration line on the page" },
];

function channel(hex: string, offset: number): number {
  const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.2 (the 2.1 formula, unchanged). */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  return (
    0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4)
  );
}

/** Contrast ratio per WCAG 2.2 (the 2.1 formula, unchanged), 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
