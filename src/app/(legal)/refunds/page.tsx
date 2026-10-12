import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("refunds").title };
}

export default function RefundsPage() {
  return <LegalArticle page={loadLegalPage("refunds")} />;
}
