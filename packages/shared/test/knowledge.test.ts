import { describe, expect, it } from "vitest";
import {
  CreateKnowledgeTextRequestSchema,
  CreateUploadUrlRequestSchema,
  KNOWLEDGE_FILE_MAX_BYTES,
  KNOWLEDGE_TEXT_MAX_LENGTH,
} from "../src";

describe("POST /api/projects/:id/knowledge/upload-url", () => {
  it("accepts pdf, md and txt up to 10 MB", () => {
    for (const fileName of ["guide.pdf", "README.md", "notes.TXT"]) {
      expect(
        CreateUploadUrlRequestSchema.safeParse({ fileName, sizeBytes: KNOWLEDGE_FILE_MAX_BYTES })
          .success,
      ).toBe(true);
    }
  });

  it("rejects a size over 10 MB", () => {
    expect(KNOWLEDGE_FILE_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(
      CreateUploadUrlRequestSchema.safeParse({
        fileName: "guide.pdf",
        sizeBytes: KNOWLEDGE_FILE_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a .docx", () => {
    expect(
      CreateUploadUrlRequestSchema.safeParse({ fileName: "guide.docx", sizeBytes: 1000 }).success,
    ).toBe(false);
  });
});

describe("POST /api/projects/:id/knowledge", () => {
  it("rejects text over KNOWLEDGE_TEXT_MAX_LENGTH", () => {
    expect(CreateKnowledgeTextRequestSchema.safeParse({ title: "FAQ", content: "x" }).success).toBe(
      true,
    );
    expect(
      CreateKnowledgeTextRequestSchema.safeParse({
        title: "FAQ",
        content: "x".repeat(KNOWLEDGE_TEXT_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});
