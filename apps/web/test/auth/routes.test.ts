import { describe, expect, it } from "vitest";
import {
  getRouteAccess,
  isProtectedApi,
  isProtectedPage,
  isPublicRoute,
} from "../../lib/auth/routes";

describe("protected pages", () => {
  it.each(["/dashboard", "/dashboard/", "/dashboard/projects/123", "/dashboard/billing"])(
    "%s needs sign-in and redirects",
    (path) => {
      expect(isProtectedPage(path)).toBe(true);
      expect(getRouteAccess(path)).toBe("protected-page");
    },
  );

  it("does not match siblings of /dashboard", () => {
    expect(isProtectedPage("/dashboardx")).toBe(false);
    expect(isProtectedPage("/")).toBe(false);
  });
});

describe("protected API routes", () => {
  it.each([
    "/api/projects",
    "/api/projects/abc",
    "/api/projects/abc/config",
    "/api/knowledge",
    "/api/knowledge/sources/1",
    "/api/conversations",
    "/api/conversations/xyz",
  ])("%s needs sign-in and gets 401 JSON", (path) => {
    expect(isProtectedApi(path)).toBe(true);
    expect(getRouteAccess(path)).toBe("protected-api");
  });

  it("does not match siblings", () => {
    expect(isProtectedApi("/api/projectsx")).toBe(false);
  });
});

describe("public routes", () => {
  it.each([
    "/",
    "/sign-in",
    "/sign-in/factor-one",
    "/sign-up",
    "/sign-up/verify-email-address",
    "/embed",
    "/embed/abc",
    "/api/widget/config",
    "/api/widget/chat",
    "/api/clerk/webhook",
    "/api/posthog-config",
  ])("%s is open", (path) => {
    expect(isPublicRoute(path)).toBe(true);
    expect(getRouteAccess(path)).toBe("public");
  });

  it("does not open siblings of the exact paths", () => {
    expect(isPublicRoute("/api/clerk/webhook/extra")).toBe(false);
    expect(isPublicRoute("/api/posthog-config/x")).toBe(false);
  });
});

describe("unlisted paths", () => {
  it("leaves unlisted pages open", () => {
    expect(getRouteAccess("/pricing")).toBe("public");
  });

  it("closes unlisted API routes until someone opens them", () => {
    expect(getRouteAccess("/api/new-thing")).toBe("protected-api");
    expect(getRouteAccess("/api")).toBe("protected-api");
  });
});

describe("path tricks", () => {
  it.each(["/%64ashboard", "//dashboard", "/dashboard//x", "/api//projects", "/api/%70rojects"])(
    "%s is still protected",
    (path) => {
      expect(getRouteAccess(path)).not.toBe("public");
    },
  );

  it("survives a malformed escape", () => {
    expect(getRouteAccess("/dashboard/%E0%A4%A")).toBe("protected-page");
  });
});
