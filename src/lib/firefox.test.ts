import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { comparePrefs, getFirefoxReleaseProfilePath, installedMozilla } from "$lib/firefox";
import { getPathType } from "./helpers";
import { type Pref } from "$lib/firefox";

vi.mock("fs");
vi.mock("os");
vi.mock("path");

vi.mock("./install", () => ({
  getPlatform: () => "linux",
  getArchitecture: () => "x86_64",
}));

vi.mock("$lib/helpers", () => ({
  getPathType: vi.fn<() => Promise<"file" | "directory" | "other" | "missing">>(),
  exit: vi.fn<() => never>(),
}));

describe("getFirefoxReleaseProfilePath", () => {
  const mockHomeDir = "/home/user";
  const mockMozillaPath = `${mockHomeDir}/${installedMozilla}`;
  const mockIniPath = `${mockMozillaPath}/profiles.ini`;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(homedir).mockReturnValue(mockHomeDir);
    vi.mocked(join).mockImplementation((...paths) => paths.join("/"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return null when profiles.ini does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
    expect(existsSync).toHaveBeenCalledWith(mockIniPath);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("should return the correct path when release profile exists", async () => {
    const mockIniContent = `[Install7OQB4VLD66BGRBRQ]
Default=def456.default-release
Locked=1
    
[Profile1]
Name=default
IsRelative=1
Path=abc123.default
Default=1

[Profile0]
Name=default-release
IsRelative=1
Path=def456.default-release

[General]
StartWithLastProfile=1
Version=2`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toStrictEqual({
      profilePath: `${mockMozillaPath}/def456.default-release`,
      hash: "def456",
    });
    expect(existsSync).toHaveBeenCalledWith(mockIniPath);
    expect(readFileSync).toHaveBeenCalledWith(mockIniPath, "utf8");
  });

  it("should return null when no release profile exists", async () => {
    const mockIniContent = `[Profile0]
Name=default
IsRelative=1
Path=abc123.default

[Profile1]
Name=dev
IsRelative=1
Path=def456.dev

[General]
StartWithLastProfile=1
Version=2`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });

  it("should return null when release profile has no Path", async () => {
    const mockIniContent = `[Profile0]
Name=release
IsRelative=1

[General]
StartWithLastProfile=1
Version=2
`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });

  it("should handle empty profiles.ini file", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("");

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });

  it("should handle ini content with extra whitespace", async () => {
    const mockIniContent = `[Profile0]
Name = release  
IsRelative = 1
Path = abc123.release

[General]
StartWithLastProfile=1
Version=2`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toStrictEqual({
      profilePath: `${mockMozillaPath}/abc123.release`,
      hash: "abc123",
    });
  });

  it("should return the first matching release profile when multiple exist", async () => {
    const mockIniContent = `[Profile0]
Name=first-release
IsRelative=1
Path=first.release

[Profile1]
Name=second-release
IsRelative=1
Path=second.release

[General]
StartWithLastProfile=1
Version=2`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);
    vi.mocked(getPathType).mockResolvedValue("file");

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toStrictEqual({
      profilePath: `${mockMozillaPath}/first.release`,
      hash: "first",
    });
  });

  it("should handle case sensitivity in profile names", async () => {
    const mockIniContent = `
[Profile0]
Name=Release
IsRelative=1
Path=abc123.Release

[General]
StartWithLastProfile=1
Version=2`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = await getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });
});

