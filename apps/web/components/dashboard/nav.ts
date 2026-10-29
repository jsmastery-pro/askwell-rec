export type NavItemConfig = { label: string; href: string };

export const DASHBOARD_NAV: readonly NavItemConfig[] = [
  { label: "Projects", href: "/dashboard" },
  { label: "Billing", href: "/dashboard/billing" },
];

/** Projects (`/dashboard`) is active only on its own page; the other items match their subtree. */
export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}
