import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { printOptions } from "@cli";
import {
  type FirefoxPref,
  getFirefoxVersion,
  getInstalledFirefoxPath,
  getPrefs,
} from "@lib/firefox";
import {
  defaultsUserJSDir,
  Format,
  formatTicks,
  formatValue,
} from "@lib/helpers";
import { parseUserPrefs } from "@lib/prefs";

const generateOutput = (
  format: Format,
  defaults: FirefoxPref[],
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

export const defaultPrefsUserJS = async (compareUserjs: string) => {
  const userJsContent = readFileSync(compareUserjs, "utf8");

  const { path: firefoxPath } = getInstalledFirefoxPath();
  const prefsFirefox = await getPrefs(firefoxPath);
  const version = await getFirefoxVersion(firefoxPath);

  const userKeys = parseUserPrefs(userJsContent);
  userKeys.sort((a, b) => a.key.localeCompare(b.key));
  const defaults: FirefoxPref[] = [];
  for (const pref of userKeys) {
    const prefsValue = prefsFirefox.get(pref.key);

    if (prefsValue === undefined) continue;

    const isDefaultUndefinedAndMatches =
      pref.default === undefined && pref.value === prefsValue;

    const isDefaultDefinedAndDifferent = pref.default?.value !== prefsValue;

    const isDefaultValueVersionInferior =
      (pref?.default?.version ?? Infinity) <= parseInt(version, 10);

    if (
      isDefaultUndefinedAndMatches ||
      (isDefaultDefinedAndDifferent && isDefaultValueVersionInferior)
    ) {
      defaults.push({ key: pref.key, value: prefsValue });
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
    const diffsPath = join(defaultsUserJSDir, `default-userjs-${version}.md`);
    console.log(`writing diffs to ${diffsPath}`);
    writeFileSync(diffsPath, title + outputMD.join("\n") + "\n");
  }
};
