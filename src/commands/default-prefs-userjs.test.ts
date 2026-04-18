import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { defaultPrefsUserJS } from "$commands/default-prefs-userjs";
import { type Pref } from "$lib/firefox";

vi.mock("node:fs", () => ({
  existsSync: vi.fn<() => boolean>(),
  mkdirSync: vi.fn<() => void>(),
  readFileSync: vi.fn<() => string>(),
  writeFileSync: vi.fn<() => void>(),
}));

vi.mock("$lib/firefox", () => ({
  getFirefoxDefaultProfile: vi.fn<() => Promise<{ profilePath: string }>>(),
  getPrefs: vi.fn<() => Promise<Map<string, Pref>>>(),
  getFirefoxVersion: vi.fn<() => Promise<string>>(),
}));

vi.mock("$lib/install", () => ({
  getPrefsFromInstalledVersion: vi.fn<() => Promise<Map<string, Pref>>>(),
  installDir: "/mock/install/dir",
  defaultsUserJSDir: "/mock/defaults-userjs",
}));

vi.mock("$lib/helpers", () => ({
  exit: vi.fn<() => never>(),
  getPathType: vi.fn<() => Promise<"file" | "directory" | "other" | "missing">>(),
  gettingPrefsMessage: "Getting prefs...",
  gettingVersionMessage: "Getting firefox version...",
}));

const { mockPrintOptions } = vi.hoisted(() => ({
  mockPrintOptions: { doNotPrintConsole: false, saveOutput: false },
}));

vi.mock("$cli", () => ({
  printOptions: mockPrintOptions,
}));

describe("defaultPrefsUserJS", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrintOptions.doNotPrintConsole = false;
    mockPrintOptions.saveOutput = false;

    const { getPrefs, getFirefoxVersion } = await import("$lib/firefox");
    vi.mocked(getPrefs).mockResolvedValue(new Map());
    vi.mocked(getFirefoxVersion).mockResolvedValue("140.0");

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should log 'No wrong default prefs' when all prefs match their defaults", async () => {
    const { getPrefs } = await import("$lib/firefox");
    vi.mocked(readFileSync).mockReturnValue(`user_pref("some.pref", true);`);
    vi.mocked(getPrefs).mockResolvedValue(new Map([["some.pref", true]]));

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).toContain("No wrong default prefs");
  });

  it("should log a wrong default when pref value in user.js differs from Firefox default", async () => {
    const { getPrefs, getFirefoxVersion } = await import("$lib/firefox");
    vi.mocked(readFileSync).mockReturnValue(
      `user_pref("some.pref", true); // [DEFAULT: true FF138+]`,
    );
    // Firefox uses false as the actual default, while user.js marks true as the new default from FF138+
    vi.mocked(getPrefs).mockResolvedValue(new Map([["some.pref", false]]));
    vi.mocked(getFirefoxVersion).mockResolvedValue("140.0");

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).toContain("Wrong default for:");
    expect(allLogs).toContain("some.pref");
  });

  it("should report prefs that already use the Firefox default value", async () => {
    const { getPrefs } = await import("$lib/firefox");
    // user.js sets the same value as the Firefox default (no [DEFAULT:] annotation)
    vi.mocked(readFileSync).mockReturnValue(`user_pref("some.pref", true);`);
    vi.mocked(getPrefs).mockResolvedValue(new Map([["some.pref", true]]));

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).toContain("Explicit default not set for:");
    expect(allLogs).toContain("some.pref");
  });

  it("should skip prefs that are not in the Firefox prefs map", async () => {
    const { getPrefs } = await import("$lib/firefox");
    vi.mocked(readFileSync).mockReturnValue(`user_pref("unknown.pref", true);`);
    vi.mocked(getPrefs).mockResolvedValue(new Map());

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    const allLogs = consoleLogSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allLogs).not.toContain("unknown.pref");
  });

  it("should use the default Firefox profile path when forceDefaultProfile is true", async () => {
    const { getFirefoxDefaultProfile, getPrefs } = await import("$lib/firefox");
    vi.mocked(readFileSync).mockReturnValue(`user_pref("some.pref", true);`);
    vi.mocked(getFirefoxDefaultProfile).mockResolvedValue({ profilePath: "/default/profile" });
    vi.mocked(getPrefs).mockResolvedValue(new Map([["some.pref", true]]));

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: true,
    });

    expect(getFirefoxDefaultProfile).toHaveBeenCalled();
  });

  it("should use getPrefsFromInstalledVersion when firefoxVersion is provided", async () => {
    const { getPrefsFromInstalledVersion } = await import("$lib/install");
    vi.mocked(readFileSync).mockReturnValue(`user_pref("some.pref", true);`);
    vi.mocked(getPrefsFromInstalledVersion).mockResolvedValue(new Map([["some.pref", true]]));

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      firefoxVersion: "140.0",
    });

    expect(getPrefsFromInstalledVersion).toHaveBeenCalledWith(
      "140.0",
      "/mock/install/dir/140.0/firefox/firefox",
    );
  });

  it("should not print to console when doNotPrintConsole is true", async () => {
    mockPrintOptions.doNotPrintConsole = true;

    const { getPrefs } = await import("$lib/firefox");
    vi.mocked(readFileSync).mockReturnValue(`user_pref("some.pref", true);`);
    vi.mocked(getPrefs).mockResolvedValue(new Map());

    await defaultPrefsUserJS({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    const outputCalls = consoleLogSpy.mock.calls.filter((c) =>
      ["No wrong default prefs", "Wrong default for:", "Explicit default not set for:"].some(
        (msg) => String(c[0]).includes(msg),
      ),
    );
    expect(outputCalls).toHaveLength(0);
  });
});
