import { ApiErrorSchema, type ApiErrorCode } from "@askwell/shared";

export type ApiFailure = { code: ApiErrorCode; message: string };
export type ApiResult<T> = { ok: true; data: T } | ({ ok: false } & ApiFailure);

/** Any schema with zod's `safeParse` (the response schemas in `@askwell/shared`). */
type ResponseSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};

const NETWORK_FAILURE: ApiFailure = { code: "internal", message: "Network error." };

/** Calls one of our JSON routes from the browser. Never throws: failures come back as a result. */
export async function sendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  responseSchema: ResponseSchema<T>,
  body?: unknown,
): Promise<ApiResult<T>> {
  let res: Response;
  let json: unknown;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    json = await res.json().catch(() => undefined);
  } catch {
    return { ok: false, ...NETWORK_FAILURE };
  }

  if (res.ok) {
    const parsed = responseSchema.safeParse(json);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, ...NETWORK_FAILURE };
  }
  const error = ApiErrorSchema.safeParse(json);
  return error.success
    ? { ok: false, ...error.data.error }
    : { ok: false, code: "internal", message: `HTTP ${res.status}` };
}
