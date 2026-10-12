import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("privacy").title };
}

export default function PrivacyPage() {
  return <LegalArticle page={loadLegalPage("privacy")} />;
}
