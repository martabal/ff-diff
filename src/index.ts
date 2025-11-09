#!/usr/bin/env node
import {
  Cli,
  VERSION_ARGS_VALUES,
  HELP_ARGS_VALUES,
  createCommand,
  hasAnyArg,
  ALL_COMMANDS,
} from "$cli";
import { styleText } from "node:util";

const showVersion = (): void => {
  console.log(`${APP_NAME} ${APP_VERSION}`);
  process.exit(0);
};

const main = async (): Promise<void> => {
  const [, , firstArgument, ...otherArgs] = process.argv;

  if (hasAnyArg(VERSION_ARGS_VALUES)) {
    showVersion();
    return;
  }

  if (HELP_ARGS_VALUES.includes(firstArgument)) {
    const cli = new Cli(false);
    cli.usage();
    return;
  }

  if (HELP_ARGS_VALUES.some((item) => otherArgs.includes(item))) {
    const createCLI = () => {
      if (ALL_COMMANDS.some((cmdClass) => cmdClass.COMMAND === firstArgument)) {
        return createCommand(firstArgument, false);
      }
      console.error(styleText("red", "Unknown command: "), firstArgument, "\n");
      return new Cli(true);
    };
    const cli = createCLI();

    cli.usage();

    return;
  }

  const cliInstance = createCommand(firstArgument);
  await cliInstance.entrypoint();
};

const printErrorAndQuit = (message: string, err?: Error): void => {
  console.error(err ? `${message} ${err}` : message);
  process.exit(1);
};

const mainWithErrorHandling = async (): Promise<void> => {
  process.on("uncaughtException", (error) => {
    printErrorAndQuit("Uncaught Exception:", error);
  });

  process.on("unhandledRejection", (reason: Error) => {
    printErrorAndQuit("Unhandled promise rejection:", reason);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      printErrorAndQuit(`\nReceived ${signal}. Stopping...`);
    });
  }
  try {
    await main();
  } catch {}
};

try {
  await mainWithErrorHandling();
} catch {
  process.exit(1);
}
