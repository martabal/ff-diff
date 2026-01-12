import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  exit,
  getPathType,
  isUnitDifferenceOne,
  startsWithNumberDotNumber,
  warnIncorrectOldVersion,
} from "$lib/helpers";
import { ENOENT } from "node:constants";
import type { Stats } from "fs";
import { stat } from "fs/promises";

describe("startsWithNumberDotNumber", () => {
  it('should return true for "1.0"', () => {
    expect(startsWithNumberDotNumber("1.0")).toBe(true);
  });

  it('should return true for "10.5.3"', () => {
    expect(startsWithNumberDotNumber("10.5.3")).toBe(true);
  });

  it("should return false if there is no dot", () => {
    expect(startsWithNumberDotNumber("123")).toBe(false);
  });

  it("should return false if the first part is not numeric", () => {
    expect(startsWithNumberDotNumber("a.2")).toBe(false);
    expect(startsWithNumberDotNumber(".2")).toBe(false);
    expect(startsWithNumberDotNumber("1a.2")).toBe(false);
  });

  it("should return false if the second part does not start with a digit", () => {
    expect(startsWithNumberDotNumber("1.a")).toBe(false);
    expect(startsWithNumberDotNumber("2..")).toBe(false);
  });

  it("should return false if the first part contains non-digit characters", () => {
    expect(startsWithNumberDotNumber("1x.2")).toBe(false);
    expect(startsWithNumberDotNumber("x1.2")).toBe(false);
  });

  it('should return true for edge cases like "0.1"', () => {
    expect(startsWithNumberDotNumber("0.1")).toBe(true);
  });

  it("should return false for empty string", () => {
    expect(startsWithNumberDotNumber("")).toBe(false);
  });

  it('should return false for ".1"', () => {
    expect(startsWithNumberDotNumber(".1")).toBe(false);
  });

  it('should return false for "1..2" (double dot)', () => {
    expect(startsWithNumberDotNumber("1..2")).toBe(false);
  });
});

describe("isUnitDifferenceOne", () => {
  it("should return true when difference of units is 1", () => {
    expect(isUnitDifferenceOne("139.3", "140.0")).toBe(true);
    expect(isUnitDifferenceOne("140.0", "139.9")).toBe(true);
  });

  it("should return false when difference of units is 0", () => {
    expect(isUnitDifferenceOne("139.3", "139.8")).toBe(false);
  });

  it("should return false when difference of units is more than 1", () => {
    expect(isUnitDifferenceOne("139.3", "141.0")).toBe(false);
  });

  it("should handle integer values correctly", () => {
    expect(isUnitDifferenceOne("100", "101")).toBe(true);
    expect(isUnitDifferenceOne("101", "100")).toBe(true);
  });

  it("should handle negative numbers correctly", () => {
    expect(isUnitDifferenceOne("-2.5", "-1.2")).toBe(true);
    expect(isUnitDifferenceOne("-3.0", "-1.0")).toBe(false);
  });

  it("should handle decimal variations correctly", () => {
    expect(isUnitDifferenceOne("1.9", "2.1")).toBe(true);
    expect(isUnitDifferenceOne("2.1", "1.9")).toBe(true);
    expect(isUnitDifferenceOne("5.99", "6.01")).toBe(true);
    expect(isUnitDifferenceOne("10.1", "10.9")).toBe(false);
  });

  it("should handle more negative number combinations", () => {
    expect(isUnitDifferenceOne("-5.5", "-4.5")).toBe(true);
    expect(isUnitDifferenceOne("-4.5", "-5.5")).toBe(true);
    expect(isUnitDifferenceOne("-10.1", "-8.9")).toBe(false);
  });

  it("should handle combinations of positive and negative units", () => {
    expect(isUnitDifferenceOne("-1.5", "0.5")).toBe(false);
    expect(isUnitDifferenceOne("0.5", "-1.5")).toBe(false);
    expect(isUnitDifferenceOne("-1.5", "-0.5")).toBe(true);
    expect(isUnitDifferenceOne("-0.5", "0.5")).toBe(true);
    expect(isUnitDifferenceOne("-2.0", "1.0")).toBe(false);
    expect(isUnitDifferenceOne("-1.0", "0.0")).toBe(true);
  });
});

