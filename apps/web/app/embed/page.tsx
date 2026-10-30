import { PublicKeySchema } from "@askwell/shared";
import type { Metadata } from "next";
import { EmbedPanel } from "../../components/embed/EmbedPanel";
import { EmbedUnavailable } from "../../components/embed/EmbedUnavailable";
import { getPublicWidgetConfig } from "../../lib/widget-config";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

type EmbedPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The widget's panel, framed by customer sites (project.md §6.5). No Clerk session here:
 * `proxy.ts` skips `/embed`. A bad or unknown key renders "unavailable" (200), never a crash.
 */
export default async function EmbedPage({ searchParams }: EmbedPageProps) {
  const parsed = PublicKeySchema.safeParse((await searchParams).key);
  if (!parsed.success) return <EmbedUnavailable />;

  let config;
  try {
    config = await getPublicWidgetConfig(parsed.data);
  } catch (error) {
    console.error(error);
    return <EmbedUnavailable />;
  }
  if (!config) return <EmbedUnavailable />;

  // Plan-applied on the server: Free always gets the default header and the badge.
  return (
    <EmbedPanel
      publicKey={parsed.data}
      config={{ headerText: config.headerText, showBadge: config.showBadge }}
    />
  );
}
