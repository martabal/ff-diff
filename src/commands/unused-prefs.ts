import { getFirefoxDefaultProfile, getPrefs } from "@lib/firefox";
import { gettingPrefsMessage, gettingVersionMessage } from "@lib/helpers";
import { parseUserPrefs } from "@lib/prefs";
import { readFileSync } from "fs";
import { UserJSBasedCommands } from "@commands";

export const unusedPrefs = async (opts: UserJSBasedCommands) => {
  const userJsContent = readFileSync(opts.compareUserjs, "utf8");

  const profilePath = opts.forceDefaultProfile
    ? getFirefoxDefaultProfile().profilePath
    : opts.profilePath;
  console.log(gettingPrefsMessage);
  const prefsFirefox = await getPrefs({ profilePath });
  console.log(gettingVersionMessage);
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
    console.log(`No unused prefs in ${opts.compareUserjs}`);
  } else {
    console.log(`Unused pref${missing.length === 1 ? "" : "s"}:`);
    for (const pref of missing) {
      console.log(`- ${pref}`);
    }
  }
};
