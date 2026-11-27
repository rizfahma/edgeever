import { describe, expect, test } from "bun:test";
import { COLOR_SCHEMES, DEFAULT_SCHEME_ID, hexToHslTriplet } from "./color-schemes.ts";

describe("light colour schemes", () => {
  test("hex colours convert to the shadcn HSL triplet format", () => {
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#268bd2")).toBe("205 69.4% 48.6%");
  });

  test("every scheme has a unique id and complete six-digit colours", () => {
    const ids = COLOR_SCHEMES.map((scheme) => scheme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_SCHEME_ID);
    for (const scheme of COLOR_SCHEMES) {
      for (const [key, value] of Object.entries(scheme)) {
        if (key === "id" || key === "label") continue;
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});
