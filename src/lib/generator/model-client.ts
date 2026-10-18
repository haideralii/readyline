/**
 * Model access behind one interface (REQ-005 D-502). `ReplayClient` serves
 * recorded fixtures keyed by the request hash and fails loudly when one is
 * missing, so CI never calls the network. `RecordingClient` wraps a real
 * client and writes fixtures. `AnthropicClient` is the only real
 * implementation and is constructed only in record mode. Every reply carries
 * the API's stop reason so a truncated reply is recognised (R-6).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fakeRedraftReply } from "./fake-redraft";
import { join } from "node:path";
import type {
  Message,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/messages";
import { requestHash, type ModelRequest } from "./prompts";

export type ModelUsage = {
  /** Uncached input tokens, as the API counts them. */
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache writes and reads (D-046); absent in fixtures recorded before caching. */
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};
export type StopReason = "end_turn" | "max_tokens" | "other" | null;
export type ModelReply = {
  text: string;
  usage: ModelUsage | null;
  stopReason: StopReason;
  /** Content block types the API returned, in order (D-530: non-text blocks spend output tokens too). */
  contentTypes?: string[];
  /** The thinking setting the request sent (D-530); "between_tools" is "off" for this model family. */
  thinking?: ThinkingSetting;
};
/** "between_tools" is "off" for the Sonnet family; "disabled" for models that refuse it; "none" when a model refuses both and gets no parameter. */
export type ThinkingSetting = "between_tools" | "disabled" | "none";
export const THINKING_SETTING =
  "between_tools" as const satisfies ThinkingSetting;

export interface ModelClient {
  readonly mode: "replay" | "record" | "fake";
  complete(request: ModelRequest, labels: FixtureLabels): Promise<ModelReply>;
}

/** Where a fixture is filed: documentType/sectionId/<hash>.json */
export type FixtureLabels = { documentTypeId: string; sectionId: string };

export type Fixture = {
  hash: string;
  promptVersion: string;
  model: string;
  documentTypeId: string;
  sectionId: string;
  recordedAt: string;
  usage: ModelUsage | null;
  /** Absent in fixtures recorded before R-6; replay infers truncation from the usage then. */
  stopReason?: StopReason;
  /** Absent in fixtures recorded before D-530 (thinking left at the model's default). */
  thinking?: ThinkingSetting;
  contentTypes?: string[];
  request: { system: string; user: string; maxTokens: number };
  reply: string;
};

export const DEFAULT_FIXTURES_DIR = join("fixtures", "generation");

export function fixturePath(
  dir: string,
  labels: FixtureLabels,
  hash: string,
): string {
  return join(dir, labels.documentTypeId, labels.sectionId, `${hash}.json`);
}

/** The fixture recorded for this exact prompt, if any. */
export function readFixture(
  request: ModelRequest,
  labels: FixtureLabels,
  dir: string = DEFAULT_FIXTURES_DIR,
): Fixture | null {
  const path = fixturePath(dir, labels, requestHash(request));
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Fixture)
    : null;
}

/** True when a fixture for this exact request already exists (used to avoid re-spending). */
export function hasFixture(
  request: ModelRequest,
  labels: FixtureLabels,
  dir: string = DEFAULT_FIXTURES_DIR,
): boolean {
  return existsSync(fixturePath(dir, labels, requestHash(request)));
}

export class MissingFixtureError extends Error {
  readonly hash: string;
  readonly path: string;
  constructor(hash: string, path: string, request: ModelRequest) {
    super(
      `No recorded fixture for this request (prompt ${request.promptVersion}, model ${request.model}). ` +
        `Expected ${path}. Re-record locally with GENERATION_RECORD=1 and a real key; CI never calls the model.`,
    );
    this.name = "MissingFixtureError";
    this.hash = hash;
    this.path = path;
  }
}

