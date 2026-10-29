import type { Metadata } from "next";
import { APP_NAME } from "@askwell/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: `${APP_NAME} is an AI support chat widget for any website.`,
  openGraph: { siteName: APP_NAME },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">{children}</body>
    </html>
  );
}
