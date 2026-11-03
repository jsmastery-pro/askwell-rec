import { PROJECT_ID } from "../projects/stub";

export const SOURCE_ID = "33333333-3333-4333-8333-333333333333";
export const OTHER_SOURCE_ID = "44444444-4444-4444-8444-444444444444";

/** A `knowledge_sources` row as PostgREST returns it (Postgres timestamps, snake_case). */
export function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SOURCE_ID,
    project_id: PROJECT_ID,
    title: "Shipping policy",
    type: "text",
    status: "ready",
    created_at: "2026-11-02T10:00:00.123456+00:00",
    ...overrides,
  };
}

export const SOURCE = {
  id: SOURCE_ID,
  projectId: PROJECT_ID,
  title: "Shipping policy",
  type: "pdf" as const,
  status: "uploading" as const,
  createdAt: "2026-11-02T10:00:00.123456+00:00",
};

export const UPLOAD_URL =
  "https://ref.supabase.co/storage/v1/object/upload/sign/knowledge/p/s.pdf?token=t";

type Listener = ((event: ProgressEvent) => void) | null;

/** Stands in for XMLHttpRequest: records the PUT and lets a test report progress and finish it. */
export class FakeXhr {
  static last: FakeXhr | null = null;
  static status = 200;
  /** Report this progress, then finish, as soon as send() is called. */
  static progress: [number, number][] = [];
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  upload: { onprogress: Listener } = { onprogress: null };
  onload: Listener = null;
  onerror: Listener = null;
  onabort: Listener = null;
  ontimeout: Listener = null;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body: unknown) {
    this.body = body;
    queueMicrotask(() => {
      for (const [loaded, total] of FakeXhr.progress) {
        this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
      }
      this.status = FakeXhr.status;
      if (FakeXhr.status === 0) this.onerror?.({} as ProgressEvent);
      else this.onload?.({} as ProgressEvent);
    });
  }

  static reset() {
    FakeXhr.last = null;
    FakeXhr.status = 200;
    FakeXhr.progress = [];
  }
}

/** A File of `size` bytes without allocating them. */
export function fakeFile(name: string, size: number, type = "") {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}
