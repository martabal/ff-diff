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
  try {
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
    await cliInstance.run();
  } catch (error) {
    console.error(
      "Fatal error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
};

const mainWithErrorHandling = async (): Promise<void> => {
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  });

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT. Gracefully shutting down...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM. Gracefully shutting down...");
    process.exit(0);
  });

  await main();
};

mainWithErrorHandling().catch((error) => {
  console.error("Application failed to start:", error);
  process.exit(1);
});
