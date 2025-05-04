import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import path from "path";
import {
  installFirefox,
  cleanOptions,
  __dirname,
  printOptions,
  getArgumentValue,
} from "./helpers";
import { type ChangedKey, comparePrefs, getPrefs, type Key } from "./firefox";

type ShowDiff<T> = {
  label: string;
  keys: T[];
  formatter: (key: T, format: "md" | "txt") => string;
};

(async () => {
  const version1 = process.argv[2];
  const version2 = process.argv[3];
  const installDir = path.join(__dirname, "dist");
  const diffsDir = path.join(__dirname, "diffs");

  if (!version1 || !version2) {
    console.error(
      `Usage: npm run compare_ff_prefs <version1> <version2> [--clean-archives] [--clean-sources] [--do-not-print-diffs-in-console] [--save-diffs-in-file] [--compare-userjs <path>]`,
    );
    process.exit(1);
  }

  const compareUserjs = getArgumentValue("--compare-userjs");

  console.log(
    `Installing Firefox ${version1} and ${version2} in "dist" directory`,
  );

  if (!existsSync(installDir)) {
    mkdirSync(installDir);
  }

  try {
    const versions = [version1, version2];
    await Promise.all(versions.map((v) => installFirefox(v, installDir)));

    const dirs = versions.map((v) => path.join(installDir, v, "firefox"));
    const paths = dirs.map((d) => path.join(d, "firefox"));

    const prefs = await Promise.all(paths.map(getPrefs));

    const action = cleanOptions.sources ? "Removing" : "Keeping";
    versions.forEach((v) => console.log(`${action} sources for Firefox ${v}`));

    if (cleanOptions.sources) {
      await Promise.all(dirs.map((d) => rm(d, { recursive: true })));
    }

    const configDiff = comparePrefs(prefs[0], prefs[1]);
    const tickFor = (format: string) => (format === "md" ? "`" : "");
    const tickTxtFor = (format: string) => (format === "txt" ? " " : "");
    const symbol = (format: "md" | "txt", symbol: string) =>
      format == "md" ? "-" : symbol;
    const formatValue = (val: string | number | boolean) =>
      val === "" ? '""' : val;

    const sections: ShowDiff<ChangedKey | Key>[] = [
      {
        label: "✅ New keys",
        keys: configDiff.addedKeys,
        formatter: (item, format) => {
          const { key, value } = item as Key;
          const tick = tickFor(format);
          const tickTxt = tickTxtFor(format);
          return `${tickTxt}${symbol(format, "+")} ${tick}${key}${tick}: ${tick}${formatValue(value)}${tick}`;
        },
      },
      {
        label: "❌ Removed keys",
        keys: configDiff.removedKeys,
        formatter: (item, format) => {
          const { key } = item as Key;
          const tick = tickFor(format);
          const tickTxt = tickTxtFor(format);
          return `${tickTxt}${symbol(format, "-")} ${tick}${key}${tick}`;
        },
      },
      {
        label: "🔁 Changed keys",
        keys: configDiff.changedKeys,
        formatter: (item, format) => {
          const { key, value, newValue } = item as ChangedKey;
          const tick = tickFor(format);
          const tickTxt = tickTxtFor(format);
          return `${tickTxt}${symbol(format, "~")} ${tick}${key}${tick}: ${tick}${formatValue(value)}${tick} -> ${tick}${formatValue(newValue)}${tick}`;
        },
      },
    ];

    const generateOutput = (format: "md" | "txt") => {
      const lines: string[] = [];

      sections.forEach(({ label, keys, formatter }, index) => {
        const header =
          format === "md"
            ? `<details open><summary>\n\n## ${label} in ${version2}\n</summary>\n`
            : `${label} in ${version2}:\n`;
        const content = keys.length
          ? `${keys.map((key) => formatter(key, format)).join("\n")}${"\n\n</details>"}`
          : "(none)";

        lines.push(header, content);

        if (index < sections.length - 1) {
          lines.push("");
        }
      });

      return lines;
    };

    const outputMD = generateOutput("md");
    const outputTXT = generateOutput("txt");

    if (printOptions.saveDiffsInFile) {
      const title = `# Diffs Firefox ${version1}-${version2}\n\n`;
      if (!existsSync(diffsDir)) {
        console.log("creating diffs directory");
        mkdirSync(diffsDir);
      }
      const diffsPath = path.join(diffsDir, `${version1}-${version2}.md`);
      console.log(`writing diffs to ${diffsPath}`);
      writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
    }

    if (!printOptions.doNotPrintConsole) {
      console.log(outputTXT.join("\n"));
    }

    if (compareUserjs) {
      if (!printOptions.doNotPrintConsole) {
        console.log("\n");
      }

      const userJsContent = readFileSync(compareUserjs, "utf-8");

      const userKeys = [...userJsContent.matchAll(/user_pref\("([^"]+)"/g)].map(
        (match) => match[1],
      );

      const changed = configDiff.changedKeys.filter((k) =>
        userKeys.includes(k.key),
      );
      const removed = configDiff.removedKeys.filter((k) =>
        userKeys.includes(k.key),
      );

      if (changed.length > 0) {
        console.log("The following user.js settings were changed:", changed);
      }

      if (removed.length > 0) {
        console.log("The following user.js settings were removed:", removed);
      }

      if (changed.length === 0 && removed.length === 0) {
        console.log("No user.js settings were changed.");
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
})();
