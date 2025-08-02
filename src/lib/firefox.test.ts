import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import { getFirefoxReleaseProfilePath, installedMozilla } from "@lib/firefox";

vi.mock("fs");
vi.mock("os");
vi.mock("path");

vi.mock("./install", () => ({
  getPlatform: () => "linux",
  getArchitecture: () => "x86_64",
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

  it("should return null when profiles.ini does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
    expect(existsSync).toHaveBeenCalledWith(mockIniPath);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("should return the correct path when release profile exists", () => {
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

    const result = getFirefoxReleaseProfilePath();

    expect(result).toStrictEqual({
      profilePath: `${mockMozillaPath}/def456.default-release`,
      hash: "def456",
    });
    expect(existsSync).toHaveBeenCalledWith(mockIniPath);
    expect(readFileSync).toHaveBeenCalledWith(mockIniPath, "utf8");
  });

  it("should return null when no release profile exists", () => {
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

    const result = getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });

  it("should return null when release profile has no Path", () => {
    const mockIniContent = `[Profile0]
Name=release
IsRelative=1

[General]
StartWithLastProfile=1
Version=2
`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });

  it("should handle empty profiles.ini file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("");

    const result = getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });

  it("should handle ini content with extra whitespace", () => {
    const mockIniContent = `[Profile0]
Name = release  
IsRelative = 1
Path = abc123.release

[General]
StartWithLastProfile=1
Version=2`;

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(mockIniContent);

    const result = getFirefoxReleaseProfilePath();

    expect(result).toStrictEqual({
      profilePath: `${mockMozillaPath}/abc123.release`,
      hash: "abc123",
    });
  });

  it("should return the first matching release profile when multiple exist", () => {
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

    const result = getFirefoxReleaseProfilePath();

    expect(result).toStrictEqual({
      profilePath: `${mockMozillaPath}/first.release`,
      hash: "first",
    });
  });

  it("should handle case sensitivity in profile names", () => {
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

    const result = getFirefoxReleaseProfilePath();

    expect(result).toBeNull();
  });
});
