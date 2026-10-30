import {
  API_ERROR_STATUS,
  WidgetConfigRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type WidgetConfigResponse,
} from "@askwell/shared";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicWidgetConfig } from "../../../../lib/widget-config";

// Called by the loader on any customer site (project.md §9 CORS). No credentials.
// `no-store` so a config change shows on the next page load.
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function errorResponse(code: ApiErrorCode, message: string) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, { status: API_ERROR_STATUS[code], headers: HEADERS });
}

export async function GET(request: NextRequest) {
  const parsed = WidgetConfigRequestSchema.safeParse({
    key: request.nextUrl.searchParams.get("key") ?? undefined,
  });
  if (!parsed.success) return errorResponse("invalid_input", "Invalid public key.");

  let config;
  try {
    config = await getPublicWidgetConfig(parsed.data.key);
  } catch (error) {
    console.error(error);
    return errorResponse("internal", "Could not load the widget config.");
  }
  if (!config) return errorResponse("not_found", "Unknown public key.");

  const body: WidgetConfigResponse = { config };
  return NextResponse.json(body, { headers: HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
