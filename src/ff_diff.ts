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

  const versions = [version1, version2];
  await Promise.all(
    versions.map((version) => installFirefox(version, installDir)),
  );

  const dirs = versions.map((version) =>
    path.join(installDir, version, "firefox"),
  );
  const paths = dirs.map((dir) => path.join(dir, "firefox"));

  const prefs = await Promise.all(paths.map(getPrefs));

  for (const version of versions) {
    console.log(`Removing sources for Firefox ${version}`);
  }

  if (cleanOptions.sources) {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true })));
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

    for (let index = 0; index < sections.length; index++) {
      const { label, keys, formatter } = sections[index];

      const header =
        format === "md"
          ? `<details open><summary>\n\n## ${label} in ${version2}\n</summary>\n`
          : `${label} in ${version2}:`;
      const content = keys.length
        ? `${keys.map((key) => formatter(key, format)).join("\n")}${format === "md" ? "\n\n</details>" : ""}`
        : "(none)";

      lines.push(header, content);

      if (index < sections.length - 1) {
        lines.push("");
      }
    }

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

    const isUserKey = (k: { key: string }) => userKeys.includes(k.key);

    const changed = configDiff.changedKeys.filter(isUserKey);
    const removed = configDiff.removedKeys.filter(isUserKey);

    if (changed.length || removed.length) {
      if (changed.length) {
        console.log(
          "The following user.js settings were changed:\n" +
            changed
              .map(
                (pref) =>
                  `~ ${pref.key}: ${formatValue(pref.value)} -> ${formatValue(pref.newValue)}`,
              )
              .join("\n"),
        );
      }

      if (changed.length && removed.length) {
        console.log();
      }

      if (removed.length) {
        console.log(
          "The following user.js settings were removed:\n" +
            removed.map((pref) => `- ${pref.key}`).join("\n"),
        );
      }
    } else {
      console.log("No user.js settings were changed.");
    }
  }
})();
