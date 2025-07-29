import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { exit } from "node:process";
import { Browser, Builder, type WebDriver } from "selenium-webdriver";
import { Options } from "selenium-webdriver/firefox.js";
import { CLI_ARGS } from "@cli";
import { getArgumentValue } from "@lib/cli";

export interface FirefoxPref {
  key: string;
  value: Pref;
}

export interface InstallFirefox {
  hash?: string;
  path: string;
}

export interface FirefoxChangedPref extends FirefoxPref {
  newValue: Pref;
}

export type Pref = string | number | boolean;

export interface PrefsDiff {
  addedKeys: FirefoxPref[];
  removedKeys: FirefoxPref[];
  changedKeys: FirefoxChangedPref[];
}

interface FirefoxGlobal {
  Services: {
    prefs: {
      getDefaultBranch: (prefix: string) => {
        getChildList: (prefix: string) => string[];
        getPrefType: (name: string) => number;
        getBoolPref: (name: string) => boolean;
        getIntPref: (name: string) => number;
        getStringPref: (name: string) => string;
        prefHasDefaultValue: (name: string) => boolean;
        PREF_BOOL: number;
        PREF_INT: number;
        PREF_STRING: number;
        PREF_INVALID: number;
      };
    };
  };
}

const installedMozilla = ".mozilla/firefox";

const createDriver = async (executablePath: string): Promise<WebDriver> => {
  const options = new Options()
    .addArguments("-headless")
    .setBinary(executablePath);

  return await new Builder()
    .forBrowser(Browser.FIREFOX)
    .setFirefoxOptions(options)
    .build();
};

export const getPrefs = async (
  executablePath: string,
): Promise<Map<string, Pref>> => {
  const driver: WebDriver = await createDriver(executablePath);

  await driver.get("about:config");

  const prefsArray = await driver.executeScript<FirefoxPref[]>(() => {
    const services = (globalThis as unknown as FirefoxGlobal).Services;
    const defaultBranch = services.prefs.getDefaultBranch("");
    const prefs: FirefoxPref[] = [];
    for (const key of defaultBranch.getChildList("")) {
      let value: Pref;
      if (defaultBranch.prefHasDefaultValue(key)) {
        switch (defaultBranch.getPrefType(key)) {
          case defaultBranch.PREF_BOOL:
            value = defaultBranch.getBoolPref(key);
            break;
          case defaultBranch.PREF_INT:
            value = defaultBranch.getIntPref(key);
            break;
          case defaultBranch.PREF_STRING:
            value = defaultBranch.getStringPref(key);
            break;
          default:
            continue;
        }
        prefs.push({
          key,
          value,
        });
      }
    }
    return prefs;
  });
  if (prefsArray.length === 0) {
    console.error("no preferences detected");
    exit(1);
  }
  const prefs = new Map<string, Pref>(
    prefsArray.map(({ key, value }) => [key, value]),
  );

  await driver.quit();

  return prefs;
};

export const comparePrefs = (
  prefsV1: Map<string, Pref>,
  prefsV2: Map<string, Pref>,
): PrefsDiff => {
  const addedKeys: FirefoxPref[] = [];
  const removedKeys: FirefoxPref[] = [];
  const changedKeys: FirefoxChangedPref[] = [];

  for (const [key, value] of prefsV1.entries()) {
    if (!prefsV2.has(key)) {
      removedKeys.push({ key, value });
    } else if (value !== prefsV2.get(key)) {
      changedKeys.push({
        key,
        value,
        newValue: prefsV2.get(key)!,
      });
    }
  }

  for (const [key, value] of prefsV2.entries()) {
    if (!prefsV1.has(key)) {
      addedKeys.push({ key, value });
    }
  }

  addedKeys.sort((a, b) => a.key.localeCompare(b.key));
  changedKeys.sort((a, b) => a.key.localeCompare(b.key));
  removedKeys.sort((a, b) => a.key.localeCompare(b.key));

  return { addedKeys, removedKeys, changedKeys };
};

export const getFirefoxVersion = async (
  executablePath: string,
): Promise<string> => {
  const driver: WebDriver = await createDriver(executablePath);

  const capabilities = await driver.getCapabilities();
  const browserVersion =
    capabilities.get("browserVersion") || capabilities.get("version");
  await driver.quit();
  return browserVersion;
};

export const getFirefoxReleaseProfilePath = (): InstallFirefox | null => {
  const getPath = (): InstallFirefox | null => {
    return {
      path: `${mozillaPath}/${currentSection["Path"]}`,
      hash: currentSection["Path"].split(".")[0],
    };
  };

  const mozillaPath = join(homedir(), `${installedMozilla}`);
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
        return getPath();
      }
      currentSection = {};
    } else if (line.includes("=")) {
      const [key, value] = line.split("=", 2);
      currentSection[key.trim()] = value.trim();
    }
  }

  if (currentSection["Name"]?.includes("release") && currentSection["Path"]) {
    return getPath();
  }

  return null;
};

export const getInstalledFirefoxPath = (): InstallFirefox => {
  let firefoxPath = getArgumentValue(CLI_ARGS.FIREFOX_PATH);
  if (firefoxPath === undefined) {
    const firefoxPath = getFirefoxReleaseProfilePath();

    if (firefoxPath === null || !existsSync(firefoxPath.path)) {
      console.error("Can't find installed firefox version");
      process.exit(1);
    }
    return firefoxPath;
  }
  return { path: firefoxPath };
};
