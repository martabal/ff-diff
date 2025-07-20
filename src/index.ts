#!/usr/bin/env node
import { Cli, HELP_ARGS, VERSION_ARGS, createCommand } from "./cli";

const hasAnyArg = (args: readonly string[]): boolean => {
  return process.argv.some((arg) => args.includes(arg));
};

const showVersion = (): void => {
  console.log(`${APP_NAME} ${APP_VERSION}`);
  process.exit(0);
};

const main = async (): Promise<void> => {
  const [, , firstArgument, secondArgument] = process.argv;

  if (hasAnyArg(VERSION_ARGS)) {
    showVersion();
    return;
  }

  if (HELP_ARGS.includes(firstArgument)) {
    const cli = new Cli(false);
    cli.usage();
    return;
  }

  if (HELP_ARGS.includes(secondArgument)) {
    const cli = createCommand(firstArgument, false);
    cli.usage();
    return;
  }

  const cliInstance = createCommand(firstArgument);
  await cliInstance.entrypoint();
};

const mainWithErrorHandling = async (): Promise<void> => {
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
    process.exit(1);
  });

  ["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}. Shutting down...`);
      process.exit(0);
    });
  });

  await main();
};

mainWithErrorHandling().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});
