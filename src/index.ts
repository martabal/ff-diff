#!/usr/bin/env node

import {
  Clean,
  Cli,
  CliCommand,
  Diff,
  helpArgs,
  UnusedPref,
  versionArgs,
} from "./cli";

const matchFirstArg = (firstArg: string) => {
  switch (firstArg) {
    case CliCommand.unusedPrefsArg:
      return new UnusedPref(false);
    case CliCommand.diffArg:
      return new Diff(false);
    case CliCommand.cleanArg:
      return new Clean(false);
    default:
      return new Cli(true);
  }
};

(() => {
  const firstArg = process.argv[2];
  const secondArg = process.argv[3];

  if (helpArgs.includes(firstArg) && secondArg === undefined) {
    new Cli(false).usage();
  } else if (process.argv.some((arg) => versionArgs.includes(arg))) {
    console.log(`${APP_NAME} ${APP_VERSION}`);
  } else if (helpArgs.includes(secondArg)) {
    matchFirstArg(firstArg).usage();
  } else {
    matchFirstArg(firstArg).entrypoint();
  }
})();
