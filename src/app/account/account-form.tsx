"use client";
/**
 * One form for both "about your business" (account creation, REQ-004 FR-2)
 * and account settings (FR-5). Validation is the REQ-003 business schema on
 * the client and again in the server action.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  browserStorage,
  createLocalDraftStore,
} from "@/lib/questionnaire/draft-store";
import { firstIncompleteStep, stepHref } from "@/lib/questionnaire/navigation";
import {
  BusinessStep,
  State,
  type BusinessStructureAnswer,
} from "@/lib/questionnaire/schema";
import { parseInput } from "@/lib/validation";
import {
  createAccountAction,
  saveServerDraft,
  updateAccountAction,
} from "@/server/accounts/actions";
import {
  CheckboxGroup,
  ErrorSummary,
  Field,
  RadioGroup,
  TextInput,
  errorsFor,
  type FieldErrors,
} from "../start/_components/fields";

const STRUCTURES: { value: BusinessStructureAnswer; label: string }[] = [
  { value: "sole-trader", label: "Sole trader" },
  { value: "partnership", label: "Partnership" },
  { value: "company", label: "Company (Pty Ltd)" },
  {
    value: "incorporated-association",
    label: "Incorporated association or not-for-profit",
  },
  { value: "trust", label: "Trust" },
  { value: "other", label: "Other" },
];
const STATES = State.options.map((s) => ({ value: s, label: s }));
const LABELS = {
  tradingName: "Trading name",
  structure: "Business structure",
  states: "States and territories",
  abn: "ABN",
  form: "Account",
};

type Initial = {
  tradingName: string;
  structure?: BusinessStructureAnswer;
  states: State[];
  abn: string;
};

export function AccountForm({
  mode,
  initial,
}: {
  mode: "setup" | "settings";
  initial?: Initial;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Initial>(
    initial ?? { tradingName: "", states: [], abn: "" },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  // Batch 45b item 2: until the client is live a click on the server-rendered
  // button submits the form natively and the page reloads without "Saved.";
  // on a production server that window is real (CI saw it). The button is
  // disabled until hydration, and a click then waits for it, as the
  // questionnaire steps do.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Setup only: prefill from the local questionnaire draft (FR-2).
  useEffect(() => {
    if (mode !== "setup") return;
    let cancelled = false;
    createLocalDraftStore(browserStorage)
      .load()
      .then((draft) => {
        if (cancelled || !draft?.answers.business) return;
        const b = draft.answers.business;
        setValues({
          tradingName: b.tradingName,
          structure: b.structure,
          states: b.states,
          abn: b.abn ?? "",
        });
        setPrefilled(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseInput(BusinessStep, values);
    if (!parsed.ok) {
      setErrors({
        ...parsed.fieldErrors,
        ...(parsed.formErrors.length ? { form: parsed.formErrors } : {}),
      });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r =
        mode === "setup"
          ? await createAccountAction(parsed.data)
          : await updateAccountAction(parsed.data);
      if (!r.ok) {
        setErrors({
          ...r.fieldErrors,
          ...(r.formErrors.length ? { form: r.formErrors } : {}),
        });
        return;
      }
      if (mode === "setup") {
        // AC-3: move the local draft to the account, clear it locally, resume the questionnaire.
        const local = createLocalDraftStore(browserStorage);
        let resume = "/start";
        try {
          const draft = await local.load();
          if (draft) {
            const savedDraft = await saveServerDraft(draft);
            if (savedDraft.ok) {
              await local.clear();
              resume = stepHref(firstIncompleteStep(draft.answers));
            }
          }
        } catch {
          // Local storage unavailable: nothing to migrate.
        }
        router.push(resume);
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6">
      {prefilled ? (
        <p
          role="status"
          className="mb-4 text-sm text-zinc-600 dark:text-zinc-400"
        >
          Filled in from your draft on this device. Check it and continue.
        </p>
      ) : null}
      <ErrorSummary errors={errors} labels={LABELS} />
      <Field
        id="tradingName"
        label={LABELS.tradingName}
        errors={errorsFor(errors, "tradingName")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="tradingName"
            name="tradingName"
            value={values.tradingName}
            onChange={(v) => setValues({ ...values, tradingName: v })}
            describedBy={describedBy}
            invalid={invalid}
            autoComplete="organization"
            maxLength={120}
          />
        )}
      </Field>
      <RadioGroup
        name="structure"
        legend={LABELS.structure}
        options={STRUCTURES}
        value={values.structure}
        onChange={(v) => setValues({ ...values, structure: v })}
        errors={errorsFor(errors, "structure")}
      />
      <CheckboxGroup
        name="states"
        legend={LABELS.states}
        options={STATES}
        values={values.states}
        onChange={(v) => setValues({ ...values, states: v })}
        errors={errorsFor(errors, "states")}
      />
      <Field
        id="abn"
        label={`${LABELS.abn} (optional)`}
        help="11 digits, spaces allowed. Format is checked; nothing is looked up."
        errors={errorsFor(errors, "abn")}
      >
        {(describedBy, invalid) => (
          <TextInput
            id="abn"
            name="abn"
            value={values.abn}
            onChange={(v) => setValues({ ...values, abn: v })}
            describedBy={describedBy}
            invalid={invalid}
            inputMode="numeric"
            maxLength={14}
          />
        )}
      </Field>
      {saved ? (
        <p
          role="status"
          className="mb-4 text-sm text-zinc-700 dark:text-zinc-300"
        >
          Saved.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !hydrated}
        className="btn-primary"
      >
        {busy
          ? "Saving…"
          : mode === "setup"
            ? "Create my account"
            : "Save changes"}
      </button>
    </form>
  );
}
