import { getGroupOptions } from "@/lib/questionnaire/groups";
import { getStandardsDataset } from "@/lib/standards/dataset";
import { QuestionnaireProvider } from "./_components/questionnaire-provider";

export default function StartLayout({ children }: LayoutProps<"/start">) {
  // Only the small group shape reaches the browser; standards.json stays on the server.
  const groups = getGroupOptions(getStandardsDataset());
  return (
    <QuestionnaireProvider groups={groups}>{children}</QuestionnaireProvider>
  );
}
