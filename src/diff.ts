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
  PrefsDiff,
  comparePrefs,
  getPrefs,
} from "./firefox";
import { cleanOptions, CliArg, Diff, printOptions } from "./cli";
import { parseUserPrefs } from "./prefs";

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

const removedSymbol = "❌";
const addedSymbol = "✅";
const changedSymbol = "🔁";

const getSections = (configDiff: PrefsDiff): PrintDiff[] => {
  return [
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
};

const handleCompareUsersJS = (
  compareUsersJS: string,
  configDiff: PrefsDiff,
) => {
  if (!printOptions.doNotPrintConsole) {
    console.log("\n");
  }
  console.log("Comparing prefs with the ones from your user.js\n");

  const userJsContent = readFileSync(compareUsersJS, "utf8");
  const userKeys = parseUserPrefs(userJsContent);

  const isUserKey = (k: { key: string }) =>
    userKeys.some((pref) => pref.key === k.key);

  const changed = configDiff.changedKeys.filter(isUserKey);
  const removed = configDiff.removedKeys.filter(isUserKey);

  if (changed.length > 0 || removed.length > 0) {
    if (changed.length > 0) {
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

    if (changed.length > 0 && removed.length > 0) {
      console.log();
    }

    if (removed.length > 0) {
      console.log(
        `${removedSymbol} The following prefs were removed:\n` +
          removed.map((pref) => `- ${pref.key}`).join("\n"),
      );
    } else {
      console.log("No prefs from your user.js settings were removed.");
    }
  } else {
    console.log("No prefs from your user.js settings were changed or removed.");
  }
};

const generateOutput = (
  format: Format,
  sections: PrintDiff[],
  newVersion: string,
) => {
  const lines: string[] = [];

  for (let index = 0; index < sections.length; index += 1) {
    const { label, keys, formatter } = sections[index];

    const header =
      format === Format.Markdown
        ? `<details open><summary>\n\n## ${label} in ${newVersion}\n</summary>\n`
        : `${label} in ${newVersion}:`;
    const content =
      keys.length > 0
        ? `${keys.map((key) => formatter(key, format)).join("\n")}${format === Format.Markdown ? "\n\n</details>" : ""}`
        : "(none)";

    lines.push(header, content);

    if (index < sections.length - 1) {
      lines.push("");
    }
  }

  return lines;
};

const handleOutputDiff = (
  sections: PrintDiff[],
  newVersion: string,
  oldVersion: string,
) => {
  if (printOptions.saveDiffsInFile) {
    const outputMD = generateOutput(Format.Markdown, sections, newVersion);
    const title = `# Diffs Firefox ${oldVersion}-${newVersion}\n\n`;
    if (!existsSync(diffsDir)) {
      console.log("creating diffs directory");
      mkdirSync(diffsDir);
    }
    const diffsPath = path.join(diffsDir, `${oldVersion}-${newVersion}.md`);
    console.log(`writing diffs to ${diffsPath}`);
    writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
  }

  if (!printOptions.doNotPrintConsole) {
    const outputTXT = generateOutput(Format.Text, sections, newVersion);
    console.log(outputTXT.join("\n"));
  }
};

export const diff = async () => {
  const oldVersion = process.argv[3];
  const newVersion = process.argv[4];
  if (oldVersion === undefined || newVersion === undefined) {
    new Diff().usage();
  }

  const compareUserjs = getArgumentValue(CliArg.compareUserjs);

  console.info(
    `Installing Firefox ${oldVersion} and ${newVersion} in "${installDir}"`,
  );

  if (!existsSync(installDir)) {
    mkdirSync(installDir, { recursive: true });
  }

  const versions = [oldVersion, newVersion];

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
      firefoxDirs.map(async ({ dir, version }) => {
        console.log(`Removing sources for Firefox ${version}`);
        await rm(dir, { recursive: true, force: true });
      }),
    );
  }

  const configDiff = comparePrefs(prefsMapV1, prefsMapV2);
  const sections = getSections(configDiff);

  handleOutputDiff(sections, newVersion, oldVersion);

  if (compareUserjs) {
    handleCompareUsersJS(compareUserjs, configDiff);
  }
};
