#!/usr/bin/env node

import {
  Clean,
  cleanArg,
  Cli,
  Diff,
  diffArg,
  helpArgs,
  UnusedPref,
  unusedPrefsArg,
  versionArgs,
} from "./cli";

const matchFirstArg = (firstArg: string) => {
  switch (firstArg) {
    case unusedPrefsArg:
      return new UnusedPref(false);
    case diffArg:
      return new Diff(false);
    case cleanArg:
      return new Clean(false);
    default:
      return new Cli(true);
  }
};

const handletest = (firstArg: string, secondArg: string) => {
  if (helpArgs.includes(firstArg) && secondArg === undefined) {
    new Cli(false).usage();
  } else if (process.argv.some((arg) => versionArgs.includes(arg))) {
    console.log(`${APP_NAME} ${APP_VERSION}`);
  } else if (helpArgs.includes(secondArg)) {
    matchFirstArg(firstArg).usage();
  } else {
    matchFirstArg(firstArg).entrypoint();
  }
};

(async () => {
  const firstArg = process.argv[2];
  const secondArg = process.argv[3];

  handletest(firstArg, secondArg);
})();
