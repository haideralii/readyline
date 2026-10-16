"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  getGroupCategories,
  GROUP_HINT,
  GROUP_QUESTION,
  groupsInCategory,
  matchesGroupQuery,
  type GroupOption,
} from "@/lib/questionnaire/groups";
import { stepHref } from "@/lib/questionnaire/navigation";
import { SIL_CODE } from "@/lib/questionnaire/steps";
import { parseStep } from "@/lib/questionnaire/validate-step";
import { detectParticipantData } from "@/lib/privacy/participant-data";
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
import { PRESELECT_KEY } from "../start-intro";
import { GlossaryTerms } from "@/components/glossary-terms";
import { findGlossaryTerms } from "@/lib/copy-lint/glossary";

/** REQ-011 batch 31: the group a guide page asked to tick, kept by the intro in session storage; cleared once used. */
function subscribeNothing() {
  return () => {};
}
function readPreselect(): string | null {
  try {
    return window.sessionStorage.getItem(PRESELECT_KEY);
  } catch {
    return null;
  }
}

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

const GROUPS_HELP =
  "Tick everything you deliver or plan to deliver. The Commission calls these registration groups; the names and the audit type (desk audit or site audit) are theirs, and the short descriptions are ours to help you recognise your work. If any ticked group needs a site audit, your whole registration does.";
const SDA_ONLY_LEAD = "Specialist disability accommodation on its own.";
const SDA_ONLY_TEXT =
  "The Commission's mapping document assesses an SDA-only provider against the SDA module without the core module. Adding any other group brings the core module in. Your result will show this.";

const CATEGORIES = getGroupCategories();
/** REQ-013 FR-11: the two most common groups start open; the rest open on wider screens, on search, or on a tap. */
const OPEN_BY_DEFAULT = ["personal-care", "around-the-house"];
const WIDE_SCREEN = "(min-width: 640px)";
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function AuditTag({ auditType }: { auditType: GroupOption["auditType"] }) {
  return (
    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      {auditType === "verification" ? "desk audit" : "site audit"}
    </span>
  );
}

