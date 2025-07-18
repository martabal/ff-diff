import { describe, it, expect } from "vitest";

const startsWithNumberDotNumber = (str: string): boolean => {
  const parts = str.split(".");
  if (parts.length < 2) return false;

  const first = parts[0];
  const second = parts[1];

  if (!first || isNaN(Number(first)) || !/^\d+$/.test(first)) return false;
  if (!second || isNaN(Number(second[0]))) return false;

  return true;
};

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
});
