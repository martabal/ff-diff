#!/usr/bin/env node

import { clean } from "./clean";
import { ff_diff } from "./diff";

(async () => {
  const firstArg = process.argv[2];

  if (firstArg == "clean") {
    clean();
    return;
  }
  const version1 = firstArg;
  const version2 = process.argv[3];
  if (!version1 || !version2) {
    console.error(
      `Usage: 
  ff_diff clean [--keep <version1>,<version2>] [--keep-archives] [--keep-sources]
  ff_diff <version1> <version2> [--clean-archives] [--clean-sources] [--do-not-print-diffs-in-console] [--save-diffs-in-file] [--compare-userjs <path>]`,
    );
    process.exit(1);
  }
  ff_diff(version1, version2);
})();
