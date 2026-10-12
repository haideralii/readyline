/**
 * The only shape a tailored section may take (REQ-005 FR-2, D-501). Blocks are
 * a closed set and every object is strict, so the model cannot add headings,
 * links, styling or unknown keys. Fixed text is authored in the same shape,
 * which gives the renderer a single path.
 */
import { z } from "zod";
import { strictObject } from "@/lib/validation";
import { FACT_KEYS } from "./facts";

/** One sentence or a short paragraph; no line breaks. */
export const Inline = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .refine((s) => !/[\r\n]/.test(s), "no line breaks inside a block");

export const ParagraphBlock = strictObject({
  type: z.literal("paragraph"),
  text: Inline,
});
export const BulletsBlock = strictObject({
  type: z.literal("bullets"),
  items: z.array(Inline).min(1).max(12),
});
export const StepsBlock = strictObject({
  type: z.literal("steps"),
  items: z.array(Inline).min(1).max(15),
});
export const TableBlock = strictObject({
  type: z.literal("table"),
  columns: z.array(z.string().trim().min(1).max(40)).min(2).max(4),
  rows: z.array(z.array(Inline)).min(1).max(20),
}).refine(
  (t) => t.rows.every((r) => r.length === t.columns.length),
  "every row must have one cell per column",
);
export const CalloutBlock = strictObject({
  type: z.literal("callout"),
  text: Inline,
});

export const Block = z.discriminatedUnion("type", [
  ParagraphBlock,
  BulletsBlock,
  StepsBlock,
  TableBlock,
  CalloutBlock,
]);
export type Block = z.infer<typeof Block>;

export const TailoredSection = strictObject({
  /** Must equal the section the model was asked for; checked by the caller. */
  sectionId: z.string().trim().min(1).max(60),
  blocks: z.array(Block).min(1).max(12),
  /** Which provider facts the text relies on (FR-5 reviewer view). */
  usedFacts: z.array(z.enum(FACT_KEYS)).min(1).max(FACT_KEYS.length),
});
export type TailoredSection = z.infer<typeof TailoredSection>;

/** Plain text of a block list, for lints and readability. */
export function blocksToText(blocks: readonly Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "paragraph":
      case "callout":
        lines.push(b.text);
        break;
      case "bullets":
      case "steps":
        lines.push(...b.items);
        break;
      case "table":
        lines.push(b.columns.join(" | "), ...b.rows.map((r) => r.join(" | ")));
        break;
    }
  }
  return lines.join("\n");
}

/** Prose only (paragraphs, bullets, steps): what readability is measured on (D-503). */
export function blocksToProse(blocks: readonly Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph") lines.push(b.text);
    else if (b.type === "bullets" || b.type === "steps") lines.push(...b.items);
  }
  return lines.join("\n");
}
