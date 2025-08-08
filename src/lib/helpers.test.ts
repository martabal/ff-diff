import { describe, it, expect } from "vitest";
import { isUnitDifferenceOne, startsWithNumberDotNumber } from "@lib/helpers";

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
});
