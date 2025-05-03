import { existsSync, mkdirSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import path from "path";
import {
  installFirefox,
  cleanOptions,
  __dirname,
  printOptions,
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
  const changelogDir = path.join(__dirname, "changelog");

  if (!version1 || !version2) {
    console.error(
      `Usage: npm run compare_ff_prefs <version1> <version2> [--clean-archives] [--clean-sources] [--do-not-print-changelog-in-console] [--save-in-changelog-file]`,
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
      await rm(firefoxV1Dir, { recursive: true });
      console.log(`Removing sources for Firefox v${version2}`);
      await rm(firefoxV1Dir, { recursive: true });
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

    const output = [];
    for (let i = 0; i < sections.length; i++) {
      const { label, keys, format } = sections[i];
      output.push(`${label} in ${version2}:`);
      if (keys.length) {
        output.push(keys.map((key) => format(key)).join("\n"));
      } else {
        output.push("(none)");
      }
      if (i < sections.length - 1) {
        output.push("\n");
      }
    }

    if (printOptions.saveInChangelogFile) {
      if (!existsSync(changelogDir)) {
        console.log("creating changelog directory");
        mkdirSync(changelogDir);
      }
      const changelogPath = path.join(
        changelogDir,
        `${version1}-${version2}.txt`,
      );
      console.log(`writing changelog to ${changelogPath}`);
      writeFileSync(changelogPath, output.join("\n") + "\n");
    }
    if (!printOptions.doNotPrintConsole) {
      console.log(output.join("\n"));
    }
  } catch (err) {
    console.error("Error:", err);
  }
})();
