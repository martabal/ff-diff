import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printOptions } from "@cli";
import { getFirefoxVersion, getPrefs, type Pref } from "@lib/firefox";
import { defaultsDir } from "@lib/install";
import { gettingPrefsMessage, gettingVersionMessage } from "@lib/helpers";

const formatPrefs = (
  entries: [string, Pref][],
  template: (k: string, v: Pref) => string,
) => entries.map(([key, value]) => template(key, value)).join("\n");

const handleOutput = (
  sortedEntries: [string, Pref][],
  version: string,
  hash?: string,
) => {
  if (!printOptions.doNotPrintConsole) {
    const consoleContent = formatPrefs(
      sortedEntries,
      (k, v) => `- ${k}: ${JSON.stringify(v)}`,
    );
    console.log(consoleContent);
  }

  if (printOptions.saveOutput) {
    if (!existsSync(defaultsDir)) mkdirSync(defaultsDir, { recursive: true });
    const filename = (hash ? `${hash}-` : "") + `${version}-user.js`;
    const diffsPath = join(defaultsDir, filename);
    console.log(`Writing diffs to ${diffsPath}`);

    const fileContent = formatPrefs(
      sortedEntries,
      (k, v) => `user_pref("${k}", ${JSON.stringify(v)})`,
    );
    writeFileSync(diffsPath, fileContent, "utf-8");
  }
};

export const getDefaultPrefs = async (profilePath: string) => {
  console.log(gettingPrefsMessage);
  const prefsFirefox = await getPrefs({ profilePath });
  console.log(gettingVersionMessage);
  const version = await getFirefoxVersion({ profilePath });
  const sortedEntries = [...prefsFirefox.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  handleOutput(sortedEntries, version);
};
