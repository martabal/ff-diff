import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  diffsDir,
  getArgumentValue,
  installDir,
  installFirefox,
} from "./helpers";
import {
  type FirefoxChangedPref,
  type FirefoxPref,
  type Pref,
  comparePrefs,
  getPrefs,
} from "./firefox";
import { cleanOptions, compareUserjsArg, Diff, printOptions } from "./cli";

interface PrintDiff {
  label: string;
  keys: (FirefoxChangedPref | FirefoxPref)[];
  formatter: (key: FirefoxChangedPref | FirefoxPref, format: Format) => string;
}

type Value = string | number | boolean;

enum Format {
  Markdown = "md",
  Text = "txt",
}

interface Ticks {
  tickStart: string;
  tickSymbol?: string;
  tickKeyValue: Value;
}

interface AllFormated extends Ticks {
  tickSymbol: string;
}

const formatValue = (val: Pref): Pref => ("" === val ? " " : val);

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

const handlePref = async (
  version: string,
  installPath: string,
): Promise<Map<string, Pref>> => {
  await installFirefox({ version, retry: false });
  return getPrefs(installPath);
};

const handleFormatTicks = (format: Format, symbol: string): AllFormated => {
  const { tickStart, tickSymbol, tickKeyValue } = formatTicks[format];

  return {
    tickStart,
    tickSymbol: tickSymbol ?? symbol,
    tickKeyValue,
  };
};

interface PrefInfo {
  key: string;
  value: string;
  versionAdded?: string;
  versionRemoved?: string;
  custom: boolean;
  hidden: boolean;
}

export const parseUserPrefs = (content: string): PrefInfo[] => {
  const result: PrefInfo[] = [];

  const regex =
    /user_pref\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]*?)\s*\)(?:;\s*\/\/\s*(.*))?/gm;

  for (const match of content.matchAll(regex)) {
    const key = match[1];
    const value = match[2];
    const comment = match[3] || "";

    const custom = /\[CUSTOM PREF\]/i.test(comment);
    const hidden = /\[HIDDEN PREF\]/i.test(comment);

    const versionAddedMatch = comment.match(/\[FF(\d+)\+\]/);
    const versionRemovedMatch = comment.match(/\[FF(\d+)-\]/);

    const versionAdded = versionAddedMatch ? versionAddedMatch[1] : undefined;
    const versionRemoved = versionRemovedMatch
      ? versionRemovedMatch[1]
      : undefined;

    result.push({ key, value, versionAdded, versionRemoved, custom, hidden });
  }

  return result;
};

export const diff = async () => {
  const version1 = process.argv[3];
  const version2 = process.argv[4];
  if (version1 === undefined || version2 === undefined) {
    new Diff().usage();
  }

  const removedSymbol = "❌";
  const addedSymbol = "✅";
  const changedSymbol = "🔁";

  const compareUserjs = getArgumentValue(compareUserjsArg);

  console.log(
    `Installing Firefox ${version1} and ${version2} in "${installDir}" directory`,
  );

  if (!existsSync(installDir)) {
    mkdirSync(installDir, { recursive: true });
  }

  const versions = [version1, version2];

  const firefoxDirs = versions.map((version) => {
    const dir = path.join(installDir, version, "firefox");
    return {
      version,
      dir,
      installPath: path.join(dir, "firefox"),
    };
  });

  const [prefsMapV1, prefsMapV2] = await Promise.all(
    firefoxDirs.map(({ version, installPath }) =>
      handlePref(version, installPath),
    ),
  );

  if (cleanOptions.sources) {
    await Promise.all(
      firefoxDirs.map(({ dir, version }) => {
        console.log(`Removing sources for Firefox ${version}`);
        rm(dir, { recursive: true });
      }),
    );
  }

  const configDiff = comparePrefs(prefsMapV1, prefsMapV2);

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

    for (let index = 0; index < sections.length; index += 1) {
      const { label, keys, formatter } = sections[index];

      const header =
        format === Format.Markdown
          ? `<details open><summary>\n\n## ${label} in ${version2}\n</summary>\n`
          : `${label} in ${version2}:`;
      const content =
        0 < keys.length
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

    const userJsContent = readFileSync(compareUserjs, "utf8");

    const userKeys = parseUserPrefs(userJsContent);

    const isUserKey = (k: { key: string }) =>
      userKeys.some((pref) => pref.key === k.key);

    const changed = configDiff.changedKeys.filter(isUserKey);
    const removed = configDiff.removedKeys.filter(isUserKey);

    if (0 < changed.length || 0 < removed.length) {
      if (0 < changed.length) {
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

      if (0 < changed.length && 0 < removed.length) {
        console.log();
      }

      if (0 < removed.length) {
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
