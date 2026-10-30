import { WidgetChatRequestSchema } from "@askwell/shared";
import { VISITOR_ID_STORAGE_KEY } from "@askwell/shared/embed";

type VisitorStorage = Pick<Storage, "getItem" | "setItem">;

const isVisitorId = (value: unknown): value is string =>
  WidgetChatRequestSchema.shape.visitorId.safeParse(value).success;

// Used when the iframe can't use localStorage (e.g. blocked third-party storage):
// stable for this page load only.
let memoryId: string | null = null;

/**
 * The visitor's random ID, stored in the iframe's localStorage and reused across visits.
 * Falls back to an in-memory ID when storage throws.
 */
export function getVisitorId(storage: () => VisitorStorage = () => window.localStorage): string {
  try {
    // Reading `window.localStorage` itself can throw (SecurityError), so it's inside the try.
    const store = storage();
    const stored = store.getItem(VISITOR_ID_STORAGE_KEY);
    if (isVisitorId(stored)) return stored;
    const id = crypto.randomUUID();
    store.setItem(VISITOR_ID_STORAGE_KEY, id);
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

/** Tests only. */
export function resetMemoryVisitorId() {
  memoryId = null;
}
