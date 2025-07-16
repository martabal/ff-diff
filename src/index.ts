#!/usr/bin/env node

import { clean } from "./clean";
import { diff } from "./diff";
import { cleanArg, diffArg, unusedPrefsArg, usage } from "./helpers";
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

  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log(usage);
    return;
  }

  console.error(usage);
  process.exit(1);
})();
