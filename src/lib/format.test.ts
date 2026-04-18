import { describe, it, expect } from "vitest";
import { formatValue, Format, formatTicks } from "$lib/format";

describe("formatValue", () => {
  it("should return a single space when value is an empty string", () => {
    expect(formatValue("")).toBe(" ");
  });

  it("should return the value unchanged for a non-empty string", () => {
    expect(formatValue("hello")).toBe("hello");
  });

  it("should return the value unchanged for a number", () => {
    expect(formatValue(42)).toBe(42);
  });

  it("should return the value unchanged for zero", () => {
    expect(formatValue(0)).toBe(0);
  });

  it("should return the value unchanged for a boolean true", () => {
    expect(formatValue(true)).toBe(true);
  });

  it("should return the value unchanged for a boolean false", () => {
    expect(formatValue(false)).toBe(false);
  });

  it("should return the value unchanged for a string containing only spaces", () => {
    expect(formatValue("   ")).toBe("   ");
  });
});

describe("Format enum", () => {
  it("should have the correct Markdown value", () => {
    expect(Format.Markdown).toBe("md");
  });

  it("should have the correct Text value", () => {
    expect(Format.Text).toBe("txt");
  });
});

describe("formatTicks", () => {
  it("should have correct tick values for Markdown format", () => {
    const ticks = formatTicks[Format.Markdown];

    expect(ticks.tickStart).toBe("");
    expect(ticks.tickSymbol).toBe("-");
    expect(ticks.tickKeyValue).toBe("`");
    expect(ticks.tickTransform).toBe("&rarr;");
  });

  it("should have correct tick values for Text format", () => {
    const ticks = formatTicks[Format.Text];

    expect(ticks.tickStart).toBe(" ");
    expect(ticks.tickSymbol).toBeUndefined();
    expect(ticks.tickKeyValue).toBe("");
    expect(ticks.tickTransform).toBe("->");
  });
});
