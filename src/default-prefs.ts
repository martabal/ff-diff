import path from "path";
import {
  getFirefoxVersion,
  getInstalledFirefoxPath,
  getPrefs,
  type Pref,
} from "./firefox";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { printOptions } from "./cli";
import { defaultsDir } from "./helpers";

const formatPrefs = (
  entries: [string, Pref][],
  template: (k: string, v: Pref) => string,
) => entries.map(([key, value]) => template(key, value)).join("\n");

const handleOutput = (
  sortedEntries: [string, Pref][],
  version: string,
  hash?: string,
) => {
  if (printOptions.saveOutput) {
    if (!existsSync(defaultsDir)) mkdirSync(defaultsDir, { recursive: true });
    const filename = (hash ? `${hash}-` : "") + `${version}-user.js`;
    const diffsPath = path.join(defaultsDir, filename);
    console.log(`Writing diffs to ${diffsPath}`);

    const fileContent = formatPrefs(
      sortedEntries,
      (k, v) => `user_pref("${k}",${JSON.stringify(v)})`,
    );
    writeFileSync(diffsPath, fileContent, "utf-8");
  }

  if (!printOptions.doNotPrintConsole) {
    const consoleContent = formatPrefs(
      sortedEntries,
      (k, v) => `- ${k}: ${JSON.stringify(v)}`,
    );
    console.log(consoleContent);
  }
};

export const getDefaultPrefs = async () => {
  const { path: firefoxPath } = getInstalledFirefoxPath();
  const prefsFirefox = await getPrefs(firefoxPath);
  const version = await getFirefoxVersion(firefoxPath);
  const sortedEntries = [...prefsFirefox.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  handleOutput(sortedEntries, version);
};
