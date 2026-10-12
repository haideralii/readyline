/**
 * The three reference questionnaires every generator test and the LibreOffice
 * job run against (REQ-005 AC-1, AC-2, AC-3). They are fictional businesses
 * with no participant information.
 */
import { QuestionnaireAnswers } from "@/lib/questionnaire/schema";
import {
  buildResult,
  type QuestionnaireResult,
} from "@/lib/questionnaire/result";
import { getStandardsDataset } from "@/lib/standards/dataset";
import verificationSoleTrader from "../../../fixtures/reference-cases/verification-sole-trader.json";
import certificationPersonalCare from "../../../fixtures/reference-cases/certification-personal-care.json";
import behaviourSupportCompany from "../../../fixtures/reference-cases/behaviour-support-company.json";

export type ReferenceCase = {
  id: string;
  answers: QuestionnaireAnswers;
  result: QuestionnaireResult;
};

const RAW: { id: string; answers: unknown }[] = [
  { id: "verification-sole-trader", answers: verificationSoleTrader },
  { id: "certification-personal-care", answers: certificationPersonalCare },
  { id: "behaviour-support-company", answers: behaviourSupportCompany },
];

export function loadReferenceCases(): ReferenceCase[] {
  const dataset = getStandardsDataset();
  return RAW.map((c) => {
    const answers = QuestionnaireAnswers.parse(c.answers);
    const built = buildResult(dataset, answers);
    if (!built.ok) throw new Error(`reference case ${c.id}: ${built.message}`);
    return { id: c.id, answers, result: built.result };
  });
}
