export type UnauthorizedBody = { error: { code: "unauthorized"; message: string } };

export function unauthorizedBody(): UnauthorizedBody {
  return { error: { code: "unauthorized", message: "Sign in required." } };
}
