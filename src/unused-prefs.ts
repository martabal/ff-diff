import { getInstalledFirefoxPath, getPrefs } from "./firefox";
import { UnusedPrefCommand } from "./cli";
import { parseUserPrefs } from "./prefs";
import { readFileSync } from "fs";

export const unusedPrefs = async () => {
  const [, , , compareUserjs] = process.argv;
  if (compareUserjs === undefined) {
    new UnusedPrefCommand().usage();
  }

  const userJsContent = readFileSync(compareUserjs, "utf8");

  const { path: firefoxPath } = getInstalledFirefoxPath();
  const prefsFirefox = await getPrefs(firefoxPath);

  const userKeys = parseUserPrefs(userJsContent);
  userKeys.sort((a, b) => a.key.localeCompare(b.key));

  const missing: string[] = [];

  for (const pref of userKeys) {
    if (
      !prefsFirefox.has(pref.key) &&
      pref.versionRemoved === undefined &&
      !pref.custom &&
      !pref.hidden
    ) {
      missing.push(pref.key);
    }
  }
  if (missing.length === 0) {
    console.log(`No unused prefs in ${compareUserjs}`);
  } else {
    console.log(`Unused pref${missing.length === 1 ? "" : "s"}:`);
    for (const pref of missing) {
      console.log(`- ${pref}`);
    }
  }
};
