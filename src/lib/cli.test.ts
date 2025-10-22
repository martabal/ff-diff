import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArgumentValue, getArgumentValues } from "$lib/cli";

const expectExitError = "process.exit";
const mockProcessExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error(expectExitError);
});

const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

describe("getArgumentValue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return the value when argument exists with valid value", () => {
    process.argv = ["node", "script.js", "--config", "config.json"];

    const result = getArgumentValue("--config");

    expect(result).toBe("config.json");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should return null when argument does not exist", () => {
    process.argv = ["node", "script.js", "--other", "value"];

    const result = getArgumentValue("--config");

    expect(result).toBe(undefined);
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should throw error when argument is at the end of argv", () => {
    process.argv = ["node", "script.js", "--config"];

    expect(() => getArgumentValue("--config")).toThrow(expectExitError);
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: Argument "--config" is provided but has no value.',
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should throw error when argument value starts with --", () => {
    process.argv = ["node", "script.js", "--config", "--another-flag"];

    expect(() => getArgumentValue("--config")).toThrow(expectExitError);
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: Argument "--config" is provided but has no value.',
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it("should return the correct value when multiple arguments exist", () => {
    process.argv = [
      "node",
      "script.js",
      "--env",
      "dev",
      "--config",
      "config.json",
      "--verbose",
    ];

    const result = getArgumentValue("--config");

    expect(result).toBe("config.json");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should return the first occurrence when argument appears multiple times", () => {
    process.argv = [
      "node",
      "script.js",
      "--config",
      "first.json",
      "--config",
      "second.json",
    ];

    const result = getArgumentValue("--config");

    expect(result).toBe("first.json");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should handle arguments with special characters", () => {
    process.argv = ["node", "script.js", "--path", "/path/to/file.json"];

    const result = getArgumentValue("--path");

    expect(result).toBe("/path/to/file.json");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should handle empty string values", () => {
    process.argv = ["node", "script.js", "--config", ""];

    const result = getArgumentValue("--config");

    expect(result).toBe("");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should handle arguments with equals-like values", () => {
    process.argv = [
      "node",
      "script.js",
      "--url",
      "http://example.com?param=value",
    ];

    const result = getArgumentValue("--url");

    expect(result).toBe("http://example.com?param=value");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should handle single character flags", () => {
    process.argv = ["node", "script.js", "-v", "1.0.0"];

    const result = getArgumentValue("-v");

    expect(result).toBe("1.0.0");
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it("should throw error when single character flag has no value", () => {
    process.argv = ["node", "script.js", "", "-v"];

    expect(() => getArgumentValue("-v")).toThrow(expectExitError);
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error: Argument "-v" is provided but has no value.',
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });
});

describe("getArgumentValues", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return empty array when argument does not exist", () => {
    process.argv = ["node", "script.js", "--other", "value"];

    const result = getArgumentValues("--config");

    expect(result).toEqual([]);
  });

  it("should return single value when argument exists once", () => {
    process.argv = ["node", "script.js", "--files", "file1.js"];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js"]);
  });

  it("should parse comma-separated values correctly", () => {
    process.argv = [
      "node",
      "script.js",
      "--files",
      "file1.js,file2.js,file3.js",
    ];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should handle comma-separated values with spaces", () => {
    process.argv = [
      "node",
      "script.js",
      "--files",
      "file1.js, file2.js , file3.js",
    ];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should filter out empty values from comma-separated list", () => {
    process.argv = [
      "node",
      "script.js",
      "--files",
      "file1.js,,file2.js, ,file3.js",
    ];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should handle multiple occurrences of the same argument", () => {
    process.argv = [
      "node",
      "script.js",
      "--files",
      "file1.js,file2.js",
      "--files",
      "file3.js",
    ];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should handle complex scenario with multiple arguments and comma-separated values", () => {
    process.argv = [
      "node",
      "script.js",
      "--files",
      "src/file1.js,src/file2.js",
      "--env",
      "development",
      "--files",
      "test/file3.js,test/file4.js",
    ];

    const result = getArgumentValues("--files");

    expect(result).toEqual([
      "src/file1.js",
      "src/file2.js",
      "test/file3.js",
      "test/file4.js",
    ]);
  });

  it("should handle single comma-separated value", () => {
    process.argv = ["node", "script.js", "--tags", "urgent"];

    const result = getArgumentValues("--tags");

    expect(result).toEqual(["urgent"]);
  });

  it("should handle mixed valid and invalid occurrences", () => {
    process.argv = ["node", "script.js", "--files", "file1.js", "--files"];
    expect(() => getArgumentValues("--files")).toThrow(expectExitError);
  });
});
