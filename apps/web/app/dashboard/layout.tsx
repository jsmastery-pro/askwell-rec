import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "../../components/dashboard/DashboardSidebar";
import { SIGN_IN_URL } from "../../lib/auth/routes";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: proxy.ts already gates /dashboard, but path matching alone can be bypassed.
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect(SIGN_IN_URL);

  return (
    <div data-theme="light" className="min-h-screen bg-surface text-fg md:flex">
      <DashboardSidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}
