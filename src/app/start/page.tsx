import type { Metadata } from "next";
import { countEvent } from "@/server/metrics/counters";
import { StartIntro } from "./_components/start-intro";

export const metadata: Metadata = {
  title: "Find out what registration needs from you",
  description:
    "Answer a few questions about your supports and workforce to see which NDIS Practice Standards modules apply, which audit you face and what documents you will need. General information, prepared for your review.",
};

export default function StartPage() {
  // Batch 45 item 12 (D-2002): a first-party count of starts, nothing per user.
  countEvent("start-view");
  return <StartIntro />;
}
