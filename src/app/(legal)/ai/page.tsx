import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("ai").title };
}

export default function AiPage() {
  return <LegalArticle page={loadLegalPage("ai")} />;
}
