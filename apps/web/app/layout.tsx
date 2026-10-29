import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { APP_NAME } from "@askwell/shared";
import {
  AFTER_SIGN_IN_URL,
  AFTER_SIGN_OUT_URL,
  AFTER_SIGN_UP_URL,
  SIGN_IN_URL,
  SIGN_UP_URL,
} from "../lib/auth/routes";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: `${APP_NAME} is an AI support chat widget for any website.`,
  openGraph: { siteName: APP_NAME },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-fg antialiased">
        <ClerkProvider
          signInUrl={SIGN_IN_URL}
          signUpUrl={SIGN_UP_URL}
          signInFallbackRedirectUrl={AFTER_SIGN_IN_URL}
          signUpFallbackRedirectUrl={AFTER_SIGN_UP_URL}
          afterSignOutUrl={AFTER_SIGN_OUT_URL}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
