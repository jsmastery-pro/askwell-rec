import "server-only";
import type { KnowledgeFileType } from "@askwell/shared";
import { extractText as extractPdfText } from "unpdf";

/**
 * The text of an uploaded file. PDF through `unpdf`; Markdown and TXT as UTF-8.
 * Throws on a file that isn't what its type says (bad PDF bytes, invalid UTF-8).
 */
export async function extractText(bytes: Uint8Array, type: KnowledgeFileType): Promise<string> {
  if (type === "pdf") {
    // pdf.js takes ownership of the buffer it's given, so pass a copy.
    const { text } = await extractPdfText(new Uint8Array(bytes), { mergePages: true });
    return text;
  }
  // fatal: a binary file renamed to .txt fails here instead of becoming mojibake chunks.
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
