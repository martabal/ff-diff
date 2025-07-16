import { describe, it, expect } from "vitest";
import { parseUserPrefs } from "./diff";

describe("parseUserPrefs", () => {
  it("should parse a simple boolean preference", () => {
    const input = `user_pref("security.OCSP.require", true);`;
    const result = parseUserPrefs(input);

    expect(result).toEqual([
      {
        key: "security.OCSP.require",
        value: "true",
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
      value: "1",
    });
  });

  it("should parse a string preference", () => {
    const input = `user_pref("app.normandy.api_url", "");`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "app.normandy.api_url",
      value: `""`,
    });
  });

  it("should handle single quotes", () => {
    const input = `user_pref('breakpad.reportURL', '');`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "breakpad.reportURL",
      value: `''`,
    });
  });

  it("should detect custom and hidden flags", () => {
    const input = `user_pref("test.pref", true); // [CUSTOM PREF] [HIDDEN PREF]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      key: "test.pref",
      value: "true",
      custom: true,
      hidden: true,
    });
  });

  it("should extract versionAdded and versionRemoved", () => {
    const input = `user_pref("test.pref", false); // [FF91+] [FF100-]`;
    const result = parseUserPrefs(input);

    expect(result[0]).toMatchObject({
      versionAdded: "91",
      versionRemoved: "100",
    });
  });

  it("should handle multiple prefs in one string", () => {
    const input = `
      user_pref("first.pref", true);
      user_pref("second.pref", 123);
    `;
    const result = parseUserPrefs(input);

    expect(result.length).toBe(2);
    expect(result[0].key).toBe("first.pref");
    expect(result[1].key).toBe("second.pref");
  });

  it("should return an empty array if no matches", () => {
    const input = `console.log("no prefs here");`;
    const result = parseUserPrefs(input);

    expect(result).toEqual([]);
  });
});
