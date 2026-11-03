import { KNOWLEDGE_SOURCE_STATUSES, PLAN_LIMITS } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import {
  fileCheckText,
  knowledgeLimitText,
  sourcesUsedText,
  statusLabel,
  textErrorText,
  typeLabel,
  uploadErrorText,
} from "../../components/knowledge";
import { deleteErrorText } from "../../components/knowledge/messages";
import { fakeFile } from "./stub";

describe("knowledgeLimitText", () => {
  it("follows PLAN_LIMITS for both plans", () => {
    const { free, pro } = PLAN_LIMITS;
    expect(knowledgeLimitText("free")).toBe(
      `The Free plan allows ${free.knowledgeSourcesPerProject} sources per project. Upgrade to Pro for up to ${pro.knowledgeSourcesPerProject} sources.`,
    );
    expect(knowledgeLimitText("pro")).toBe(
      `The Pro plan allows ${pro.knowledgeSourcesPerProject} sources per project. Delete one to add another.`,
    );
  });
});

describe("labels", () => {
  it("uploading shows as Processing", () => {
    expect(KNOWLEDGE_SOURCE_STATUSES.map(statusLabel)).toEqual([
      "Processing",
      "Processing",
      "Ready",
      "Failed",
    ]);
  });

  it("names every source type", () => {
    expect(typeLabel("text")).toBe("Pasted text");
    expect(typeLabel("pdf")).toBe("PDF");
    expect(typeLabel("md")).toBe("Markdown");
    expect(typeLabel("txt")).toBe("Text file");
  });

  it("counts sources used", () => {
    expect(sourcesUsedText(2, 3)).toBe("2 of 3 sources used");
    expect(sourcesUsedText(0, 1)).toBe("0 of 1 source used");
  });
});

describe("fileCheckText", () => {
  it("names the file and says why", () => {
    expect(fileCheckText(fakeFile("report.docx", 10), "type")).toBe(
      "report.docx can't be added. Use a PDF, Markdown (.md) or TXT file.",
    );
    expect(fileCheckText(fakeFile("big.pdf", 12 * 1024 * 1024), "size")).toBe(
      "big.pdf is 12 MB. Files can be up to 10 MB.",
    );
    expect(fileCheckText(fakeFile("empty.txt", 0), "size")).toBe("empty.txt is empty.");
  });
});

describe("error texts", () => {
  const failure = (code: "invalid_input" | "unauthorized" | "not_found" | "internal") => ({
    code,
    message: "server text",
  });

  it("never shows the server's message", () => {
    for (const code of ["invalid_input", "unauthorized", "not_found", "internal"] as const) {
      expect(textErrorText(failure(code))).not.toContain("server text");
      expect(uploadErrorText({ ...failure(code), stage: "finalize" })).not.toContain("server text");
    }
  });

  it("explains a refused upload by stage", () => {
    expect(uploadErrorText({ ...failure("internal"), stage: "upload" })).toBe(
      "The upload didn't finish. Check your connection and try again.",
    );
    expect(uploadErrorText({ ...failure("invalid_input"), stage: "finalize" })).toContain(
      "The file was refused",
    );
    expect(uploadErrorText({ ...failure("invalid_input"), stage: "reserve" })).toBe(
      "Use a PDF, Markdown or TXT file up to 10 MB.",
    );
  });

  it("a missing source on delete says so", () => {
    expect(deleteErrorText(failure("not_found"))).toBe(
      "This source no longer exists. Reload the page.",
    );
    expect(textErrorText(failure("unauthorized"))).toBe("Your session ended. Sign in again.");
  });
});
