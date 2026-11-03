import { MAX_KNOWLEDGE_FILE_BYTES } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addKnowledgeText,
  checkKnowledgeFile,
  deleteKnowledgeSource,
  putFile,
  uploadKnowledgeFile,
} from "../../components/knowledge/api";
import { PROJECT_ID } from "../projects/stub";
import { FakeXhr, SOURCE, SOURCE_ID, UPLOAD_URL, fakeFile } from "./stub";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  FakeXhr.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function call(i: number) {
  const [url, init] = fetchMock.mock.calls[i]!;
  return {
    url: String(url),
    method: init?.method,
    body: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
  };
}

const apiError = (code: string, status: number) =>
  Response.json({ error: { code, message: "server text" } }, { status });

describe("addKnowledgeText", () => {
  it("POSTs the title and text to the project's knowledge route", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ source: { ...SOURCE, type: "text", status: "processing" } }, { status: 201 }),
    );
    const result = await addKnowledgeText(PROJECT_ID, { title: "FAQ", content: "Hello" });

    expect(result).toMatchObject({ ok: true, data: { source: { status: "processing" } } });
    expect(call(0)).toEqual({
      url: `/api/projects/${PROJECT_ID}/knowledge`,
      method: "POST",
      body: { title: "FAQ", content: "Hello" },
    });
  });

  it("returns limit_reached as a failure", async () => {
    fetchMock.mockResolvedValueOnce(apiError("limit_reached", 403));
    expect(await addKnowledgeText(PROJECT_ID, { title: "FAQ", content: "Hello" })).toEqual({
      ok: false,
      code: "limit_reached",
      message: "server text",
    });
  });
});

describe("deleteKnowledgeSource", () => {
  it("DELETEs /api/knowledge/:id with no body", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: SOURCE_ID }));
    expect(await deleteKnowledgeSource(SOURCE_ID)).toEqual({ ok: true, data: { id: SOURCE_ID } });
    expect(call(0)).toEqual({
      url: `/api/knowledge/${SOURCE_ID}`,
      method: "DELETE",
      body: undefined,
    });
  });
});

describe("checkKnowledgeFile", () => {
  it.each([
    ["guide.pdf", "pdf", "application/pdf"],
    ["README.MD", "md", "text/markdown"],
    ["notes.v2.txt", "txt", "text/plain"],
  ])("%s → %s, sent as %s", (name, type, contentType) => {
    expect(checkKnowledgeFile(fakeFile(name, 1000))).toEqual({ ok: true, type, contentType });
  });

  it.each(["report.docx", "image.png", "pdf", "archive.pdf.zip", "noextension."])(
    "%s is refused by type",
    (name) => {
      expect(checkKnowledgeFile(fakeFile(name, 1000))).toEqual({ ok: false, reason: "type" });
    },
  );

  it("accepts exactly MAX_KNOWLEDGE_FILE_BYTES, refuses one byte more, a 12 MB file and an empty one", () => {
    expect(checkKnowledgeFile(fakeFile("a.pdf", MAX_KNOWLEDGE_FILE_BYTES)).ok).toBe(true);
    for (const size of [MAX_KNOWLEDGE_FILE_BYTES + 1, 12 * 1024 * 1024, 0]) {
      expect(checkKnowledgeFile(fakeFile("a.pdf", size))).toEqual({ ok: false, reason: "size" });
    }
  });

  it("uses the extension, not the browser's reported type", () => {
    expect(checkKnowledgeFile(fakeFile("a.md", 10, "text/x-markdown"))).toMatchObject({
      contentType: "text/markdown",
    });
  });
});

describe("putFile", () => {
  it("PUTs the file with its content type and reports progress", async () => {
    FakeXhr.progress = [
      [50, 100],
      [100, 100],
    ];
    const file = fakeFile("a.pdf", 100);
    const progress: number[] = [];

    expect(await putFile(UPLOAD_URL, file, "application/pdf", (f) => progress.push(f))).toBe(true);
    expect(FakeXhr.last).toMatchObject({
      method: "PUT",
      url: UPLOAD_URL,
      headers: { "content-type": "application/pdf" },
      body: file,
    });
    expect(progress).toEqual([0.5, 1]);
  });

  it("an HTTP error or a network error resolves false, never throws", async () => {
    FakeXhr.status = 400;
    expect(await putFile(UPLOAD_URL, fakeFile("a.pdf", 1), "application/pdf")).toBe(false);
    FakeXhr.status = 0;
    expect(await putFile(UPLOAD_URL, fakeFile("a.pdf", 1), "application/pdf")).toBe(false);
  });
});

describe("uploadKnowledgeFile", () => {
  const file = fakeFile("Guide.pdf", 2048, "application/pdf");

  function respondReserve(response: Response) {
    fetchMock.mockResolvedValueOnce(response);
  }
  const reserved = () => Response.json({ source: SOURCE, uploadUrl: UPLOAD_URL }, { status: 201 });

  it("upload-url → PUT → finalize, reporting each stage", async () => {
    respondReserve(reserved());
    fetchMock.mockResolvedValueOnce(Response.json({ source: { ...SOURCE, status: "processing" } }));
    FakeXhr.progress = [[1024, 2048]];
    const stages: [string, number | undefined][] = [];

    const result = await uploadKnowledgeFile(PROJECT_ID, file, (stage, fraction) =>
      stages.push([stage, fraction]),
    );

    expect(result).toMatchObject({ ok: true, data: { source: { status: "processing" } } });
    expect(call(0)).toEqual({
      url: `/api/projects/${PROJECT_ID}/knowledge/upload-url`,
      method: "POST",
      body: { fileName: "Guide.pdf", sizeBytes: 2048 },
    });
    expect(FakeXhr.last).toMatchObject({ url: UPLOAD_URL, body: file });
    expect(call(1)).toEqual({
      url: `/api/projects/${PROJECT_ID}/knowledge/finalize`,
      method: "POST",
      body: { sourceId: SOURCE_ID },
    });
    expect(stages).toEqual([
      ["reserve", undefined],
      ["upload", 0],
      ["upload", 0.5],
      ["finalize", undefined],
    ]);
  });

  it("a refused reservation (limit_reached) uploads nothing", async () => {
    respondReserve(apiError("limit_reached", 403));
    expect(await uploadKnowledgeFile(PROJECT_ID, file)).toEqual({
      ok: false,
      stage: "reserve",
      code: "limit_reached",
      message: "server text",
    });
    expect(FakeXhr.last).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a failed PUT deletes the reservation and never finalizes", async () => {
    respondReserve(reserved());
    fetchMock.mockResolvedValueOnce(Response.json({ id: SOURCE_ID }));
    FakeXhr.status = 500;

    expect(await uploadKnowledgeFile(PROJECT_ID, file)).toMatchObject({
      ok: false,
      stage: "upload",
      code: "internal",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(call(1)).toMatchObject({ url: `/api/knowledge/${SOURCE_ID}`, method: "DELETE" });
  });

  it("a file refused at finalize comes back with the finalize stage", async () => {
    respondReserve(reserved());
    fetchMock.mockResolvedValueOnce(apiError("invalid_input", 400));
    expect(await uploadKnowledgeFile(PROJECT_ID, file)).toMatchObject({
      ok: false,
      stage: "finalize",
      code: "invalid_input",
    });
  });

  it("a file that fails the browser check never calls the API", async () => {
    expect(await uploadKnowledgeFile(PROJECT_ID, fakeFile("a.docx", 10))).toMatchObject({
      ok: false,
      code: "invalid_input",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