describe("warnIncorrectOldVersion", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });

  it("warns when oldVersion is greater than newVersion", () => {
    warnIncorrectOldVersion("2.0.0", "1.9.9");

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      "Warning: The previous version `2.0.0` is greater than the new version `1.9.9`",
    );
  });

  it("does not warn when oldVersion is less than newVersion", () => {
    warnIncorrectOldVersion("1.2.3", "1.3.0");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn when versions are equal", () => {
    warnIncorrectOldVersion("1.2.3", "1.2.3");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles different version lengths correctly", () => {
    warnIncorrectOldVersion("1.2.1", "1.2");

    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("treats missing version segments as zero", () => {
    warnIncorrectOldVersion("1.2", "1.2.0");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles single-number versions", () => {
    warnIncorrectOldVersion("2", "10");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles non-numeric parts gracefully", () => {
    warnIncorrectOldVersion("1.a.0", "1.0.0");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles old version has superior beta version but inferior minor version", () => {
    warnIncorrectOldVersion("1.1b2", "1.2b1");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles old version has superior beta version but inferior minor version", () => {
    warnIncorrectOldVersion("135.0b2", "136.0b1");

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles old version has superior beta version", () => {
    warnIncorrectOldVersion("135.0b2", "135.0b1");

    expect(warnSpy).toHaveBeenCalledOnce();
  });
});

vi.mock("fs/promises", () => ({
  stat: vi.fn(),
}));

describe("getPathType", () => {
  const mockStat = vi.mocked(stat);

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("returns 'file' for files", async () => {
    const stats = {
      isFile: () => true,
      isDirectory: () => false,
    } as Stats;

    mockStat.mockResolvedValue(stats);

    await expect(getPathType("file.txt")).resolves.toBe("file");
  });

  it("returns 'directory' for directories", async () => {
    const stats = {
      isFile: () => false,
      isDirectory: () => true,
    } as Stats;

    mockStat.mockResolvedValue(stats);

    await expect(getPathType("dir")).resolves.toBe("directory");
  });

  it("returns 'other' for non-file, non-directory", async () => {
    const stats = {
      isFile: () => false,
      isDirectory: () => false,
    } as Stats;

    mockStat.mockResolvedValue(stats);

    await expect(getPathType("socket")).resolves.toBe("other");
  });

  it("returns 'missing' when errno is ENOENT", async () => {
    const err: NodeJS.ErrnoException = new Error("not found");
    err.errno = ENOENT;

    mockStat.mockRejectedValue(err);

    await expect(getPathType("missing")).resolves.toBe("missing");
  });

  it("logs error and exits for unexpected errors", async () => {
    const err: NodeJS.ErrnoException = new Error("EACCES");
    err.errno = 13;

    mockStat.mockRejectedValue(err);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => null) as never);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => null);

    await getPathType("forbidden");

    expect(consoleSpy).toHaveBeenCalledWith(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

vi.mock("./style", () => ({
  styleText: vi.fn((color, msg) => `styled-${msg}`),
}));

describe("exit", () => {
  let consoleErrorMock: ReturnType<typeof vi.fn>;
  let processExitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleErrorMock = vi.fn();
    processExitMock = vi.fn();

    vi.stubGlobal("console", { ...console, error: consoleErrorMock });
    vi.stubGlobal("process", { ...process, exit: processExitMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls process.exit(1) without message", () => {
    exit();
    expect(processExitMock).toHaveBeenCalledWith(1);
    expect(consoleErrorMock).not.toHaveBeenCalled();
  });

  it("calls console.error and process.exit(1) with a message", () => {
    exit("fatal error");
    expect(consoleErrorMock).toHaveBeenCalledWith("fatal error");
    expect(processExitMock).toHaveBeenCalledWith(1);
  });
});