/** Fixtures recorded before stop reasons were kept: a reply that used the whole cap was cut off. */
export function inferStopReason(fixture: Fixture): StopReason {
  if (fixture.stopReason !== undefined) return fixture.stopReason;
  if (
    fixture.usage &&
    fixture.request.maxTokens > 0 &&
    fixture.usage.outputTokens >= fixture.request.maxTokens
  )
    return "max_tokens";
  return null;
}

export class ReplayClient implements ModelClient {
  readonly mode = "replay" as const;
  constructor(private readonly dir: string = DEFAULT_FIXTURES_DIR) {}
  async complete(
    request: ModelRequest,
    labels: FixtureLabels,
  ): Promise<ModelReply> {
    const hash = requestHash(request);
    const path = fixturePath(this.dir, labels, hash);
    if (!existsSync(path)) throw new MissingFixtureError(hash, path, request);
    const fixture = JSON.parse(readFileSync(path, "utf8")) as Fixture;
    return {
      text: fixture.reply,
      usage: fixture.usage,
      stopReason: inferStopReason(fixture),
    };
  }
}

export class RecordingClient implements ModelClient {
  readonly mode = "record" as const;
  readonly written: string[] = [];
  constructor(
    private readonly inner: ModelClient,
    private readonly dir: string = DEFAULT_FIXTURES_DIR,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async complete(
    request: ModelRequest,
    labels: FixtureLabels,
  ): Promise<ModelReply> {
    const reply = await this.inner.complete(request, labels);
    const hash = requestHash(request);
    const path = fixturePath(this.dir, labels, hash);
    mkdirSync(join(this.dir, labels.documentTypeId, labels.sectionId), {
      recursive: true,
    });
    const fixture: Fixture = {
      hash,
      promptVersion: request.promptVersion,
      model: request.model,
      documentTypeId: labels.documentTypeId,
      sectionId: labels.sectionId,
      recordedAt: this.now().toISOString(),
      usage: reply.usage,
      stopReason: reply.stopReason,
      ...(reply.thinking ? { thinking: reply.thinking } : {}),
      ...(reply.contentTypes ? { contentTypes: reply.contentTypes } : {}),
      request: {
        system: request.system,
        user: request.user,
        maxTokens: request.maxTokens,
      },
      reply: reply.text,
    };
    writeFileSync(path, JSON.stringify(fixture, null, 2) + "\n");
    this.written.push(path);
    return reply;
  }
}

export type FakeReply =
  string | { text: string; stopReason?: StopReason; outputTokens?: number };

/** Test double: answers from a queue of replies. */
export class FakeClient implements ModelClient {
  readonly mode = "fake" as const;
  readonly requests: ModelRequest[] = [];
  constructor(private readonly replies: FakeReply[]) {}
  async complete(request: ModelRequest): Promise<ModelReply> {
    this.requests.push(request);
    const next = this.replies.shift();
    if (next === undefined) throw new Error("FakeClient has no more replies");
    const r = typeof next === "string" ? { text: next } : next;
    return {
      text: r.text,
      usage: { inputTokens: 100, outputTokens: r.outputTokens ?? 50 },
      stopReason: r.stopReason ?? "end_turn",
    };
  }
}

/**
 * The real client. Imported lazily so the SDK is never loaded in replay mode
 * and never without a key.
 */
/** The one SDK call we make; injectable so the request shape is unit-tested without the network. */
export type CreateMessage = (
  params: MessageCreateParamsNonStreaming,
) => Promise<Message>;

export class AnthropicClient implements ModelClient {
  readonly mode = "record" as const;
  constructor(
    private readonly apiKey: string,
    private readonly create?: CreateMessage,
  ) {}
  async complete(request: ModelRequest): Promise<ModelReply> {
    const create = this.create ?? (await this.sdkCreate());
    // D-046: the system prompt and the per-document block are cache breakpoints
    // (ephemeral, five minutes); the section block comes last so a document's
    // sections share the cached prefix.
    const params: MessageCreateParamsNonStreaming = {
      model: request.model,
      max_tokens: request.maxTokens,
      system: [
        {
          type: "text",
          text: request.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: request.blocks.document,
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: request.blocks.section },
          ],
        },
      ],
      // D-530: non-text blocks count against max_tokens and are not kept, so
      // thinking is switched off. The API rejects {type: "disabled"} for this
      // model family and names "between_tools" as the off setting (we use no
      // tools, so nothing is produced between them).
      thinking: { type: THINKING_SETTING },
    };
    // A model that refuses "between_tools" with a 400 naming "thinking" gets
    // the same request with {type: "disabled"}; one that refuses that too gets
    // it with no thinking parameter. Each step is tried once.
    const { thinking: _omitted, ...withoutThinking } = params;
    void _omitted;
    const attempts: Array<[ThinkingSetting, MessageCreateParamsNonStreaming]> =
      [
        [THINKING_SETTING, params],
        ["disabled", { ...withoutThinking, thinking: { type: "disabled" } }],
        ["none", withoutThinking],
      ];
    let thinking: ThinkingSetting = THINKING_SETTING;
    let message: Message | undefined;
    for (const [setting, candidate] of attempts) {
      try {
        message = await create(candidate);
        thinking = setting;
        break;
      } catch (error) {
        if (!isThinkingRejection(error) || setting === "none") throw error;
      }
    }
    if (!message) throw new Error("no reply");
    const text = message.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const stopReason: StopReason =
      message.stop_reason === "end_turn"
        ? "end_turn"
        : message.stop_reason === "max_tokens"
          ? "max_tokens"
          : "other";
    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheCreationInputTokens:
          message.usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
      },
      stopReason,
      contentTypes: message.content.map((c) => c.type),
      thinking,
    };
  }
  private async sdkCreate(): Promise<CreateMessage> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });
    return (params) => client.messages.create(params);
  }
}

