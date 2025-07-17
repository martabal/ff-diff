#!/usr/bin/env node

import { clean } from "./clean";
import { diff } from "./diff";
import {
  cleanArg,
  diffArg,
  helpArgs,
  unusedPrefsArg,
  usage,
  versionArgs,
} from "./helpers";
import { unusedPrefs } from "./unused-prefs";

(async () => {
  const firstArg = process.argv[2];

  if (firstArg === cleanArg) {
    await clean();
    return;
  }

  if (firstArg === diffArg) {
    await diff();
    return;
  }

  if (firstArg === unusedPrefsArg) {
    await unusedPrefs();
    return;
  }

  if (process.argv.some((arg) => helpArgs.includes(arg))) {
    console.log(usage);
    return;
  }
  if (process.argv.some((arg) => versionArgs.includes(arg))) {
    console.log(`${APP_NAME} ${APP_VERSION}`);
    return;
  }

  console.error(usage);
  process.exit(1);
})();
