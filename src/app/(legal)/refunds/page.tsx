import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";
import { renderedLegalPage } from "@/server/legal/render";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("refunds").title };
}

export default function RefundsPage() {
  return <LegalArticle page={renderedLegalPage("refunds")} />;
}
