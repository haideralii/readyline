import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";
import { renderedLegalPage } from "@/server/legal/render";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("terms").title };
}

export default function TermsPage() {
  return <LegalArticle page={renderedLegalPage("terms")} />;
}
