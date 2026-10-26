import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  loadPreference,
  nextPreference,
  parsePreference,
  resolveTheme,
  savePreference,
} from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe("parsePreference", () => {
  it("accepts the two explicit themes and treats anything else as system", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("purple")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("follows the system only when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("nextPreference", () => {
  it("cycles system, light, dark and back", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });
});

describe("storage", () => {
  it("saves explicit themes and forgets the choice for system", () => {
    const storage = memoryStorage();

    savePreference("dark", storage);
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(loadPreference(storage)).toBe("dark");

    savePreference("system", storage);
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(loadPreference(storage)).toBe("system");
  });

  it("survives a storage that throws, as in a private window", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    expect(loadPreference(broken)).toBe("system");
    expect(() => savePreference("dark", broken)).not.toThrow();
  });
});
