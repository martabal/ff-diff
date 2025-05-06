import { Builder, Browser, WebDriver } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

export type FirefoxPref = {
  key: string;
  value: ConfigType;
};

type FirefoxScript = {
  prefs: FirefoxPref[];
  errors: string[];
};

export interface FirefoxChangedPref extends FirefoxPref {
  newValue: ConfigType;
}

type ConfigType = string | number | boolean;

export type ConfigDiff = {
  addedKeys: FirefoxPref[];
  removedKeys: FirefoxPref[];
  changedKeys: FirefoxChangedPref[];
};

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

  await driver.get("about:config");

  const { prefs, errors } = await driver.executeScript<FirefoxScript>(
    function () {
      const services = (globalThis as unknown as FirefoxGlobal).Services;
      const defaultBranch = services.prefs.getDefaultBranch("");
      const prefs: FirefoxPref[] = [];
      const errors: string[] = [];
      for (const key of defaultBranch.getChildList("")) {
        let value: ConfigType;
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
            case defaultBranch.PREF_INVALID:
            default:
              continue;
          }
          prefs.push({
            key,
            value,
          });
        }
      }
      return { prefs, errors };
    },
  );
  if (errors.length) {
    console.error(`Errors with prefs${errors}`);
  }
  await driver.quit();
  return prefs;
};

export const comparePrefs = (
  prefsV1: FirefoxPref[],
  prefsV2: FirefoxPref[],
): ConfigDiff => {
  const prefsMapV1 = new Map<string, ConfigType>(
    prefsV1.map(({ key, value }) => [key, value]),
  );
  const prefsMapV2 = new Map<string, ConfigType>(
    prefsV2.map(({ key, value }) => [key, value]),
  );

  const addedKeys: FirefoxPref[] = [];
  const removedKeys: FirefoxPref[] = [];
  const changedKeys: FirefoxChangedPref[] = [];

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
