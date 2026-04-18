import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { diff } from "$commands/diff";
import { type Pref } from "$lib/firefox";

vi.mock("node:fs", () => ({
  existsSync: vi.fn<() => boolean>(),
  mkdirSync: vi.fn<() => void>(),
  readFileSync: vi.fn<() => string>(),
  writeFileSync: vi.fn<() => void>(),
}));

vi.mock("node:fs/promises", () => ({
  rm: vi.fn<() => Promise<void>>(),
}));

vi.mock("$lib/install", () => ({
  installDir: "/mock/install/dir",
  diffsDir: "/mock/diffs",
  getPrefsFromInstalledVersion: vi.fn<() => Promise<Map<string, Pref>>>(),
}));

vi.mock("$lib/helpers", () => ({
  exit: vi.fn<() => never>(),
  getPathType: vi.fn<() => Promise<"file" | "directory" | "other" | "missing">>(),
  isUnitDifferenceOne: vi.fn<() => boolean>(),
}));

const { mockCleanOptions, mockPrintOptions } = vi.hoisted(() => ({
  mockCleanOptions: { archives: false, sources: false },
  mockPrintOptions: { doNotPrintConsole: false, saveOutput: false },
}));

vi.mock("$cli", () => ({
  cleanOptions: mockCleanOptions,
  printOptions: mockPrintOptions,
}));

describe("diff", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  const v1Prefs = new Map<string, Pref>([
    ["removed.pref", true],
    ["changed.pref", "old"],
    ["same.pref", 42],
  ]);

  const v2Prefs = new Map<string, Pref>([
    ["added.pref", false],
    ["changed.pref", "new"],
    ["same.pref", 42],
  ]);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCleanOptions.archives = false;
    mockCleanOptions.sources = false;
    mockPrintOptions.doNotPrintConsole = false;
    mockPrintOptions.saveOutput = false;

    const { getPrefsFromInstalledVersion } = await import("$lib/install");
    const { getPathType } = await import("$lib/helpers");

    vi.mocked(getPrefsFromInstalledVersion)
      .mockResolvedValueOnce(v1Prefs)
      .mockResolvedValueOnce(v2Prefs);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(getPathType).mockResolvedValue("directory");

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });

  it("should print install message and call getPrefsFromInstalledVersion for both versions", async () => {
    const { getPrefsFromInstalledVersion } = await import("$lib/install");

    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: false });

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Installing Firefox 139.0 and 140.0 in "/mock/install/dir"',
    );
    expect(getPrefsFromInstalledVersion).toHaveBeenCalledWith(
      "139.0",
      "/mock/install/dir/139.0/firefox/firefox",
    );
    expect(getPrefsFromInstalledVersion).toHaveBeenCalledWith(
      "140.0",
      "/mock/install/dir/140.0/firefox/firefox",
    );
  });

  it("should log added, removed, and changed prefs in console output", async () => {
    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: false });

    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).toContain("added.pref");
    expect(allLogs).toContain("removed.pref");
    expect(allLogs).toContain("changed.pref");
  });

  it("should create the install directory when it does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: false });

    expect(mkdirSync).toHaveBeenCalledWith("/mock/install/dir", { recursive: true });
  });

  it("should remove sources when cleanOptions.sources is true", async () => {
    mockCleanOptions.sources = true;

    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: false });

    expect(rm).toHaveBeenCalledWith(
      expect.stringContaining("139.0/firefox"),
      expect.objectContaining({ recursive: true }),
    );
    expect(rm).toHaveBeenCalledWith(
      expect.stringContaining("140.0/firefox"),
      expect.objectContaining({ recursive: true }),
    );
  });

  it("should filter out common changed values when hideCommonChangedValues is true", async () => {
    const { getPrefsFromInstalledVersion } = await import("$lib/install");

    const v1WithCommon = new Map<string, Pref>([
      ...v1Prefs,
      ["app.releaseNotesURL", "https://old.url"],
    ]);
    const v2WithCommon = new Map<string, Pref>([
      ...v2Prefs,
      ["app.releaseNotesURL", "https://new.url"],
    ]);

    vi.mocked(getPrefsFromInstalledVersion).mockReset();
    vi.mocked(getPrefsFromInstalledVersion)
      .mockResolvedValueOnce(v1WithCommon)
      .mockResolvedValueOnce(v2WithCommon);

    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: true });

    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).not.toContain("app.releaseNotesURL");
  });

  it("should save output to file when saveOutput is true", async () => {
    mockPrintOptions.saveOutput = true;
    vi.mocked(existsSync).mockReturnValue(true);

    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: false });

    expect(writeFileSync).toHaveBeenCalled();
  });

  it("should not print to console when doNotPrintConsole is true", async () => {
    mockPrintOptions.doNotPrintConsole = true;

    await diff({ oldVersion: "139.0", newVersion: "140.0", hideCommonChangedValues: false });

    // Only the install message (console.info) should appear; the prefs output (console.log) is suppressed
    const logCalls = consoleLogSpy.mock.calls;
    const prefOutputCalls = logCalls.filter((c) =>
      String(c[0]).includes("New keys") || String(c[0]).includes("Removed keys"),
    );
    expect(prefOutputCalls).toHaveLength(0);
  });

  it("should compare user.js when compareUserJS is provided", async () => {
    vi.mocked(readFileSync).mockReturnValue(`user_pref("changed.pref", "old");`);

    await diff({
      oldVersion: "139.0",
      newVersion: "140.0",
      hideCommonChangedValues: false,
      compareUserJS: "/path/to/user.js",
    });

    expect(readFileSync).toHaveBeenCalledWith("/path/to/user.js", "utf8");
    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).toContain("Comparing prefs with the ones from your user.js");
  });
});
