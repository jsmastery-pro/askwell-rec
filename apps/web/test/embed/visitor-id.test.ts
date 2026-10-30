import { VISITOR_ID_STORAGE_KEY } from "@askwell/shared/embed";
import { beforeEach, describe, expect, it } from "vitest";
import { getVisitorId, resetMemoryVisitorId } from "../../components/embed/visitor-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("getVisitorId", () => {
  beforeEach(() => {
    resetMemoryVisitorId();
  });

  it("creates a random UUID and stores it under VISITOR_ID_STORAGE_KEY", () => {
    const storage = memoryStorage();
    const id = getVisitorId(() => storage);
    expect(id).toMatch(UUID);
    expect(storage.map.get(VISITOR_ID_STORAGE_KEY)).toBe(id);
  });

  it("reuses the stored ID across visits", () => {
    const storage = memoryStorage();
    const first = getVisitorId(() => storage);
    expect(getVisitorId(() => storage)).toBe(first);
    expect(storage.map.size).toBe(1);
  });

  it("reuses an ID stored by an earlier page load", () => {
    const saved = "6f1c2a1e-6b0e-4c3a-9a43-1f7f3b1b9e10";
    expect(getVisitorId(() => memoryStorage({ [VISITOR_ID_STORAGE_KEY]: saved }))).toBe(saved);
  });

  it("replaces a stored value that isn't a UUID", () => {
    const storage = memoryStorage({ [VISITOR_ID_STORAGE_KEY]: "<script>" });
    const id = getVisitorId(() => storage);
    expect(id).toMatch(UUID);
    expect(storage.map.get(VISITOR_ID_STORAGE_KEY)).toBe(id);
  });

  it("falls back to one in-memory ID when storage access throws", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    const first = getVisitorId(blocked);
    expect(first).toMatch(UUID);
    expect(getVisitorId(blocked)).toBe(first);
  });

  it("falls back when writing throws (quota or blocked)", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };
    const first = getVisitorId(() => storage);
    expect(first).toMatch(UUID);
    expect(getVisitorId(() => storage)).toBe(first);
  });
});
