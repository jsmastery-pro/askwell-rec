import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Any ClerkProvider that renders is recorded, so a test can tell whether a tree includes one.
const clerkProvider = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-clerk-provider="">{children}</div>
  )),
);
vi.mock("@clerk/nextjs", () => ({ ClerkProvider: clerkProvider }));

import RootLayout from "../../app/layout";
import SiteLayout from "../../app/(site)/layout";

const APP = fileURLToPath(new URL("../../app", import.meta.url));

describe("/embed has no Clerk (§9)", () => {
  it("the root layout, which /embed renders in, has no ClerkProvider", () => {
    clerkProvider.mockClear();
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>embed panel</p>
      </RootLayout>,
    );
    expect(clerkProvider).not.toHaveBeenCalled();
    expect(html).not.toContain("data-clerk-provider");
    expect(html).toContain("embed panel");
  });

  it("the (site) layout wraps its pages in ClerkProvider with the same redirect props", () => {
    clerkProvider.mockClear();
    renderToStaticMarkup(
      <SiteLayout>
        <p>dashboard</p>
      </SiteLayout>,
    );
    expect(clerkProvider).toHaveBeenCalledTimes(1);
    expect(clerkProvider.mock.calls[0]![0]).toMatchObject({
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      signInFallbackRedirectUrl: "/dashboard",
      signUpFallbackRedirectUrl: "/dashboard",
      afterSignOutUrl: "/sign-in",
    });
  });

  it("puts /embed outside the (site) group, and every Clerk page inside it", () => {
    expect(existsSync(join(APP, "embed/page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "(site)/embed"))).toBe(false);
    for (const page of ["page.tsx", "dashboard", "sign-in", "sign-up"]) {
      expect(existsSync(join(APP, "(site)", page)), page).toBe(true);
      expect(existsSync(join(APP, page)), `${page} left at the root`).toBe(false);
    }
  });

  it("nothing /embed renders imports Clerk", async () => {
    const files = (await readdir(join(APP, "embed"), { recursive: true }))
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => join(APP, "embed", f));
    files.push(join(APP, "layout.tsx"));
    const components = fileURLToPath(new URL("../../components/embed", import.meta.url));
    for (const f of await readdir(components)) files.push(join(components, f));
    for (const file of files) {
      expect(await readFile(file, "utf8"), file).not.toMatch(/@clerk\//);
    }
  });
});
