/** `/embed` with an unknown or bad key, or when the config can't load. */
export function EmbedUnavailable() {
  return (
    <div
      data-theme="light"
      role="status"
      className="flex h-dvh items-center justify-center bg-surface-raised p-6 text-center text-fg"
    >
      <div>
        <h1 className="text-sm font-semibold">Chat unavailable</h1>
        <p className="mt-1 text-sm text-fg-muted">This chat can&apos;t be loaded right now.</p>
      </div>
    </div>
  );
}
