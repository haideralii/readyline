/**
 * Model access behind one interface (REQ-005 D-502). `ReplayClient` serves
 * recorded fixtures keyed by the request hash and fails loudly when one is
 * missing, so CI never calls the network. `RecordingClient` wraps a real
 * client and writes fixtures. `AnthropicClient` is the only real
 * implementation and is constructed only in record mode. Every reply carries
 * the API's stop reason so a truncated reply is recognised (R-6).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { requestHash, type ModelRequest } from "./prompts";

export type ModelUsage = { inputTokens: number; outputTokens: number };
export type StopReason = "end_turn" | "max_tokens" | "other" | null;
export type ModelReply = {
  text: string;
  usage: ModelUsage | null;
  stopReason: StopReason;
};

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
function inferStopReason(fixture: Fixture): StopReason {
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
export class AnthropicClient implements ModelClient {
  readonly mode = "record" as const;
  constructor(private readonly apiKey: string) {}
  async complete(request: ModelRequest): Promise<ModelReply> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });
    const message = await client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
    });
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
      },
      stopReason,
    };
  }
}

/** Replay unless GENERATION_RECORD=1 and a key exist (record mode writes fixtures through a real call). */
export function createModelClient(
  env: Record<string, string | undefined> = process.env,
  dir: string = DEFAULT_FIXTURES_DIR,
): ModelClient {
  const record = env.GENERATION_RECORD === "1";
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (record && key) return new RecordingClient(new AnthropicClient(key), dir);
  return new ReplayClient(dir);
}
