import { afterEach, describe, expect, test } from "bun:test";

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
  dispatchEvent: () => true,
};
globalThis.CustomEvent ??= class extends Event {};

const { initialStartPageSelection, readStartPage, writeStartPage } = await import("./start-page.ts");

describe("start page", () => {
  afterEach(() => store.clear());

  test("a saved start page selects its note and notebook on a plain load only", () => {
    writeStartPage({ memoId: "memo_a", notebookId: "nb_a", title: "IPTV Activities" });
    expect(initialStartPageSelection("/", "")).toEqual({ selectedMemoId: "memo_a", selectedNotebookId: "nb_a" });
    expect(initialStartPageSelection("/settings", "")).toBeNull();
    expect(initialStartPageSelection("/", "?view=trash")).toBeNull();
    expect(initialStartPageSelection("/", "", "#memo=memo_b")).toBeNull();
  });

  test("clearing or corrupt storage falls back to no start page", () => {
    writeStartPage({ memoId: "memo_a", notebookId: null, title: "" });
    writeStartPage(null);
    expect(readStartPage()).toBeNull();
    store.set("edgeever.startPage", "{not json");
    expect(initialStartPageSelection("/", "")).toBeNull();
  });
});
