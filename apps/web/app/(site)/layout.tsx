import { ClerkProvider } from "@clerk/nextjs";
import {
  AFTER_SIGN_IN_URL,
  AFTER_SIGN_OUT_URL,
  AFTER_SIGN_UP_URL,
  SIGN_IN_URL,
  SIGN_UP_URL,
} from "../../lib/auth/routes";

/**
 * Every page except `/embed`: landing, sign-in/up and the dashboard share one `ClerkProvider`,
 * which stays mounted as you move between them. `/embed` lives outside this group, so customer
 * sites never load clerk-js (§9). The route group adds nothing to URLs.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
      signInFallbackRedirectUrl={AFTER_SIGN_IN_URL}
      signUpFallbackRedirectUrl={AFTER_SIGN_UP_URL}
      afterSignOutUrl={AFTER_SIGN_OUT_URL}
    >
      {children}
    </ClerkProvider>
  );
}
