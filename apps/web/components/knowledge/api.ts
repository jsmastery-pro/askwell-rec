import {
  CreateKnowledgeTextResponseSchema,
  CreateUploadUrlResponseSchema,
  DeleteKnowledgeResponseSchema,
  FinalizeUploadResponseSchema,
  KNOWLEDGE_FILE_MIME_TYPES,
  KNOWLEDGE_FILE_TYPES,
  MAX_KNOWLEDGE_FILE_BYTES,
  type CreateKnowledgeTextRequest,
  type FinalizeUploadResponse,
  type KnowledgeFileType,
} from "@askwell/shared";
import { sendJson, type ApiFailure, type ApiResult } from "../projects/api";

export const addKnowledgeText = (projectId: string, body: CreateKnowledgeTextRequest) =>
  sendJson(`/api/projects/${projectId}/knowledge`, "POST", CreateKnowledgeTextResponseSchema, body);

export const deleteKnowledgeSource = (sourceId: string) =>
  sendJson(`/api/knowledge/${sourceId}`, "DELETE", DeleteKnowledgeResponseSchema);

export type FileCheck =
  | { ok: true; type: KnowledgeFileType; contentType: string }
  | { ok: false; reason: "type" | "size" };

/** Fast feedback before uploading. The server checks again: declared size at upload-url, real size and bytes at finalize. */
export function checkKnowledgeFile(file: Pick<File, "name" | "size">): FileCheck {
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot + 1).toLowerCase();
  const type = KNOWLEDGE_FILE_TYPES.find((t) => t === extension);
  if (!type) return { ok: false, reason: "type" };
  if (file.size <= 0 || file.size > MAX_KNOWLEDGE_FILE_BYTES) return { ok: false, reason: "size" };
  // From the extension, not file.type: browsers often report "" or text/x-markdown for .md.
  return { ok: true, type, contentType: KNOWLEDGE_FILE_MIME_TYPES[type] };
}

/** PUTs the file to a signed Storage URL. XHR, not fetch, for upload progress. Never throws. */
export function putFile(
  url: string,
  file: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = xhr.onabort = xhr.ontimeout = () => resolve(false);
    xhr.send(file);
  });
}

export type UploadStage = "reserve" | "upload" | "finalize";
export type UploadFailure = ApiFailure & { stage: UploadStage };
export type UploadResult =
  { ok: true; data: FinalizeUploadResponse } | ({ ok: false } & UploadFailure);

/**
 * upload-url → PUT to Storage → finalize. `onProgress` gets the stage and, while uploading, the
 * fraction sent. A failed PUT deletes its reservation, so it doesn't hold a slot for 2 hours.
 */
export async function uploadKnowledgeFile(
  projectId: string,
  file: File,
  onProgress?: (stage: UploadStage, fraction?: number) => void,
): Promise<UploadResult> {
  const checked = checkKnowledgeFile(file);
  if (!checked.ok) {
    return {
      ok: false,
      stage: "reserve",
      code: "invalid_input",
      message: `File ${checked.reason}`,
    };
  }

  onProgress?.("reserve");
  const reserved = await sendJson(
    `/api/projects/${projectId}/knowledge/upload-url`,
    "POST",
    CreateUploadUrlResponseSchema,
    { fileName: file.name, sizeBytes: file.size },
  );
  if (!reserved.ok) return fail("reserve", reserved);
  const { source, uploadUrl } = reserved.data;

  onProgress?.("upload", 0);
  const uploaded = await putFile(uploadUrl, file, checked.contentType, (fraction) =>
    onProgress?.("upload", fraction),
  );
  if (!uploaded) {
    await deleteKnowledgeSource(source.id);
    return { ok: false, stage: "upload", code: "internal", message: "Upload failed." };
  }

  onProgress?.("finalize");
  const finalized = await sendJson(
    `/api/projects/${projectId}/knowledge/finalize`,
    "POST",
    FinalizeUploadResponseSchema,
    { sourceId: source.id },
  );
  return finalized.ok ? finalized : fail("finalize", finalized);
}

function fail(stage: UploadStage, failure: ApiResult<unknown> & { ok: false }): UploadResult {
  return { ok: false, stage, code: failure.code, message: failure.message };
}
