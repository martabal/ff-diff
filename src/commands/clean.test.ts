import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type Dirent } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { clean } from "$commands/clean";

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn<() => Promise<Dirent[]>>(),
  rm: vi.fn<() => Promise<void>>(),
}));

vi.mock("$lib/install", () => ({
  installDir: "/mock/install/dir",
}));

vi.mock("$lib/helpers", () => ({
  exit: vi.fn<() => never>(),
}));

const { mockKeepOptions } = vi.hoisted(() => ({
  mockKeepOptions: { archives: false, sources: false },
}));

vi.mock("$cli", () => ({
  keepOptions: mockKeepOptions,
}));

const makeEntry = (name: string, isDir: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
  }) as unknown as Dirent;

describe("clean", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKeepOptions.archives = false;
    mockKeepOptions.sources = false;
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should log 'No archives/sources has been removed' when directory is empty", async () => {
    vi.mocked(readdir).mockResolvedValue([]);

    await clean([]);

    expect(consoleLogSpy).toHaveBeenCalledWith("No archives/sources has been removed");
    expect(rm).not.toHaveBeenCalled();
  });

  it("should remove a version directory not in the keep list", async () => {
    vi.mocked(readdir).mockResolvedValue([makeEntry("139", true)]);

    await clean([]);

    expect(rm).toHaveBeenCalledWith("/mock/install/dir/139", { recursive: true, force: true });
    expect(consoleLogSpy).toHaveBeenCalledWith("Removing folder: 139");
    expect(consoleLogSpy).toHaveBeenCalledWith("Cleanup complete.");
  });

  it("should not remove a version directory that is in the keep list", async () => {
    vi.mocked(readdir).mockResolvedValue([makeEntry("139", true)]);

    await clean([139]);

    expect(rm).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("No archives/sources has been removed");
  });

  it("should not remove a version directory when keepOptions.sources is true", async () => {
    mockKeepOptions.sources = true;
    vi.mocked(readdir).mockResolvedValue([makeEntry("139", true)]);

    await clean([]);

    expect(rm).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("No archives/sources has been removed");
  });

  it("should remove a firefox archive not in the keep list", async () => {
    vi.mocked(readdir).mockResolvedValue([makeEntry("firefox-139.tar.xz", false)]);

    await clean([]);

    expect(rm).toHaveBeenCalledWith("/mock/install/dir/firefox-139.tar.xz", {
      recursive: true,
      force: true,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith("Remove archive: firefox-139.tar.xz");
    expect(consoleLogSpy).toHaveBeenCalledWith("Cleanup complete.");
  });

  it("should not remove a firefox archive whose version is in the keep list", async () => {
    vi.mocked(readdir).mockResolvedValue([makeEntry("firefox-139.tar.xz", false)]);

    await clean([139]);

    expect(rm).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("No archives/sources has been removed");
  });

  it("should not remove a firefox archive when keepOptions.archives is true", async () => {
    mockKeepOptions.archives = true;
    vi.mocked(readdir).mockResolvedValue([makeEntry("firefox-139.tar.xz", false)]);

    await clean([]);

    expect(rm).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("No archives/sources has been removed");
  });

  it("should not remove files that do not start with 'firefox-'", async () => {
    vi.mocked(readdir).mockResolvedValue([makeEntry("other-file.txt", false)]);

    await clean([]);

    expect(rm).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith("No archives/sources has been removed");
  });

  it("should handle a mix of kept and removed entries", async () => {
    vi.mocked(readdir).mockResolvedValue([
      makeEntry("139", true),
      makeEntry("140", true),
      makeEntry("firefox-138.tar.xz", false),
    ]);

    await clean([140]);

    expect(rm).toHaveBeenCalledWith("/mock/install/dir/139", { recursive: true, force: true });
    expect(rm).toHaveBeenCalledWith("/mock/install/dir/firefox-138.tar.xz", {
      recursive: true,
      force: true,
    });
    expect(rm).not.toHaveBeenCalledWith(
      "/mock/install/dir/140",
      expect.objectContaining({ recursive: true }),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith("Cleanup complete.");
  });

  it("should call exit when readdir throws", async () => {
    const { exit } = await import("$lib/helpers");
    const readError = new Error("ENOENT");
    vi.mocked(readdir).mockRejectedValue(readError);

    await clean([]);

    expect(exit).toHaveBeenCalledWith(`Error reading dist/ directory: ${String(readError)}`);
  });
});
