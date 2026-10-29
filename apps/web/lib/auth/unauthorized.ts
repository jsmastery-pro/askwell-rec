import { API_ERROR_STATUS, type ApiError } from "@askwell/shared";

export const UNAUTHORIZED_STATUS = API_ERROR_STATUS.unauthorized;

export function unauthorizedBody(): ApiError {
  return { error: { code: "unauthorized", message: "Sign in required." } };
}
