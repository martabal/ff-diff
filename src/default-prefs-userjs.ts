import {
  getFirefoxVersion,
  getInstalledFirefoxPath,
  getPrefs,
} from "./firefox";
import { DefaultPrefsUserJSCommand, printOptions } from "./cli";
import { parseUserPrefs, type UserPref } from "./prefs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultsUserJSDir, Format, formatTicks, formatValue } from "./helpers";

const generateOutput = (
  format: Format,
  defaults: UserPref[],
  compareUserjs: string,
) => {
  const { tickStart, tickKeyValue: tick } = formatTicks[format];

  const lines: string[] = [];

  if (defaults.length === 0) {
    lines.push(`No default prefs in ${compareUserjs}`);
  } else {
    for (const pref of defaults) {
      const formattedValue = formatValue(pref.value);
      lines.push(
        `${tickStart}${tick}${pref.key}${tick}: ${tick}${formattedValue}${tick}`,
      );
    }
  }

  return lines;
};

export const defaultPrefsUserJS = async () => {
  const [, , , compareUserjs] = process.argv;
  if (compareUserjs === undefined) {
    new DefaultPrefsUserJSCommand().usage();
  }

  const userJsContent = readFileSync(compareUserjs, "utf8");

  const { path: firefoxPath } = getInstalledFirefoxPath();
  const prefsFirefox = await getPrefs(firefoxPath);
  const version = await getFirefoxVersion(firefoxPath);

  const userKeys = parseUserPrefs(userJsContent);
  userKeys.sort((a, b) => a.key.localeCompare(b.key));
  const defaults: UserPref[] = [];
  for (const pref of userKeys) {
    if (
      prefsFirefox.has(pref.key) &&
      prefsFirefox.get(pref.key) === pref.value
    ) {
      defaults.push({ key: pref.key, value: pref.value });
    }
  }

  if (!printOptions.doNotPrintConsole) {
    const outputTXT = generateOutput(Format.Text, defaults, compareUserjs);
    console.log(outputTXT.join("\n"));
  }

  if (printOptions.saveOutput) {
    const outputMD = generateOutput(Format.Markdown, defaults, compareUserjs);
    const title = `# Default in your user.js and in Firefox ${version}\n\n`;
    if (!existsSync(defaultsUserJSDir)) {
      console.log("creating diffs directory");
      mkdirSync(defaultsUserJSDir);
    }
    const diffsPath = path.join(
      defaultsUserJSDir,
      `default-userjs-${version}.md`,
    );
    console.log(`writing diffs to ${diffsPath}`);
    writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
  }
};
