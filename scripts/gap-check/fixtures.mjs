// REQ-035 AC-2 fixtures: the sample policy as PDF and DOCX, written from fixtures/gap-check/sample-policy.txt
// with the libraries the app already has (pdf-lib, docx). Run after editing the text:
//   node scripts/gap-check/fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";

const DIR = "fixtures/gap-check";
const text = readFileSync(`${DIR}/sample-policy.txt`, "utf8").replace(
  /\r\n/g,
  "\n",
);
const paragraphs = text.split("\n").map((l) => l.trimEnd());

// PDF: one line per paragraph, wrapped at a width the page holds, 11 pt Helvetica.
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
let page = pdf.addPage([595, 842]);
let y = 800;
const wrap = (line, max = 95) => {
  const out = [];
  let cur = "";
  for (const word of line.split(" ")) {
    if ((cur + " " + word).trim().length > max) {
      out.push(cur.trim());
      cur = word;
    } else cur = `${cur} ${word}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [""];
};
for (const para of paragraphs) {
  for (const line of wrap(para)) {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(line, { x: 40, y, size: 11, font });
    y -= 16;
  }
  y -= 6;
}
writeFileSync(`${DIR}/sample-policy.pdf`, await pdf.save());

// DOCX: one paragraph per line.
const doc = new Document({
  sections: [{ children: paragraphs.map((p) => new Paragraph({ text: p })) }],
});
writeFileSync(`${DIR}/sample-policy.docx`, await Packer.toBuffer(doc));
console.log("wrote sample-policy.pdf and sample-policy.docx");
