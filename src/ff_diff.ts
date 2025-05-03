import { existsSync, mkdirSync } from "fs";
import path from "path";
import {
  installFirefox,
  cleanOptions,
  __dirname,
  removeFolder,
} from "./helpers";
import { type ChangedKey, comparePrefs, getPrefs, type Key } from "./firefox";

type ShowDiff<T> = {
  label: string;
  keys: T[];
  format: (key: T) => string;
};

(async () => {
  const version1 = process.argv[2];
  const version2 = process.argv[3];
  const installDir = path.join(__dirname, "dist");

  if (!version1 || !version2) {
    console.error(
      `Usage: npm run compare_ff_prefs <version1> <version2> [--clean-archives] [--clean-sources]`,
    );
    process.exit(1);
  }

  console.log(
    `Installing Firefox v${version1} and v${version2} in "dist" directory`,
  );

  if (!existsSync(installDir)) {
    mkdirSync(installDir);
  }

  try {
    await installFirefox(version1, installDir);
    await installFirefox(version2, installDir);

    const firefoxV1Dir = path.join(installDir, `${version1}/firefox`);
    const firefoxV2Dir = path.join(installDir, `${version2}/firefox`);

    const firefoxV1Path = path.join(firefoxV1Dir, "firefox");
    const firefoxV2Path = path.join(firefoxV2Dir, "firefox");

    const prefsV1 = await getPrefs(firefoxV1Path);
    const prefsV2 = await getPrefs(firefoxV2Path);

    if (cleanOptions.sources) {
      console.log(`Removing sources for Firefox v${version1}`);
      await removeFolder(firefoxV1Dir);
      console.log(`Removing sources for Firefox v${version2}`);
      await removeFolder(firefoxV1Dir);
    } else {
      console.log(`Keeping sources for Firefox v${version1}`);
      console.log(`Keeping sources for Firefox v${version2}`);
    }

    const { addedKeys, removedKeys, changedKeys } = comparePrefs(
      prefsV1,
      prefsV2,
    );

    const sections: ShowDiff<ChangedKey | Key>[] = [
      {
        label: "✅ New keys",
        keys: addedKeys,
        format: (keyString) => {
          const { key, value } = keyString as Key;

          return ` + ${key}: ${value}`;
        },
      },
      {
        label: "❌ Removed keys",
        keys: removedKeys,
        format: (keyString) => {
          const { key } = keyString as Key;

          return ` - ${key}`;
        },
      },
      {
        label: "🔁 Changed keys",
        keys: changedKeys,
        format: (keyString) => {
          const { key, value, newValue } = keyString as ChangedKey;

          return `  ~ ${key}: ${value} -> ${newValue}`;
        },
      },
    ];

    for (const { label, keys, format } of sections) {
      console.log(`\n${label} in ${version2}:`);
      if (keys.length) {
        console.log(keys.map((key) => format(key)).join("\n"));
      } else {
        console.log("(none)");
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
})();
