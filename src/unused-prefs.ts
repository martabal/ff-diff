import { getArgumentValue } from "./helpers";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { getPrefs } from "./firefox";
import { parseUserPrefs } from "./diff";
import { firefoxPathArg } from "./cli";

const installedMozilla = ".mozilla/firefox";

function getFirefoxReleaseProfilePath(): string | null {
  const mozillaPath = join(os.homedir(), `${installedMozilla}`);
  const iniPath = join(mozillaPath, "profiles.ini");

  if (!existsSync(iniPath)) {
    return null;
  }

  const iniContent = readFileSync(iniPath, "utf8");
  const lines = iniContent.split("\n");

  let currentSection: Record<string, string> = {};
  for (const line of lines) {
    if (line.startsWith("[") && line.endsWith("]")) {
      if (
        currentSection["Name"]?.includes("release") &&
        currentSection["Path"]
      ) {
        return `${mozillaPath}/${currentSection["Path"]}`;
      }
      currentSection = {};
    } else if (line.includes("=")) {
      const [key, value] = line.split("=", 2);
      currentSection[key.trim()] = value.trim();
    }
  }

  if (currentSection["Name"]?.includes("release") && currentSection["Path"]) {
    return `${mozillaPath}/${currentSection["Path"]}`;
  }

  return null;
}

const getInstalledFirefoxPath = (): string => {
  let firefoxPath = getArgumentValue(firefoxPathArg);
  if (firefoxPath === null) {
    const firefoxPath = getFirefoxReleaseProfilePath();

    if (firefoxPath === null || !existsSync(firefoxPath)) {
      console.error("Can't find installed firefox version");
      process.exit(1);
    }
    return firefoxPath;
  }
  return firefoxPath;
};

export const unusedPrefs = async () => {
  const compareUserjs = process.argv[3];

  const userJsContent = readFileSync(compareUserjs, "utf8");

  const firefoxPath = getInstalledFirefoxPath();
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