export function SupportsStepForm() {
  const router = useRouter();
  const { answers, groups, saveStep } = useQuestionnaire();
  const saved = answers.supports;
  const [selected, setSelected] = useState<string[]>(saved?.groups ?? []);
  // REQ-011 batch 31: a guide page's group is ticked until the provider touches the list.
  const preselectCode = useSyncExternalStore(
    subscribeNothing,
    readPreselect,
    () => null,
  );
  const [touched, setTouched] = useState(false);
  const seed =
    !touched &&
    !saved?.groups?.length &&
    preselectCode &&
    groups.some((g) => g.code === preselectCode)
      ? preselectCode
      : null;
  const current = seed && selected.length === 0 ? [seed] : selected;
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
  const [pending, setPending] = useState(false);
  // FR-11: which headings are open. Phones start with the two common ones;
  // wider screens open everything, because there is room to scan. The
  // viewport is read through an external-store subscription (no state set in
  // an effect); explicit taps are remembered per heading.
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_SCREEN).matches,
    () => false,
  );
  const [toggled, setToggled] = useState<Map<string, boolean>>(() => new Map());
  const setOpen = (id: string, open: boolean) =>
    setToggled((prev) => new Map(prev).set(id, open));
  const isOpen = (id: string) =>
    toggled.get(id) ?? (wide || OPEN_BY_DEFAULT.includes(id));

  const filtered = useMemo(
    () => groups.filter((g) => matchesGroupQuery(g, query)),
    [groups, query],
  );
  // R-1: within a heading, the data's order (most common first), not code order.
  const byCategory = useMemo(() => {
    const map = new Map<string, GroupOption[]>();
    for (const c of CATEGORIES) map.set(c.id, groupsInCategory(filtered, c.id));
    return map;
  }, [filtered]);
  const silChosen = current.includes(SIL_CODE);
  const sdaOnly = current.length === 1 && current[0] === "0131";
  const warnings = detectParticipantData(note);
  const nameOf = (code: string) =>
    groups.find((g) => g.code === code)?.name ?? code;

  const toggle = (code: string) => {
    setTouched(true);
    setSelected(
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code].sort(),
    );
  };
  const applyHint = () => {
    setTouched(true);
    setSelected([...new Set([...current, ...GROUP_HINT.selects])].sort());
    // The hint's classes become visible in their open headings.
    setToggled((prev) => {
      const next = new Map(prev);
      for (const code of GROUP_HINT.selects) {
        const id = groups.find((g) => g.code === code)?.categoryId;
        if (id) next.set(id, true);
      }
      return next;
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const values: Record<string, unknown> = { groups: current };
    if (note.trim()) values.servicesNote = note;
    if (silChosen) {
      if (fewHours && selfManaged) {
        values.silEligibility = {
          fewHoursOnly: fewHours === "yes",
          participantManagesOwnWorkers: selfManaged === "yes",
        };
      }
    }
    const parsed = await parseStep("supports", values);
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
    setPending(true);
    await saveStep("supports", parsed.data, "practices");
    try {
      window.sessionStorage.removeItem(PRESELECT_KEY);
    } catch {
      // Storage blocked: the key was never there.
    }
    router.push(stepHref("practices"));
  }

  // `suffix` keeps ids unique when a ticked class is also shown under a closed heading.
  const renderGroup = (g: GroupOption, suffix = "") => (
    <li key={g.code}>
      <ChoiceRow
        id={`group-${g.code}${suffix}`}
        type="checkbox"
        name="groups"
        value={g.code}
        checked={current.includes(g.code)}
        onChange={() => toggle(g.code)}
        label={g.name}
        secondary={g.code}
        help={g.description}
        tag={
          <>
            <AuditTag auditType={g.auditType} />
            {g.mandatoryFrom ? (
              <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                registration mandatory from 1 July 2026
              </span>
            ) : null}
          </>
        }
      />
    </li>
  );

  const groupsErrors = errorsFor(errors, "groups");

  // REQ-027 FR-3, D-2711, D-2267: the glossary words on this step as it stands,
  // found at render: the question and its help, the headings and their short
  // descriptions, the classes an open heading shows (a closed one shows its
  // ticked classes alone), and the SDA note when it is shown. The groups'
  // descriptions name restrictive practices and modules, so a fixed list would
  // say too much or too little as headings open and close.
  const searching = Boolean(query.trim());
  const present = findGlossaryTerms(
    [
      GROUP_QUESTION,
      GROUPS_HELP,
      GROUP_HINT.text,
      ...CATEGORIES.flatMap((c) => {
        const items = byCategory.get(c.id) ?? [];
        if (items.length === 0 && searching) return [];
        const shown =
          searching || isOpen(c.id)
            ? items
            : groupsInCategory(groups, c.id).filter((g) =>
                current.includes(g.code),
              );
        return [
          c.title,
          c.description,
          ...shown.flatMap((g) => [g.name, g.description]),
        ];
      }),
      ...(sdaOnly ? [SDA_ONLY_LEAD, SDA_ONLY_TEXT] : []),
    ].join("\n"),
  );

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary errors={errors} labels={LABELS} />
      {/* REQ-027 FR-3, D-2701: the words on this step, above its first question. */}
      <GlossaryTerms ids={present} where="page" className="mb-4" />

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
          {GROUPS_HELP}
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
          {current.length === 0
            ? "Nothing chosen yet."
            : `${current.length} chosen: ${current.map(nameOf).join("; ")}`}
        </p>
        <div id="groups" className="mt-3 space-y-3">
          {CATEGORIES.map((c) => {
            const items = byCategory.get(c.id) ?? [];
            const searching = Boolean(query.trim());
            if (items.length === 0 && searching) return null;
            // A search opens every heading that has a match (FR-11).
            const open = searching || isOpen(c.id);
            const all = groupsInCategory(groups, c.id);
            const ticked = all.filter((g) => current.includes(g.code));
            return (
              <div
                key={c.id}
                className="rounded-md border border-zinc-200 dark:border-zinc-800"
                data-testid={`category-${c.id}`}
                data-open={open ? "true" : "false"}
                data-codes={all.map((g) => g.code).join(" ")}
              >
                {/* A React-controlled disclosure (not <details>): a tap before
                    hydration is a no-op rather than a native toggle React then
                    undoes, so the open state is always what the state says. */}
                <h2 className="m-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`category-${c.id}-list`}
                    disabled={searching}
                    onClick={() => setOpen(c.id, !open)}
                    className="flex min-h-12 w-full items-start gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-default"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-block w-4 shrink-0 text-sm text-zinc-500"
                    >
                      {open ? "▾" : "▸"}
                    </span>
                    <span className="min-w-0">
                      <span className="text-base font-semibold">{c.title}</span>{" "}
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        ({all.length} {all.length === 1 ? "class" : "classes"}
                        {ticked.length ? `, ${ticked.length} ticked` : ""})
                      </span>
                      <span className="block text-sm font-normal text-zinc-600 dark:text-zinc-400">
                        {c.description}
                      </span>
                    </span>
                  </button>
                </h2>
                {open ? (
                  <ul
                    id={`category-${c.id}-list`}
                    className="space-y-2 px-3 pb-3"
                  >
                    {items.map((g) => renderGroup(g))}
                  </ul>
                ) : null}
                {/* Ticked classes stay visible when the heading is closed (FR-11). */}
                {!open && ticked.length ? (
                  <ul
                    className="space-y-2 px-3 pb-3"
                    data-testid={`category-${c.id}-ticked`}
                  >
                    {ticked.map((g) => renderGroup(g, "-ticked"))}
                  </ul>
                ) : null}
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
          <strong>{SDA_ONLY_LEAD}</strong> {SDA_ONLY_TEXT}
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

      <StepButtons pending={pending} backHref={stepHref("business")} />
    </form>
  );
}
