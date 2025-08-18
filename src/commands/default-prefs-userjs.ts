import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printOptions } from "$cli";
import {
  type FirefoxPref,
  getFirefoxVersion,
  getFirefoxDefaultProfile,
  getPrefs,
} from "$lib/firefox";
import { defaultsUserJSDir } from "$lib/install";
import { Format, formatTicks, formatValue } from "$lib/format";
import { parseUserPrefs } from "$lib/prefs";
import { gettingPrefsMessage, gettingVersionMessage } from "$lib/helpers";
import { UserJSBasedCommands } from "$commands";

const generateOutput = (
  format: Format,
  wrongDefault: FirefoxPref[],
  alreadyDefault: FirefoxPref[],
) => {
  const { tickKeyValue: tick } = formatTicks[format];

  const formatPrefs = (
    title: string,
    prefs: FirefoxPref[],
    emptyMsg: string,
  ) => {
    if (prefs.length === 0) {
      return [emptyMsg];
    }
    return [
      `${title}${format === Format.Markdown ? "\n" : ""}`,
      ...prefs.map(
        (pref) =>
          `- ${tick}${pref.key}${tick}: ${tick}${formatValue(pref.value)}${tick}`,
      ),
    ];
  };

  return [
    ...formatPrefs(
      "Wrong default for:",
      wrongDefault,
      "No wrong default prefs",
    ),
    ...(wrongDefault.length > 0 || alreadyDefault.length > 0 ? [""] : []),
    ...formatPrefs(
      "Explicit default not set for:",
      alreadyDefault,
      "All prefs have a clear explicit default",
    ),
  ];
};

export const defaultPrefsUserJS = async (opts: UserJSBasedCommands) => {
  const userJsContent = readFileSync(opts.compareUserjs, "utf8");

  const profilePath = opts.forceDefaultProfile
    ? getFirefoxDefaultProfile().profilePath
    : opts.profilePath;
  console.log(gettingPrefsMessage);
  const prefsFirefox = await getPrefs({ profilePath });
  console.log(gettingVersionMessage);
  const version = await getFirefoxVersion({ profilePath });

  const userKeys = parseUserPrefs(userJsContent);
  userKeys.sort((a, b) => a.key.localeCompare(b.key));
  const alreadyDefault: FirefoxPref[] = [];
  const wrongDefault: FirefoxPref[] = [];
  for (const pref of userKeys) {
    const prefsValue = prefsFirefox.get(pref.key);

    if (prefsValue === undefined) {
      // use ff-diff unused-prefs-userjs to know unknown keys
      continue;
    }

    const isDefaultUndefinedAndMatches =
      pref.default === undefined && pref.value === prefsValue;

    if (isDefaultUndefinedAndMatches) {
      alreadyDefault.push({ key: pref.key, value: prefsValue });
    }

    const isDefaultDefinedAndDifferent =
      pref.default?.value && pref.default?.value !== prefsValue;

    const isDefaultValueVersionInferior =
      pref?.default?.version === undefined ||
      pref?.default?.version <= parseInt(version, 10);

    if (isDefaultDefinedAndDifferent && isDefaultValueVersionInferior) {
      wrongDefault.push({ key: pref.key, value: prefsValue });
    }
  }

  if (!printOptions.doNotPrintConsole) {
    const outputTXT = generateOutput(Format.Text, wrongDefault, alreadyDefault);
    console.log(`\n${outputTXT.join("\n")}`);
  }

  if (printOptions.saveOutput) {
    const outputMD = generateOutput(
      Format.Markdown,
      wrongDefault,
      alreadyDefault,
    );
    const title = `# Default in your user.js and in Firefox ${version}\n\n`;
    if (!existsSync(defaultsUserJSDir)) {
      console.log("creating diffs directory");
      mkdirSync(defaultsUserJSDir);
    }
    const diffsPath = join(defaultsUserJSDir, `default-userjs-${version}.md`);
    console.log(
      `${printOptions.doNotPrintConsole ? "" : "\n"}writing diffs to ${diffsPath}`,
    );
    writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
  }
};
