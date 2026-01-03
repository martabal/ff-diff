import { getFirefoxDefaultProfile, getPrefs } from "$lib/firefox";
import { gettingPrefsMessage, gettingVersionMessage } from "$lib/helpers";
import { parseUserPrefs } from "$lib/prefs";
import { readFileSync } from "node:fs";
import { UserJSBasedCommands } from "$commands";
import { getPrefsFromInstalledVersion, installDir } from "$lib/install";
import { join } from "node:path";
import { styleText } from "node:util";

export const unusedPrefs = async (opts: UserJSBasedCommands) => {
  const userJsContent = readFileSync(opts.compareUserjs, "utf8");

  const profilePath = opts.forceDefaultProfile
    ? (await getFirefoxDefaultProfile()).profilePath
    : opts.profilePath;
  console.log(gettingPrefsMessage);

  const prefsFirefox = await (opts.firefoxVersion
    ? getPrefsFromInstalledVersion(
        opts.firefoxVersion,
        join(installDir, opts.firefoxVersion, "firefox"),
      )
    : getPrefs({ profilePath }));
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
    console.log(styleText("green", `No unused prefs in ${opts.compareUserjs}`));
  } else {
    console.log(styleText("yellow", `Unused pref${missing.length === 1 ? "" : "s"}:`));
    for (const pref of missing) {
      console.log(`- ${pref}`);
    }
  }
};
