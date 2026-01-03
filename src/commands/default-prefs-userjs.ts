import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printOptions } from "$cli";
import {
  type FirefoxPref,
  getFirefoxVersion,
  getFirefoxDefaultProfile,
  getPrefs,
  type Pref,
} from "$lib/firefox";
import { defaultsUserJSDir, getPrefsFromInstalledVersion, installDir } from "$lib/install";
import { Format, formatTicks, formatValue } from "$lib/format";
import { parseUserPrefs } from "$lib/prefs";
import { exit, getPathType, gettingPrefsMessage, gettingVersionMessage } from "$lib/helpers";
import { UserJSBasedCommands } from "$commands";
import { type InspectColor, styleText } from "node:util";

interface WrongDefault {
  key: string;
  prefInConfig: Pref;
  defaultPref: Pref;
}

const generateOutput = (
  format: Format,
  wrongDefault: WrongDefault[],
  alreadyDefault: FirefoxPref[],
): string[] => {
  const { tickKeyValue: tick } = formatTicks[format];
  const isText = format === Format.Text;
  const isMarkdown = format === Format.Markdown;

  const msg = (color: InspectColor, text: string): string =>
    isText ? styleText(color, text) : text;

  const formatPrefs = <T extends { key: string }>(
    title: string,
    prefs: T[],
    emptyMsg: string,
    formatter: (pref: T) => string,
  ): string[] => {
    if (prefs.length === 0) return [emptyMsg];

    return [`${title}${isMarkdown ? "\n" : ""}`, ...prefs.map((pref) => `- ${formatter(pref)}`)];
  };

  const formatFirefoxPref = ({ key }: FirefoxPref): string => `${tick}${key}${tick}`;

  const formatWrongDefault = ({ key, prefInConfig, defaultPref }: WrongDefault): string =>
    `${tick}${key}${tick}: ${tick}${formatValue(prefInConfig)}${tick} should be ${tick}${formatValue(defaultPref)}${tick}`;

  const needsSpacer = wrongDefault.length > 0 || alreadyDefault.length > 0;

  return [
    ...formatPrefs(
      msg("yellow", "Wrong default for:"),
      wrongDefault,
      msg("green", "No wrong default prefs"),
      formatWrongDefault,
    ),
    ...(needsSpacer ? [""] : []),
    ...formatPrefs(
      msg("yellow", "Explicit default not set for:"),
      alreadyDefault,
      msg("green", "All prefs have a clear explicit default"),
      formatFirefoxPref,
    ),
  ];
};

export const defaultPrefsUserJS = async (opts: UserJSBasedCommands) => {
  const userJsContent = readFileSync(opts.compareUserjs, "utf8");

  const profilePath = opts.forceDefaultProfile
    ? (await getFirefoxDefaultProfile()).profilePath
    : opts.profilePath;
  console.log(gettingPrefsMessage);
  console.log(gettingVersionMessage);

  const [prefsFirefox, version] = await Promise.all([
    opts.firefoxVersion
      ? getPrefsFromInstalledVersion(
          opts.firefoxVersion,
          join(installDir, opts.firefoxVersion, "firefox", "firefox"),
        )
      : getPrefs({ profilePath }),
    getFirefoxVersion({ profilePath }),
  ]);

  const userKeys = parseUserPrefs(userJsContent);
  userKeys.sort((a, b) => a.key.localeCompare(b.key));
  const alreadyDefault: FirefoxPref[] = [];
  const wrongDefault: WrongDefault[] = [];
  for (const pref of userKeys) {
    const prefsValue = prefsFirefox.get(pref.key);

    if (prefsValue === undefined) {
      // use ff-diff unused-prefs-userjs to know unknown keys
      continue;
    }

    const isDefaultUndefinedAndMatches = pref.default === undefined && pref.value === prefsValue;

    if (isDefaultUndefinedAndMatches) {
      alreadyDefault.push({ key: pref.key, value: prefsValue });
    }

    if (pref.default?.value) {
      const isDefaultDefinedAndDifferent = pref.default?.value !== prefsValue;

      const isDefaultValueVersionInferior =
        pref?.default?.version === undefined || pref?.default?.version <= parseInt(version, 10);

      if (isDefaultDefinedAndDifferent && isDefaultValueVersionInferior) {
        wrongDefault.push({
          key: pref.key,
          defaultPref: prefsValue,
          prefInConfig: pref.default?.value,
        });
      }
    }
  }

  if (!printOptions.doNotPrintConsole) {
    const outputTXT = generateOutput(Format.Text, wrongDefault, alreadyDefault);
    console.log(`\n${outputTXT.join("\n")}`);
  }

  if (printOptions.saveOutput) {
    const outputMD = generateOutput(Format.Markdown, wrongDefault, alreadyDefault);
    const title = `# Default in your user.js and in Firefox ${version}\n\n`;
    const pathType = await getPathType(defaultsUserJSDir);
    if (!existsSync(defaultsUserJSDir)) {
      console.log("creating diffs directory");
      mkdirSync(defaultsUserJSDir);
    } else if (pathType !== "directory") {
      exit(`there's already something here \`${defaultsUserJSDir}\``);
    }
    const diffsPath = join(defaultsUserJSDir, `default-userjs-${version}.md`);
    console.log(`${printOptions.doNotPrintConsole ? "" : "\n"}writing diffs to ${diffsPath}`);
    writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
  }
};
