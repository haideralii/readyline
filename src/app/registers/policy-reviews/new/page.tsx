import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { documentOptions } from "../catalogue";
import { PolicyReviewFormView } from "../../_components/policy-review-form";
import { RegisterPage, registerContext } from "../../_components/shell";

export const metadata: Metadata = { title: "Add a policy review" };

export default async function NewPolicyReviewPage() {
  const ctx = await registerContext("/registers/policy-reviews/new");
  if (!ctx.canWrite) redirect("/registers/policy-reviews");
  return (
    <RegisterPage
      title="Add a policy"
      intro="Pick a document from the catalogue, or choose Other and give it a title."
      canWrite={ctx.canWrite}
      back={{ href: "/registers/policy-reviews", label: "Policy reviews" }}
    >
      <PolicyReviewFormView documentOptions={documentOptions()} />
    </RegisterPage>
  );
}
