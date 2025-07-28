import { describe, expect, it } from "vitest";
import { parseUserPrefs } from "@lib/prefs";

describe("parseuserprefs", () => {
  it("should parse a simple boolean preference", () => {
    const input = `user_pref("security.OCSP.require", true);`;
    const result = parseUserPrefs(input);

    expect(result).toStrictEqual([
      {
        key: "security.OCSP.require",
        value: true,
        versionAdded: undefined,
        versionRemoved: undefined,
        custom: false,
        hidden: false,
      },
    ]);
  });

  it("should parse a numeric preference", () => {
    const input = `user_pref("security.OCSP.enabled", 1);`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "security.OCSP.enabled",
      value: 1,
    });
  });

  it("should parse a string preference", () => {
    const input = `user_pref("app.normandy.api_url", "");`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "app.normandy.api_url",
      value: "",
    });
  });

  it("should handle single quotes", () => {
    const input = `user_pref('breakpad.reportURL', '');`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "breakpad.reportURL",
      value: "",
    });
  });

  it("should detect custom and hidden flags", () => {
    const input = `user_pref("test.pref", true); // [CUSTOM PREF] [HIDDEN PREF]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      value: true,
      custom: true,
      hidden: true,
    });
  });

  it("should extract versionadded and versionremoved", () => {
    const input = `user_pref("test.pref", false); // [FF91+] [FF100-]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      versionAdded: 91,
      versionRemoved: 100,
    });
  });

  it("should extract value stored as int", () => {
    const input = `user_pref("test.pref", 123);`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      value: 123,
    });
  });

  it("should extract value stored as float", () => {
    const input = `user_pref("test.pref", 123.0);`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      value: 123.0,
    });
  });

  it("should handle multiple prefs in one string", () => {
    const input = `
      user_pref("first.pref", true);
      user_pref("second.pref", 123);
    `;
    const result = parseUserPrefs(input);

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe("first.pref");
    expect(result[1].key).toBe("second.pref");
  });

  it("should return an empty array if no matches", () => {
    const input = `console.log("no prefs here");`;
    const result = parseUserPrefs(input);

    expect(result).toStrictEqual([]);
  });

  it("should detect a default boolean set to true with version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: true FF138+]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        version: 138,
        value: true,
      },
    });
  });

  it("should detect a default boolean set to false with version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: false FF138+]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        version: 138,
        value: false,
      },
    });
  });

  it("should detect a default string inside double quotes with version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: "hello world" FF138+]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        version: 138,
        value: "hello world",
      },
    });
  });

  it("should detect a default string inside single quotes with version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: 'hello world' FF138+]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        version: 138,
        value: "hello world",
      },
    });
  });

  it("should detect a default number with version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: 123 FF138+]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        version: 138,
        value: 123,
      },
    });
  });

  it("should detect a default boolean set to true without version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: true]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        value: true,
      },
    });
  });

  it("should detect a default boolean set to false without version", () => {
    const input = `user_pref("test.pref", 123.0); // [DEFAULT: false]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      default: {
        value: false,
      },
    });
  });
});
