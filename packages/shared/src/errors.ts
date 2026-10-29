import { z } from "zod";

export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_input",
  "plan_required",
  "limit_reached",
  "rate_limited",
  "quota_exceeded",
  "blocked",
  "internal",
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/** The HTTP status each error code is sent with. */
export const API_ERROR_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  plan_required: 402,
  limit_reached: 403,
  rate_limited: 429,
  quota_exceeded: 429,
  blocked: 403,
  internal: 500,
} as const satisfies Record<ApiErrorCode, number>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
