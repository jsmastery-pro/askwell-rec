import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "../../../components/dashboard/DashboardSidebar";
import { ErrorState } from "../../../components/ui";
import { ensureAccount } from "../../../lib/accounts";
import { SIGN_IN_URL } from "../../../lib/auth/routes";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Defense in depth: proxy.ts already gates /dashboard, but path matching alone can be bypassed.
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) redirect(SIGN_IN_URL);

  // error.tsx can't catch errors thrown by its own segment's layout, so handle it here.
  let accountReady = true;
  try {
    await ensureAccount(userId);
  } catch (error) {
    console.error(error);
    accountReady = false;
  }

  return (
    <div data-theme="light" className="min-h-screen bg-surface text-fg md:flex">
      <DashboardSidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        {accountReady ? (
          children
        ) : (
          <ErrorState
            title="Something went wrong"
            text="We could not set up your account. Reload the page to try again."
          />
        )}
      </main>
    </div>
  );
}
