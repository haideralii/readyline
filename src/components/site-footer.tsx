import { AI_DISCLOSURE, BRAND, GENERAL_INFORMATION_NOTICE } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-zinc-600 sm:px-6 dark:text-zinc-400">
        <p data-testid="site-disclaimer">{GENERAL_INFORMATION_NOTICE}</p>
        <p data-testid="ai-disclosure">{AI_DISCLOSURE}</p>
        <p className="text-xs">
          {BRAND}. NDIS is a registered trade mark of the National Disability
          Insurance Agency and is used here descriptively only.
        </p>
      </div>
    </footer>
  );
}
