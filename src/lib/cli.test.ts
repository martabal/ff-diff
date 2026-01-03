import { describe, it, expect, vi, beforeEach } from "vitest";
import { getArgumentValue, getArgumentValues } from "$lib/cli";
import * as helpers from "$lib/helpers";

const expectExitError = `process.exit unexpectedly called with "1"`;

// Mock the exit function from helpers
const mockExit = vi.spyOn(helpers, "exit").mockImplementation(() => {
  throw new Error(expectExitError);
});

describe("getArgumentValue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return the value when argument exists with valid value", () => {
    process.argv = ["node", "script.js", "--config", "config.json"];

    const result = getArgumentValue("--config");

    expect(result).toBe("config.json");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should return undefined when argument does not exist", () => {
    process.argv = ["node", "script.js", "--other", "value"];

    const result = getArgumentValue("--config");

    expect(result).toBe(undefined);
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should call exit when argument is at the end of argv", () => {
    process.argv = ["node", "script.js", "--config"];

    expect(() => getArgumentValue("--config")).toThrow(expectExitError);
    expect(mockExit).toHaveBeenCalledWith(
      'Error: Argument "--config" is provided but has no value.',
    );
  });

  it("should call exit when argument value starts with --", () => {
    process.argv = ["node", "script.js", "--config", "--another-flag"];

    expect(() => getArgumentValue("--config")).toThrow(expectExitError);
    expect(mockExit).toHaveBeenCalledWith(
      'Error: Argument "--config" is provided but has no value.',
    );
  });

  it("should return the correct value when multiple arguments exist", () => {
    process.argv = ["node", "script.js", "--env", "dev", "--config", "config.json", "--verbose"];

    const result = getArgumentValue("--config");

    expect(result).toBe("config.json");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should return the first occurrence when argument appears multiple times", () => {
    process.argv = ["node", "script.js", "--config", "first.json", "--config", "second.json"];

    const result = getArgumentValue("--config");

    expect(result).toBe("first.json");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should handle arguments with special characters", () => {
    process.argv = ["node", "script.js", "--path", "/path/to/file.json"];

    const result = getArgumentValue("--path");

    expect(result).toBe("/path/to/file.json");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should handle empty string values", () => {
    process.argv = ["node", "script.js", "--config", ""];

    const result = getArgumentValue("--config");

    expect(result).toBe("");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should handle arguments with equals-like values", () => {
    process.argv = ["node", "script.js", "--url", "http://example.com?param=value"];

    const result = getArgumentValue("--url");

    expect(result).toBe("http://example.com?param=value");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should handle single character flags", () => {
    process.argv = ["node", "script.js", "-v", "1.0.0"];

    const result = getArgumentValue("-v");

    expect(result).toBe("1.0.0");
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("should call exit when single character flag has no value", () => {
    process.argv = ["node", "script.js", "", "-v"];

    expect(() => getArgumentValue("-v")).toThrow(expectExitError);
    expect(mockExit).toHaveBeenCalledWith('Error: Argument "-v" is provided but has no value.');
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
    process.argv = ["node", "script.js", "--files", "file1.js,file2.js,file3.js"];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should handle comma-separated values with spaces", () => {
    process.argv = ["node", "script.js", "--files", "file1.js, file2.js , file3.js"];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should filter out empty values from comma-separated list", () => {
    process.argv = ["node", "script.js", "--files", "file1.js,,file2.js, ,file3.js"];

    const result = getArgumentValues("--files");

    expect(result).toEqual(["file1.js", "file2.js", "file3.js"]);
  });

  it("should handle multiple occurrences of the same argument", () => {
    process.argv = ["node", "script.js", "--files", "file1.js,file2.js", "--files", "file3.js"];

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

    expect(result).toEqual(["src/file1.js", "src/file2.js", "test/file3.js", "test/file4.js"]);
  });

  it("should handle single comma-separated value", () => {
    process.argv = ["node", "script.js", "--tags", "urgent"];

    const result = getArgumentValues("--tags");

    expect(result).toEqual(["urgent"]);
  });

  it("should call exit for mixed valid and invalid occurrences", () => {
    process.argv = ["node", "script.js", "--files", "file1.js", "--files"];
    expect(() => getArgumentValues("--files")).toThrow(expectExitError);
    expect(mockExit).toHaveBeenCalledWith(
      'Error: Argument "--files" is provided but has no value.',
    );
  });
});
