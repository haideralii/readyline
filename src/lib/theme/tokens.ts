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
  },
  dark: {
    paper: "#141C1B",
    mist: "#1F2A28",
    ink: "#F1EDE6",
    slate: "#B8C0BD",
    ochre: "#E0734A",
    moss: "#6FBF95",
    // Not in the PO's list: chosen for 4.5:1 on dark paper (checked by the test).
    signal: "#E07A7A",
    sky: "#1E3330",
  },
};

/**
 * Every foreground/background pair the UI uses for text or UI parts, with
 * the AA minimum it must meet: 4.5 for text, 3 for large text and UI.
 */
export const TEXT_PAIRS: ReadonlyArray<{
  fg: TokenName;
  bg: TokenName;
  min: 4.5 | 3;
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
];

function channel(hex: string, offset: number): number {
  const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.1. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  return (
    0.2126 * channel(h, 0) + 0.7152 * channel(h, 2) + 0.0722 * channel(h, 4)
  );
}

/** Contrast ratio per WCAG 2.1, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** The zinc scale Tailwind utilities map to: a warm, monotonic ramp from paper to ink (D-1402). */
export const WARM_SCALE: Record<string, string> = {
  "50": "#F7F3EC",
  "100": "#E6E0D6",
  "200": "#D6CFC3",
  "300": "#BFB7AA",
  "400": "#8E9593",
  // 5.2:1 on paper: the class codes and counters use zinc-500 as text.
  "500": "#5E6866",
  "600": "#4A5553",
  "700": "#3A4442",
  "800": "#2A3634",
  "900": "#1C2B2A",
  "950": "#141C1B",
};
