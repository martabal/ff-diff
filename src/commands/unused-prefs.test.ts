import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { unusedPrefs } from "$commands/unused-prefs";
import * as firefox from "$lib/firefox";
import * as install from "$lib/install";
import { readFileSync } from "node:fs";

// Mock modules
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("$lib/firefox", () => ({
  getFirefoxDefaultProfile: vi.fn(),
  getPrefs: vi.fn(),
}));

vi.mock("$lib/install", () => ({
  getPrefsFromInstalledVersion: vi.fn(),
  installDir: "/mock/install/dir",
}));

describe("unusedPrefs", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should identify unused prefs correctly", async () => {
    const mockUserJsContent = `
      user_pref("browser.tabs.tabMinWidth", 100);
      user_pref("unused.pref.key", true);
      user_pref("another.used.pref", "value");
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>([
      ["browser.tabs.tabMinWidth", 100],
      ["another.used.pref", "value"],
    ]);

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("Unused pref:");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.key");
  });

  it("should handle no unused prefs", async () => {
    const mockUserJsContent = `
      user_pref("browser.tabs.tabMinWidth", 100);
      user_pref("another.used.pref", "value");
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>([
      ["browser.tabs.tabMinWidth", 100],
      ["another.used.pref", "value"],
    ]);

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("No unused prefs in /path/to/user.js");
  });

  it("should exclude custom prefs from unused list", async () => {
    const mockUserJsContent = `
      user_pref("custom.pref.key", true); // [CUSTOM PREF]
      user_pref("unused.pref.key", true);
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("Unused pref:");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.key");
    expect(consoleLogSpy).not.toHaveBeenCalledWith("- custom.pref.key");
  });

  it("should exclude hidden prefs from unused list", async () => {
    const mockUserJsContent = `
      user_pref("hidden.pref.key", true); // [HIDDEN PREF]
      user_pref("unused.pref.key", true);
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("Unused pref:");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.key");
    expect(consoleLogSpy).not.toHaveBeenCalledWith("- hidden.pref.key");
  });

  it("should exclude prefs with versionRemoved from unused list", async () => {
    const mockUserJsContent = `
      user_pref("removed.pref.key", true); // [FF100-]
      user_pref("unused.pref.key", true);
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("Unused pref:");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.key");
    expect(consoleLogSpy).not.toHaveBeenCalledWith("- removed.pref.key");
  });

  it("should handle corrupted user.js file with no valid prefs", async () => {
    const mockUserJsContent = `
      this is not a valid user.js file
      random text without prefs
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("No unused prefs in /path/to/user.js");
  });

  it("should handle empty user.js file", async () => {
    const mockUserJsContent = "";

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("No unused prefs in /path/to/user.js");
  });

  it("should use default profile when forceDefaultProfile is true", async () => {
    const mockUserJsContent = `user_pref("test.pref", true);`;
    const mockFirefoxPrefs = new Map<string, string | number | boolean>([["test.pref", true]]);
    const mockDefaultProfile = { profilePath: "/default/profile" };

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getFirefoxDefaultProfile).mockReturnValue(mockDefaultProfile);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: true,
    });

    expect(firefox.getFirefoxDefaultProfile).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("No unused prefs in /path/to/user.js");
  });

  it("should use firefox version when provided", async () => {
    const mockUserJsContent = `user_pref("test.pref", true);`;
    const mockFirefoxPrefs = new Map<string, string | number | boolean>([["test.pref", true]]);

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(install.getPrefsFromInstalledVersion).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      firefoxVersion: "140.0",
    });

    expect(install.getPrefsFromInstalledVersion).toHaveBeenCalledWith(
      "140.0",
      "/mock/install/dir/140.0/firefox",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("No unused prefs in /path/to/user.js");
  });

  it("should handle multiple unused prefs with correct plural form", async () => {
    const mockUserJsContent = `
      user_pref("unused.pref.one", true);
      user_pref("unused.pref.two", false);
      user_pref("unused.pref.three", "value");
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    expect(consoleLogSpy).toHaveBeenCalledWith("Unused prefs:");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.one");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.two");
    expect(consoleLogSpy).toHaveBeenCalledWith("- unused.pref.three");
  });

  it("should sort unused prefs alphabetically", async () => {
    const mockUserJsContent = `
      user_pref("zebra.pref", true);
      user_pref("alpha.pref", false);
      user_pref("middle.pref", "value");
    `;

    const mockFirefoxPrefs = new Map<string, string | number | boolean>();

    vi.mocked(readFileSync).mockReturnValue(mockUserJsContent);
    vi.mocked(firefox.getPrefs).mockResolvedValue(mockFirefoxPrefs);

    await unusedPrefs({
      compareUserjs: "/path/to/user.js",
      forceDefaultProfile: false,
      profilePath: "/mock/profile",
    });

    // Check that the prefs are output in alphabetical order
    expect(consoleLogSpy).toHaveBeenCalledWith("- alpha.pref");
    expect(consoleLogSpy).toHaveBeenCalledWith("- middle.pref");
    expect(consoleLogSpy).toHaveBeenCalledWith("- zebra.pref");
  });
});
