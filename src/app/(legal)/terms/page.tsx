import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("terms").title };
}

export default function TermsPage() {
  return <LegalArticle page={loadLegalPage("terms")} />;
}
