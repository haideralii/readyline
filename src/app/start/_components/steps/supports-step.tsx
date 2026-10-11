"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  getGroupCategories,
  GROUP_HINT,
  GROUP_QUESTION,
  matchesGroupQuery,
  type GroupOption,
} from "@/lib/questionnaire/groups";
import { stepHref } from "@/lib/questionnaire/navigation";
import { SIL_CODE, SupportsStep } from "@/lib/questionnaire/schema";
import { detectParticipantData } from "@/lib/privacy/participant-data";
import { parseInput } from "@/lib/validation";
import {
  ChoiceRow,
  ErrorSummary,
  Field,
  ParticipantDataWarning,
  RadioGroup,
  StepButtons,
  TextArea,
  TextInput,
  errorsFor,
  type FieldErrors,
} from "../fields";
import { useQuestionnaire } from "../questionnaire-provider";

const LABELS = {
  groups: GROUP_QUESTION,
  "silEligibility.fewHoursOnly": "Supported independent living question 1",
  "silEligibility.participantManagesOwnWorkers":
    "Supported independent living question 2",
  silEligibility: "Supported independent living questions",
  servicesNote: "Anything else about your services",
};

type YesNo = "yes" | "no";
const YES_NO: { value: YesNo; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const CATEGORIES = getGroupCategories();

function AuditTag({ auditType }: { auditType: GroupOption["auditType"] }) {
  return (
    <span className="ml-2 rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      {auditType === "verification" ? "desk audit" : "site audit"}
    </span>
  );
}

export function SupportsStepForm() {
  const router = useRouter();
  const { answers, groups, saveStep } = useQuestionnaire();
  const saved = answers.supports;
  const [selected, setSelected] = useState<string[]>(saved?.groups ?? []);
  const [fewHours, setFewHours] = useState<YesNo | undefined>(
    saved?.silEligibility
      ? saved.silEligibility.fewHoursOnly
        ? "yes"
        : "no"
      : undefined,
  );
  const [selfManaged, setSelfManaged] = useState<YesNo | undefined>(
    saved?.silEligibility
      ? saved.silEligibility.participantManagesOwnWorkers
        ? "yes"
        : "no"
      : undefined,
  );
  const [note, setNote] = useState(saved?.servicesNote ?? "");
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const filtered = useMemo(
    () => groups.filter((g) => matchesGroupQuery(g, query)),
    [groups, query],
  );
  const byCategory = useMemo(() => {
    const map = new Map<string, GroupOption[]>();
    for (const g of filtered) {
      const list = map.get(g.categoryId) ?? [];
      list.push(g);
      map.set(g.categoryId, list);
    }
    return map;
  }, [filtered]);
  const silChosen = selected.includes(SIL_CODE);
  const sdaOnly = selected.length === 1 && selected[0] === "0131";
  const warnings = detectParticipantData(note);
  const nameOf = (code: string) =>
    groups.find((g) => g.code === code)?.name ?? code;

  const toggle = (code: string) =>
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code].sort(),
    );
  const applyHint = () =>
    setSelected((prev) =>
      [...new Set([...prev, ...GROUP_HINT.selects])].sort(),
    );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values: Record<string, unknown> = { groups: selected };
    if (note.trim()) values.servicesNote = note;
    if (silChosen) {
      if (fewHours && selfManaged) {
        values.silEligibility = {
          fewHoursOnly: fewHours === "yes",
          participantManagesOwnWorkers: selfManaged === "yes",
        };
      }
    }
    const parsed = parseInput(SupportsStep, values);
    if (!parsed.ok) {
      const fieldErrors = { ...parsed.fieldErrors };
      if (silChosen && !fewHours)
        fieldErrors["silEligibility.fewHoursOnly"] = ["Choose yes or no"];
      if (silChosen && !selfManaged)
        fieldErrors["silEligibility.participantManagesOwnWorkers"] = [
          "Choose yes or no",
        ];
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    await saveStep("supports", parsed.data, "practices");
    router.push(stepHref("practices"));
  }

  const renderGroup = (g: GroupOption) => (
    <li key={g.code}>
      <ChoiceRow
        id={`group-${g.code}`}
        type="checkbox"
        name="groups"
        value={g.code}
        checked={selected.includes(g.code)}
        onChange={() => toggle(g.code)}
        label={g.name}
        secondary={g.code}
        help={g.description}
        tag={
          <>
            <AuditTag auditType={g.auditType} />
            {g.mandatoryFrom ? (
              <span className="ml-2 rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                registration mandatory from 1 July 2026
              </span>
            ) : null}
          </>
        }
      />
    </li>
  );

  const groupsErrors = errorsFor(errors, "groups");

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary errors={errors} labels={LABELS} />

      <fieldset
        className="mb-6"
        aria-describedby={
          groupsErrors.length ? "groups-error groups-help" : "groups-help"
        }
      >
        <legend className="text-xl font-semibold">{GROUP_QUESTION}</legend>
        <p
          id="groups-help"
          className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
        >
          Tick everything you deliver or plan to deliver. The Commission calls
          these registration groups; the names and the audit type (desk audit or
          site audit) are theirs, and the short descriptions are ours to help
          you recognise your work. If any ticked group needs a site audit, your
          whole registration does.
        </p>

        <div
          className="mt-3 rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
          data-testid="groups-hint"
        >
          <p>{GROUP_HINT.text}</p>
          <button
            type="button"
            onClick={applyHint}
            className="mt-2 inline-flex min-h-11 items-center rounded-md border border-zinc-400 px-3 text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            Choose those two for me
          </button>
        </div>

        <div className="mt-4">
          <label htmlFor="group-search" className="block text-sm font-medium">
            Search by what you do (for example cleaning, support worker,
            therapy, SIL)
          </label>
          <div className="mt-1">
            <TextInput
              id="group-search"
              name="group-search"
              value={query}
              onChange={setQuery}
              invalid={false}
              inputMode="search"
            />
          </div>
        </div>
        <p
          className="mt-3 text-sm text-zinc-700 dark:text-zinc-300"
          aria-live="polite"
          data-testid="groups-chosen"
        >
          {selected.length === 0
            ? "Nothing chosen yet."
            : `${selected.length} chosen: ${selected.map(nameOf).join("; ")}`}
        </p>
        <div id="groups" className="mt-3 space-y-6">
          {CATEGORIES.map((c) => {
            const items = byCategory.get(c.id) ?? [];
            if (items.length === 0 && query.trim()) return null;
            return (
              <div key={c.id} data-testid={`category-${c.id}`}>
                <h2 className="text-base font-semibold">{c.title}</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {c.description}
                </p>
                <ul className="mt-2 space-y-2">{items.map(renderGroup)}</ul>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-500" role="status">
              No matches. Try another word, or clear the search to see every
              group.
            </p>
          ) : null}
        </div>
        {groupsErrors.length ? (
          <p
            id="groups-error"
            className="mt-2 text-sm font-medium text-red-700 dark:text-red-400"
          >
            {groupsErrors[0]}
          </p>
        ) : null}
      </fieldset>

      {sdaOnly ? (
        <div className="mb-6 rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900">
          <strong>Specialist disability accommodation on its own.</strong> The
          Commission&apos;s mapping document assesses an SDA-only provider
          against the SDA module without the core module. Adding any other group
          brings the core module in. Your result will show this.
        </div>
      ) : null}

      {silChosen ? (
        <div
          className="mb-6 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
          id="silEligibility"
        >
          <h2 className="text-base font-semibold">
            Two questions about supported independent living
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            The Commission says it is not supported independent living if either
            of these is true. If so, class 0138 is left out of your result and
            you can still choose other groups.
          </p>
          <div className="mt-4">
            <RadioGroup
              name="silEligibility.fewHoursOnly"
              legend="Does the person only receive a few hours of support a day or week?"
              options={YES_NO}
              value={fewHours}
              onChange={setFewHours}
              errors={errorsFor(errors, "silEligibility.fewHoursOnly")}
            />
            <RadioGroup
              name="silEligibility.participantManagesOwnWorkers"
              legend="Does the person choose and manage their own support workers (including directing, planning and rostering them)?"
              options={YES_NO}
              value={selfManaged}
              onChange={setSelfManaged}
              errors={errorsFor(
                errors,
                "silEligibility.participantManagesOwnWorkers",
              )}
            />
          </div>
        </div>
      ) : null}

      <Field
        id="servicesNote"
        label={`${LABELS.servicesNote} (optional)`}
        help={<ParticipantDataWarning />}
        errors={errorsFor(errors, "servicesNote")}
      >
        {(describedBy, invalid) => (
          <TextArea
            id="servicesNote"
            name="servicesNote"
            value={note}
            onChange={setNote}
            describedBy={describedBy}
            invalid={invalid}
            maxLength={500}
          />
        )}
      </Field>
      {warnings.length ? (
        <div
          role="status"
          className="mb-6 rounded-md border border-amber-700 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100"
        >
          <p className="font-semibold">Check this note before you continue</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w) => (
              <li key={w.kind}>{w.message}</li>
            ))}
          </ul>
          <p className="mt-2">
            This note is never used to work out your result; it is only kept
            with your draft.
          </p>
        </div>
      ) : null}

      <StepButtons backHref={stepHref("business")} />
    </form>
  );
}
