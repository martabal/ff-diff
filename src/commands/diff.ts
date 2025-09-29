import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { cleanOptions, Diff, printOptions } from "$cli";
import {
  type FirefoxChangedPref,
  type FirefoxPref,
  type Pref,
  type PrefsDiff,
  comparePrefs,
  getPrefs,
} from "$lib/firefox";
import {
  type AllFormated,
  Format,
  formatTicks,
  formatValue,
  type PrintDiff,
} from "$lib/format";
import { isUnitDifferenceOne } from "$lib/helpers";
import { commonChangedValuesForKeys, parseUserPrefs } from "$lib/prefs";
import { diffsDir, installDir, installFirefox } from "$lib/install";

const handlePref = async (
  version: string,
  executablePath: string,
): Promise<Map<string, Pref>> => {
  await installFirefox({ version, retry: false });
  return getPrefs({ executablePath });
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
  oldVersion: string,
  newVersion: string,
) => {
  if (!printOptions.doNotPrintConsole) {
    console.log("\n");
  }
  console.log("Comparing prefs with the ones from your user.js\n");

  const version = Number(newVersion);
  const userJsContent = readFileSync(compareUsersJS, "utf8");
  const userKeys = parseUserPrefs(userJsContent);

  const { addedKeys, removedKeys, changedKeys } = configDiff;

  const isUserKeyChanged = ({ key, value }: { key: string; value: Pref }) =>
    userKeys.some(
      (pref) =>
        pref.key === key &&
        pref.default?.version === version &&
        pref.default.value === value,
    );

  const isUserKeyRemoved = ({ key }: { key: string }) =>
    userKeys.some(
      (pref) => pref.key === key && pref.versionRemoved === undefined,
    );

  const shouldCheckIfCorrectDefault = isUnitDifferenceOne(
    oldVersion,
    newVersion,
  );

  const wrongDefaultAdded = shouldCheckIfCorrectDefault
    ? userKeys.filter(
        (pref) =>
          pref.versionAdded === version &&
          !addedKeys.some((added) => added.key === pref.key),
      )
    : [];

  const wrongDefaultRemoved = shouldCheckIfCorrectDefault
    ? userKeys.filter(
        (pref) =>
          pref.versionRemoved === version &&
          !removedKeys.some((removed) => removed.key === pref.key),
      )
    : [];

  const changed = changedKeys.filter((key) => isUserKeyChanged(key));
  const removed = removedKeys.filter((key) => isUserKeyRemoved(key));

  if (
    wrongDefaultAdded.length === 0 &&
    wrongDefaultRemoved.length === 0 &&
    changed.length === 0 &&
    removed.length === 0
  ) {
    console.log("No prefs from your user.js settings were changed or removed.");
    return;
  }

  const output: string[] = [];

  const addWrongDefaultsMessage = (
    prefs: typeof userKeys,
    type: "added" | "removed",
  ) => {
    if (prefs.length === 0) {
      return null;
    }

    const messageTitle = `${removedSymbol} Some prefs are marked as ${type} on version ${newVersion} but that's incorrect:\n`;

    const messageBody = prefs.map((pref) => `~ ${pref.key}`).join("\n");

    return messageTitle + messageBody + "\n";
  };

  const wrongAddedMsg = addWrongDefaultsMessage(wrongDefaultAdded, "removed");
  const wrongRemovedMsg = addWrongDefaultsMessage(wrongDefaultRemoved, "added");

  if (wrongAddedMsg) output.push(wrongAddedMsg);
  if (wrongRemovedMsg) output.push(wrongRemovedMsg);

  if (changed.length > 0) {
    output.push(
      `${changedSymbol} The following user.js prefs were changed:\n` +
        changed
          .map(
            (pref) =>
              `~ ${pref.key}: ${formatValue(pref.value)} -> ${formatValue(pref.newValue)}`,
          )
          .join("\n"),
    );
  } else {
    output.push("No prefs from your user.js settings were changed.");
  }

  if (removed.length > 0) {
    output.push(
      `${removedSymbol} The following prefs were removed:\n` +
        removed.map((pref) => `- ${pref.key}`).join("\n"),
    );
  } else {
    output.push("No prefs from your user.js settings were removed.");
  }

  console.log(output.join("\n"));
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
        ? `<details open><summary>\n\n## ${label} in ${newVersion}\n\n</summary>\n`
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
  if (!printOptions.doNotPrintConsole) {
    const outputTXT = generateOutput(Format.Text, sections, newVersion);
    console.log(outputTXT.join("\n"));
  }
  if (printOptions.saveOutput) {
    const outputMD = generateOutput(Format.Markdown, sections, newVersion);
    const title = `# Diffs Firefox ${oldVersion}-${newVersion}\n\n`;
    if (!existsSync(diffsDir)) {
      console.log("creating diffs directory");
      mkdirSync(diffsDir);
    }
    const diffsPath = join(diffsDir, `${oldVersion}-${newVersion}.md`);
    console.log(`writing diffs to ${diffsPath}`);
    writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
  }
};

export const diff = async (args: Diff) => {
  console.info(
    `Installing Firefox ${args.oldVersion} and ${args.newVersion} in "${installDir}"`,
  );

  if (!existsSync(installDir)) {
    mkdirSync(installDir, { recursive: true });
  }

  const versions = [args.oldVersion, args.newVersion];

  const firefoxDirs = versions.map((version) => {
    const dir = join(installDir, version, "firefox");
    return {
      version,
      dir,
      installPath: join(dir, "firefox"),
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

  if (args.hideCommonChangedValues) {
    for (const key of commonChangedValuesForKeys) {
      configDiff.changedKeys = configDiff.changedKeys.filter(
        (pref) => pref.key !== key,
      );
    }
  }

  const sections = getSections(configDiff);

  handleOutputDiff(sections, args.newVersion, args.oldVersion);

  if (args.compareUserJS) {
    handleCompareUsersJS(
      args.compareUserJS,
      configDiff,
      args.oldVersion,
      args.newVersion,
    );
  }
};