function isThinkingRejection(error: unknown): boolean {
  const e = error as { status?: number; message?: string } | null;
  return (
    typeof e === "object" &&
    e !== null &&
    e.status === 400 &&
    typeof e.message === "string" &&
    /thinking/i.test(e.message)
  );
}

/**
 * REQ-033 Session B (AC-B1 to AC-B3): the e2e's model. A redraft request is
 * answered from the request itself (the current section echoed plus one
 * sentence); every other request goes to the replay client, so the
 * generator's fixtures still rule. Chosen by GENERATION_FAKE=1 alone and
 * never in production.
 */
export class FakeRedraftClient implements ModelClient {
  readonly mode = "fake" as const;
  constructor(private readonly fallback: ModelClient) {}
  async complete(
    request: ModelRequest,
    labels: FixtureLabels,
  ): Promise<ModelReply> {
    const text = fakeRedraftReply(request);
    if (text === null) return this.fallback.complete(request, labels);
    return {
      text,
      usage: { inputTokens: 0, outputTokens: 0 },
      stopReason: "end_turn",
    };
  }
}

/**
 * Replay unless asked otherwise: GENERATION_RECORD=1 with a key writes
 * fixtures through a real call (D-502); GENERATION_LIVE=1 with a key calls
 * the model without touching fixtures and is the production setting for the
 * paid job (REQ-007 FR-5, D-708). CI and the e2e set neither, so a missing
 * fixture fails loudly instead of spending.
 */
export function createModelClient(
  env: Record<string, string | undefined> = process.env,
  dir: string = DEFAULT_FIXTURES_DIR,
): ModelClient {
  const record = env.GENERATION_RECORD === "1";
  const live = env.GENERATION_LIVE === "1";
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (record && key) return new RecordingClient(new AnthropicClient(key), dir);
  if (live && key) return new AnthropicClient(key);
  if (env.GENERATION_FAKE === "1" && env.VERCEL_ENV !== "production")
    return new FakeRedraftClient(new ReplayClient(dir));
  return new ReplayClient(dir);
}
