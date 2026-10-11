/**
 * Persistence behind the generation runner (REQ-005 FR-6, SR-5). The
 * interface lets the runner be unit-tested with an in-memory store; the
 * Supabase implementation writes with the service key after the caller has
 * verified ownership (D-516).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentModel } from "@/lib/generator/document-model";
import type { QuestionnaireResult } from "@/lib/questionnaire/result";
import { removePrefix, uploadObject } from "./storage";

export type VersionSetRow = {
  id: string;
  account_id: string;
  created_by: string | null;
  answers_snapshot_hash: string;
  derived_result: QuestionnaireResult;
  status: "generating" | "ready" | "failed";
  document_count: number;
  fallback_section_count: number;
  generated_count: number;
  storage_prefix: string;
  created_at: string;
  completed_at: string | null;
};

export type DocumentVersionRow = {
  id: string;
  version_set_id: string;
  account_id: string;
  document_type_id: string;
  version: number;
  status: "ready" | "review";
  storage_path: string;
  model: DocumentModel;
  created_at: string;
};

export type GenerationLogRow = {
  account_id: string;
  version_set_id: string;
  document_type_id: string;
  section_id: string;
  prompt_version: string;
  model: string;
  request_hash: string;
  status: "generated" | "fallback";
  attempts: number;
  input_tokens: number | null;
  output_tokens: number | null;
};

export interface GenerationStore {
  createVersionSet(input: {
    accountId: string;
    createdBy: string;
    answersHash: string;
    result: QuestionnaireResult;
  }): Promise<VersionSetRow>;
  finishVersionSet(
    id: string,
    counts: {
      documents: number;
      fallbackSections: number;
      generated: number;
      status: "ready" | "failed";
    },
  ): Promise<void>;
  insertDocumentVersion(
    input: Omit<DocumentVersionRow, "id" | "created_at">,
  ): Promise<DocumentVersionRow>;
  insertLog(rows: GenerationLogRow[]): Promise<void>;
  putObject(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void>;
}

export class SupabaseGenerationStore implements GenerationStore {
  constructor(private readonly admin: SupabaseClient) {}

  async createVersionSet(input: {
    accountId: string;
    createdBy: string;
    answersHash: string;
    result: QuestionnaireResult;
  }): Promise<VersionSetRow> {
    const r = await this.admin
      .from("version_sets")
      .insert({
        account_id: input.accountId,
        created_by: input.createdBy,
        answers_snapshot_hash: input.answersHash,
        derived_result: input.result,
        status: "generating",
        storage_prefix: input.accountId,
      })
      .select("*")
      .single();
    if (r.error) throw new Error(`version_sets insert: ${r.error.message}`);
    const row = r.data as VersionSetRow;
    const prefix = `${row.account_id}/${row.id}`;
    await this.admin
      .from("version_sets")
      .update({ storage_prefix: prefix })
      .eq("id", row.id);
    return { ...row, storage_prefix: prefix };
  }

  async finishVersionSet(
    id: string,
    counts: {
      documents: number;
      fallbackSections: number;
      generated: number;
      status: "ready" | "failed";
    },
  ): Promise<void> {
    const r = await this.admin
      .from("version_sets")
      .update({
        status: counts.status,
        document_count: counts.documents,
        fallback_section_count: counts.fallbackSections,
        generated_count: counts.generated,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (r.error) throw new Error(`version_sets update: ${r.error.message}`);
  }

  async insertDocumentVersion(
    input: Omit<DocumentVersionRow, "id" | "created_at">,
  ): Promise<DocumentVersionRow> {
    const r = await this.admin
      .from("document_versions")
      .insert(input)
      .select("*")
      .single();
    if (r.error)
      throw new Error(`document_versions insert: ${r.error.message}`);
    return r.data as DocumentVersionRow;
  }

  async insertLog(rows: GenerationLogRow[]): Promise<void> {
    if (rows.length === 0) return;
    const r = await this.admin.from("generation_log").insert(rows);
    if (r.error) throw new Error(`generation_log insert: ${r.error.message}`);
  }

  async putObject(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await uploadObject(this.admin, path, bytes, contentType);
  }
}

/** Removes a version set's objects; used by the purge extension. */
export async function removeVersionSetObjects(
  admin: SupabaseClient,
  prefix: string,
): Promise<number> {
  return removePrefix(admin, prefix);
}
