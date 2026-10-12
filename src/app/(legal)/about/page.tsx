import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("about").title };
}

export default function AboutPage() {
  return <LegalArticle page={loadLegalPage("about")} />;
}
