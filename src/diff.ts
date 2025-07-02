import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { rm } from "fs/promises";
import path from "path";
import {
  installFirefox,
  cleanOptions,
  printOptions,
  getArgumentValue,
  installDir,
  diffsDir,
} from "./helpers";
import {
  type FirefoxChangedPref,
  comparePrefs,
  type FirefoxPref,
  getPrefs,
} from "./firefox";

type PrintDiff = {
  label: string;
  keys: (FirefoxChangedPref | FirefoxPref)[];
  formatter: (key: FirefoxChangedPref | FirefoxPref, format: Format) => string;
};

const formatValue = (val: string | number | boolean) =>
  val === "" ? '""' : val;

type Value = string | number | boolean;

enum Format {
  Markdown,
  Text,
}

interface Ticks {
  tickStart: string;
  tickSymbol: string | undefined;
  tickKeyValue: Value;
}

interface AllFormated extends Ticks {
  tickSymbol: string;
}

const formatTicks: Record<Format, Ticks> = {
  [Format.Markdown]: {
    tickStart: "",
    tickSymbol: "-",
    tickKeyValue: "`",
  },
  [Format.Text]: {
    tickStart: " ",
    tickSymbol: undefined,
    tickKeyValue: "",
  },
};

const handleFormatTicks = (format: Format, symbol: string): AllFormated => {
  const { tickStart, tickSymbol, tickKeyValue } = formatTicks[format];

  return {
    tickStart,
    tickSymbol: tickSymbol ?? symbol,
    tickKeyValue,
  };
};

export const diff = async (version1: string, version2: string) => {
  const removedSymbol = "❌";
  const addedSymbol = "✅";
  const changedSymbol = "🔁";

  const compareUserjs = getArgumentValue("--compare-userjs");

  console.log(
    `Installing Firefox ${version1} and ${version2} in "${installDir}" directory`,
  );

  if (!existsSync(installDir)) {
    mkdirSync(installDir, { recursive: true });
  }

  const versions = [version1, version2];
  await Promise.all(versions.map((version) => installFirefox(version)));

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

  const sections: PrintDiff[] = [
    {
      label: `${addedSymbol} New keys`,
      keys: configDiff.addedKeys,
      formatter: (item, format) => {
        const { key, value } = item as FirefoxPref;
        const {
          tickStart,
          tickSymbol,
          tickKeyValue: tick,
        } = handleFormatTicks(format, "+");
        const formattedValue = formatValue(value);
        return `${tickStart}${tickSymbol} ${tick}${key}${tick}: ${tick}${formattedValue}${tick}`;
      },
    },
    {
      label: `${removedSymbol} Removed keys`,
      keys: configDiff.removedKeys,
      formatter: (item, format) => {
        const { key } = item as FirefoxPref;
        const {
          tickStart,
          tickSymbol,
          tickKeyValue: tick,
        } = handleFormatTicks(format, "-");
        return `${tickStart}${tickSymbol} ${tick}${key}${tick}`;
      },
    },
    {
      label: `${changedSymbol} Changed values`,
      keys: configDiff.changedKeys,
      formatter: (item, format) => {
        const { key, value, newValue } = item as FirefoxChangedPref;
        const {
          tickStart,
          tickSymbol,
          tickKeyValue: tick,
        } = handleFormatTicks(format, "~");
        const formattedValue = formatValue(value);
        const formattedValueNewValue = formatValue(newValue);
        return `${tickStart}${tickSymbol} ${tick}${key}${tick}: ${tick}${formattedValue}${tick} -> ${tick}${formattedValueNewValue}${tick}`;
      },
    },
  ];

  const generateOutput = (format: Format) => {
    const lines: string[] = [];

    for (let index = 0; index < sections.length; index++) {
      const { label, keys, formatter } = sections[index];

      const header =
        format === Format.Markdown
          ? `<details open><summary>\n\n## ${label} in ${version2}\n</summary>\n`
          : `${label} in ${version2}:`;
      const content = keys.length
        ? `${keys.map((key) => formatter(key, format)).join("\n")}${format === Format.Markdown ? "\n\n</details>" : ""}`
        : "(none)";

      lines.push(header, content);

      if (index < sections.length - 1) {
        lines.push("");
      }
    }

    return lines;
  };

  if (printOptions.saveDiffsInFile) {
    const outputMD = generateOutput(Format.Markdown);
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
    const outputTXT = generateOutput(Format.Text);
    console.log(outputTXT.join("\n"));
  }

  if (compareUserjs) {
    if (!printOptions.doNotPrintConsole) {
      console.log("\n");
    }

    console.log("Comparing prefs with the ones from your user.js\n");

    const userJsContent = readFileSync(compareUserjs, "utf-8");

    const userKeys = new Set(
      [...userJsContent.matchAll(/user_pref\("([^"]+)"/g)].map(
        (match) => match[1],
      ),
    );

    const isUserKey = (k: { key: string }) => userKeys.has(k.key);

    const changed = configDiff.changedKeys.filter(isUserKey);
    const removed = configDiff.removedKeys.filter(isUserKey);

    if (changed.length || removed.length) {
      if (changed.length) {
        console.log(
          `${changedSymbol} The following user.js prefs were changed:\n` +
            changed
              .map(
                (pref) =>
                  `~ ${pref.key}: ${formatValue(pref.value)} -> ${formatValue(pref.newValue)}`,
              )
              .join("\n"),
        );
      } else {
        console.log("No prefs from your user.js settings were changed.\n");
      }

      if (changed.length && removed.length) {
        console.log();
      }

      if (removed.length) {
        console.log(
          `${removedSymbol} The following prefs were removed:\n` +
            removed.map((pref) => `- ${pref.key}`).join("\n"),
        );
      } else {
        console.log("No prefs from your user.js settings were removed.");
      }
    } else {
      console.log(
        "No prefs from your user.js settings were changed or removed.",
      );
    }
  }
};
