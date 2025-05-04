import { Builder, Browser, WebDriver } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

export type FirefoxPref = {
  name: string;
  value: ConfigType;
};

export type Key = {
  key: string;
  value: ConfigType;
};

export interface ChangedKey extends Key {
  newValue: ConfigType;
}

type ConfigType = string | number | boolean;

export type ConfigDiff = {
  addedKeys: Key[];
  removedKeys: Key[];
  changedKeys: ChangedKey[];
};

interface FirefoxGlobal extends Window {
  Services: {
    prefs: {
      getDefaultBranch: (prefix: string) => {
        getChildList: (prefix: string) => string[];
        getPrefType: (name: string) => number;
        getBoolPref: (name: string) => "boolean";
        getIntPref: (name: string) => "number";
        getStringPref: (name: string) => "string";
      };
      PREF_BOOL: number;
      PREF_INT: number;
      PREF_STRING: number;
      PREF_INVALID: number;
    };
  };
}

export const getPrefs = async (
  executablePath: string,
): Promise<FirefoxPref[]> => {
  const options = new firefox.Options()
    .addArguments("-headless")
    .setBinary(executablePath);
  const driver: WebDriver = await new Builder()
    .forBrowser(Browser.FIREFOX)
    .setFirefoxOptions(options)
    .build();

  let prefs: FirefoxPref[] = [];

  await driver.get("about:config");

  prefs = await driver.executeScript<FirefoxPref[]>(function () {
    const services = (globalThis as unknown as FirefoxGlobal).Services;
    const gPrefBranch = services.prefs;
    const defaultBranch = services.prefs.getDefaultBranch("");
    const prefs: FirefoxPref[] = [];
    for (const name of defaultBranch.getChildList("")) {
      let value;
      try {
        switch (defaultBranch.getPrefType(name)) {
          case gPrefBranch.PREF_BOOL:
            value = defaultBranch.getBoolPref(name);
            break;
          case gPrefBranch.PREF_INT:
            value = defaultBranch.getIntPref(name);
            break;
          case gPrefBranch.PREF_STRING:
            value = defaultBranch.getStringPref(name);
            break;
          case gPrefBranch.PREF_INVALID:
          default:
            continue;
        }
        prefs.push({
          name,
          value,
        });
      } catch (error) {
        console.log(error);
      }
    }
    return prefs;
  });

  await driver.quit();
  return prefs;
};

export const comparePrefs = (
  prefsV1: FirefoxPref[],
  prefsV2: FirefoxPref[],
): ConfigDiff => {
  const prefsMapV1 = new Map<string, ConfigType>(
    prefsV1.map(({ name, value }) => [name, value]),
  );
  const prefsMapV2 = new Map<string, ConfigType>(
    prefsV2.map(({ name, value }) => [name, value]),
  );

  const addedKeys: Key[] = [];
  const removedKeys: Key[] = [];
  const changedKeys: ChangedKey[] = [];

  for (const [key, value] of prefsMapV1.entries()) {
    if (!prefsMapV2.has(key)) {
      removedKeys.push({ key, value: value });
    } else if (JSON.stringify(value) !== JSON.stringify(prefsMapV2.get(key))) {
      changedKeys.push({
        key,
        value: value,
        newValue: prefsMapV2.get(key)!,
      });
    }
  }

  for (const [key, value] of prefsMapV2.entries()) {
    if (!prefsMapV1.has(key)) {
      addedKeys.push({ key, value: value });
    }
  }

  return { addedKeys, removedKeys, changedKeys };
};
