// @vitest-environment jsdom
import { PLAN_LIMITS } from "@askwell/shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddTextForm,
  REFRESH_INTERVAL_MS,
  RefreshWhileProcessing,
  SourceActions,
  UploadFileForm,
} from "../../components/knowledge";
import { PROJECT_ID } from "../projects/stub";
import { FakeXhr, SOURCE, SOURCE_ID, UPLOAD_URL, fakeFile } from "./stub";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn<typeof fetch>();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
  FakeXhr.reset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  fetchMock.mockReset();
  refresh.mockReset();
});

const $ = <T extends Element = HTMLElement>(selector: string) =>
  container.querySelector<T>(selector)!;
const alertText = () => container.querySelector('[role="alert"]')?.textContent ?? null;
const buttonByText = (text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === text)!;

const apiError = (code: string, status: number) =>
  Response.json({ error: { code, message: "server text" } }, { status });

async function pick(file: File) {
  const input = $<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function type(selector: string, value: string) {
  const el = $<HTMLInputElement | HTMLTextAreaElement>(selector);
  const proto = Object.getPrototypeOf(el) as object;
  const setValue = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  await act(async () => {
    setValue.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("UploadFileForm", () => {
  beforeEach(async () => {
    await act(async () => root.render(<UploadFileForm projectId={PROJECT_ID} plan="free" />));
  });

  it("accepts only PDF, Markdown and TXT in the file picker", () => {
    expect($<HTMLInputElement>('input[type="file"]').accept).toBe(
      ".pdf,.md,.txt,application/pdf,text/markdown,text/plain",
    );
  });

  it("refuses a .docx in the browser, with a clear message and no request", async () => {
    await pick(fakeFile("report.docx", 1000));
    expect(alertText()).toBe("report.docx can't be added. Use a PDF, Markdown (.md) or TXT file.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a 12 MB file in the browser, with a clear message and no request", async () => {
    await pick(fakeFile("big.pdf", 12 * 1024 * 1024));
    expect(alertText()).toBe("big.pdf is 12 MB. Files can be up to 10 MB.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads, shows progress, then refreshes the list", async () => {
    let finishFinalize!: (response: Response) => void;
    fetchMock
      .mockResolvedValueOnce(Response.json({ source: SOURCE, uploadUrl: UPLOAD_URL }))
      .mockReturnValueOnce(new Promise((resolve) => (finishFinalize = resolve)));
    FakeXhr.progress = [[40, 100]];

    await pick(fakeFile("Guide.pdf", 100));
    expect($('[role="status"]').textContent).toBe("Checking Guide.pdf…");
    expect($<HTMLInputElement>('input[type="file"]').disabled).toBe(true);
    expect(refresh).not.toHaveBeenCalled();

    await act(async () =>
      finishFinalize(Response.json({ source: { ...SOURCE, status: "processing" } })),
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(alertText()).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(FakeXhr.last?.headers["content-type"]).toBe("application/pdf");
  });

  it("shows the percentage while the file is sent", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ source: SOURCE, uploadUrl: UPLOAD_URL }));
    // The PUT never finishes, so the upload stage stays on screen.
    vi.stubGlobal(
      "XMLHttpRequest",
      class extends FakeXhr {
        override send() {
          queueMicrotask(() =>
            this.upload.onprogress?.({
              lengthComputable: true,
              loaded: 42,
              total: 100,
            } as ProgressEvent),
          );
        }
      },
    );
    await pick(fakeFile("Guide.pdf", 100));
    expect($('[role="status"]').textContent).toBe("Uploading Guide.pdf… 42%");
    expect($<HTMLProgressElement>("progress").value).toBeCloseTo(0.42);
  });

  it("at the limit, shows the limit message", async () => {
    fetchMock.mockResolvedValueOnce(apiError("limit_reached", 403));
    await pick(fakeFile("Guide.pdf", 100));
    expect(alertText()).toContain(
      `The Free plan allows ${PLAN_LIMITS.free.knowledgeSourcesPerProject} sources per project.`,
    );
  });

  it("a file refused at finalize says so", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ source: SOURCE, uploadUrl: UPLOAD_URL }))
      .mockResolvedValueOnce(apiError("invalid_input", 400));
    await pick(fakeFile("Guide.pdf", 100));
    expect(alertText()).toContain("The file was refused");
    expect(refresh).toHaveBeenCalled();
  });
});

describe("AddTextForm", () => {
  beforeEach(async () => {
    await act(async () => root.render(<AddTextForm projectId={PROJECT_ID} plan="free" />));
  });

  async function submit() {
    await act(async () => {
      $<HTMLFormElement>("form").requestSubmit();
    });
  }

  it("is disabled until both fields have text", async () => {
    expect(buttonByText("Add text").disabled).toBe(true);
    await type('input[name="title"]', "FAQ");
    expect(buttonByText("Add text").disabled).toBe(true);
    await type('textarea[name="content"]', "We ship worldwide.");
    expect(buttonByText("Add text").disabled).toBe(false);
  });

  it("sends the text, clears the form and refreshes", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ source: { ...SOURCE, type: "text", status: "processing" } }, { status: 201 }),
    );
    await type('input[name="title"]', "FAQ");
    await type('textarea[name="content"]', "We ship worldwide.");
    await submit();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/projects/${PROJECT_ID}/knowledge`);
    expect(JSON.parse(String(init?.body))).toEqual({ title: "FAQ", content: "We ship worldwide." });
    expect($<HTMLInputElement>('input[name="title"]').value).toBe("");
    expect($<HTMLTextAreaElement>('textarea[name="content"]').value).toBe("");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("limit_reached shows the limit message and keeps the text", async () => {
    fetchMock.mockResolvedValueOnce(apiError("limit_reached", 403));
    await type('input[name="title"]', "FAQ");
    await type('textarea[name="content"]', "We ship worldwide.");
    await submit();

    expect(alertText()).toContain("The Free plan allows");
    expect($<HTMLInputElement>('input[name="title"]').value).toBe("FAQ");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("SourceActions", () => {
  beforeEach(async () => {
    await act(async () =>
      root.render(<SourceActions source={{ id: SOURCE_ID, title: "<b>FAQ</b>" }} />),
    );
  });

  it("asks to confirm, then deletes and refreshes", async () => {
    await act(async () => buttonByText("Delete").click());
    expect(fetchMock).not.toHaveBeenCalled();
    expect($("strong").textContent).toBe("<b>FAQ</b>");
    expect($("strong").children).toHaveLength(0);

    fetchMock.mockResolvedValueOnce(Response.json({ id: SOURCE_ID }));
    await act(async () => buttonByText("Delete source").click());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/knowledge/${SOURCE_ID}`);
    expect(init?.method).toBe("DELETE");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cancel goes back without a request", async () => {
    await act(async () => buttonByText("Delete").click());
    await act(async () => buttonByText("Cancel").click());
    expect(buttonByText("Delete")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a failed delete shows why", async () => {
    fetchMock.mockResolvedValueOnce(apiError("not_found", 404));
    await act(async () => buttonByText("Delete").click());
    await act(async () => buttonByText("Delete source").click());
    expect(alertText()).toBe("This source no longer exists. Reload the page.");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("RefreshWhileProcessing", () => {
  it("refreshes every few seconds while active, and stops when nothing is processing", async () => {
    vi.useFakeTimers();
    await act(async () => root.render(<RefreshWhileProcessing active />));

    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2));
    expect(refresh).toHaveBeenCalledTimes(2);

    await act(async () => root.render(<RefreshWhileProcessing active={false} />));
    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 3));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("skips refreshes while the tab is hidden", async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    await act(async () => root.render(<RefreshWhileProcessing active />));
    act(() => vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 2));
    expect(refresh).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });
});
