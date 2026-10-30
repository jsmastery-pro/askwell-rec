import { API_ERROR_STATUS, type ApiError, type ApiErrorCode } from "@askwell/shared";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UNAUTHORIZED_STATUS, unauthorizedBody } from "../auth/unauthorized";

export function errorResponse(code: ApiErrorCode, message: string) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, { status: API_ERROR_STATUS[code] });
}

export const invalidInput = (message = "Invalid input.") => errorResponse("invalid_input", message);
export const projectNotFound = () => errorResponse("not_found", "Project not found.");

export function internalError(error: unknown) {
  console.error(error);
  return errorResponse("internal", "Something went wrong.");
}

/**
 * The signed-in Clerk user ID, or a 401 response. Every owner route checks this itself,
 * on top of `proxy.ts`.
 */
export async function requireUserId(): Promise<
  { userId: string; response?: never } | { userId?: never; response: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return { response: NextResponse.json(unauthorizedBody(), { status: UNAUTHORIZED_STATUS }) };
  }
  return { userId };
}

/** The JSON body, or `undefined` if it isn't valid JSON (the zod schema then rejects it). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
