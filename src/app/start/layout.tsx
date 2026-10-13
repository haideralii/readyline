import { contactEmail } from "@/lib/legal/config";
import { getGroupOptions } from "@/lib/questionnaire/groups";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { getViewer } from "@/server/accounts/queries";
import { QuestionnaireProvider } from "./_components/questionnaire-provider";

export default async function StartLayout({ children }: LayoutProps<"/start">) {
  // Only the small group shape reaches the browser; standards.json stays on the server.
  const groups = getGroupOptions(getStandardsDataset());
  // Signed-in owners keep their draft on the server (REQ-004); everyone else on this device.
  const viewer = await getViewer();
  const mode = viewer?.account ? "server" : "local";
  return (
    <QuestionnaireProvider
      groups={groups}
      mode={mode}
      contactEmail={contactEmail()}
      accountPrefill={
        viewer?.account
          ? {
              tradingName: viewer.account.trading_name,
              structure: viewer.account.business_structure,
              states: viewer.account.states,
              abn: viewer.account.abn ?? "",
            }
          : null
      }
    >
      {children}
    </QuestionnaireProvider>
  );
}
