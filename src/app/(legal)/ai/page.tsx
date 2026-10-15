import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal-article";
import { loadLegalPage } from "@/lib/legal/pages";
import { renderedLegalPage } from "@/server/legal/render";

export async function generateMetadata(): Promise<Metadata> {
  return { title: loadLegalPage("ai").title };
}

export default function AiPage() {
  return <LegalArticle page={renderedLegalPage("ai")} />;
}
