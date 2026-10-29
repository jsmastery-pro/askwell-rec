import { APP_NAME } from "@askwell/shared";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-fg-muted sm:flex-row sm:px-6">
        <p>{APP_NAME}: AI support chat for any website.</p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/sign-in" className="hover:text-fg">
            Sign in
          </Link>
          <Link href="/sign-up" className="hover:text-fg">
            Sign up
          </Link>
        </nav>
      </div>
    </footer>
  );
}