describe("comparePrefs", () => {
  it("should return empty diff when both maps are empty", () => {
    const result = comparePrefs(new Map(), new Map());

    expect(result).toStrictEqual({ addedKeys: [], removedKeys: [], changedKeys: [] });
  });

  it("should return empty diff when both maps are identical", () => {
    const v1 = new Map<string, Pref>([
      ["a.pref", true],
      ["b.pref", 42],
    ]);
    const v2 = new Map<string, Pref>([
      ["a.pref", true],
      ["b.pref", 42],
    ]);

    const result = comparePrefs(v1, v2);

    expect(result).toStrictEqual({ addedKeys: [], removedKeys: [], changedKeys: [] });
  });

  it("should detect added keys (present in v2 but not v1)", () => {
    const v1 = new Map<string, Pref>();
    const v2 = new Map([["new.pref", "hello"]]);

    const result = comparePrefs(v1, v2);

    expect(result.addedKeys).toStrictEqual([{ key: "new.pref", value: "hello" }]);
    expect(result.removedKeys).toHaveLength(0);
    expect(result.changedKeys).toHaveLength(0);
  });

  it("should detect removed keys (present in v1 but not v2)", () => {
    const v1 = new Map([["old.pref", false]]);
    const v2 = new Map<string, Pref>();

    const result = comparePrefs(v1, v2);

    expect(result.removedKeys).toStrictEqual([{ key: "old.pref", value: false }]);
    expect(result.addedKeys).toHaveLength(0);
    expect(result.changedKeys).toHaveLength(0);
  });

  it("should detect changed keys (same key, different value)", () => {
    const v1 = new Map([["changed.pref", true]]);
    const v2 = new Map([["changed.pref", false]]);

    const result = comparePrefs(v1, v2);

    expect(result.changedKeys).toStrictEqual([
      { key: "changed.pref", value: true, newValue: false },
    ]);
    expect(result.addedKeys).toHaveLength(0);
    expect(result.removedKeys).toHaveLength(0);
  });

  it("should detect all three categories in a mixed scenario", () => {
    const v1 = new Map<string, Pref>([
      ["removed.pref", 1],
      ["changed.pref", "old"],
      ["same.pref", true],
    ]);
    const v2 = new Map<string, Pref>([
      ["added.pref", 99],
      ["changed.pref", "new"],
      ["same.pref", true],
    ]);

    const result = comparePrefs(v1, v2);

    expect(result.addedKeys).toStrictEqual([{ key: "added.pref", value: 99 }]);
    expect(result.removedKeys).toStrictEqual([{ key: "removed.pref", value: 1 }]);
    expect(result.changedKeys).toStrictEqual([
      { key: "changed.pref", value: "old", newValue: "new" },
    ]);
  });

  it("should sort added keys alphabetically", () => {
    const v1 = new Map<string, Pref>();
    const v2 = new Map<string, Pref>([
      ["zebra.pref", 1],
      ["alpha.pref", 2],
      ["middle.pref", 3],
    ]);

    const result = comparePrefs(v1, v2);

    expect(result.addedKeys.map((k) => k.key)).toStrictEqual([
      "alpha.pref",
      "middle.pref",
      "zebra.pref",
    ]);
  });

  it("should sort removed keys alphabetically", () => {
    const v1 = new Map<string, Pref>([
      ["zebra.pref", 1],
      ["alpha.pref", 2],
      ["middle.pref", 3],
    ]);
    const v2 = new Map<string, Pref>();

    const result = comparePrefs(v1, v2);

    expect(result.removedKeys.map((k) => k.key)).toStrictEqual([
      "alpha.pref",
      "middle.pref",
      "zebra.pref",
    ]);
  });

  it("should sort changed keys alphabetically", () => {
    const v1 = new Map<string, Pref>([
      ["zebra.pref", 1],
      ["alpha.pref", 2],
      ["middle.pref", 3],
    ]);
    const v2 = new Map<string, Pref>([
      ["zebra.pref", 10],
      ["alpha.pref", 20],
      ["middle.pref", 30],
    ]);

    const result = comparePrefs(v1, v2);

    expect(result.changedKeys.map((k) => k.key)).toStrictEqual([
      "alpha.pref",
      "middle.pref",
      "zebra.pref",
    ]);
  });

  it("should handle value type changes (number to boolean)", () => {
    const v1 = new Map<string, Pref>([["pref", 0]]);
    const v2 = new Map<string, Pref>([["pref", false]]);

    const result = comparePrefs(v1, v2);

    expect(result.changedKeys).toStrictEqual([{ key: "pref", value: 0, newValue: false }]);
  });
});
