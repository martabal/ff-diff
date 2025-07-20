// oxlint-disable max-lines
import { clean } from "./clean";
import { diff } from "./diff";
import { unusedPrefs } from "./unused-prefs";

const CONSOLE_COLORS = {
  GREEN: "\u001B[32m",
  RESET: "\u001B[0m",
  CYAN: "\u001B[36m",
} as const;

interface SourceCleanupOptions {
  archives: boolean;
  sources: boolean;
}

interface OutputOptions {
  doNotPrintConsole: boolean;
  saveDiffsInFile: boolean;
}

export const VERSION_ARGS = ["-v", "--version"];
export const HELP_ARGS = ["-h", "--help"];

export const CLI_ARGS = {
  COMPARE_USERJS: "--compare-userjs",
  KEEP: "--keep",
  FIREFOX_PATH: "--firefox-path",
  KEEP_ARCHIVES: "--keep-archives",
  KEEP_SOURCES: "--keep-sources",
  CLEAN_SOURCES: "--clean-sources",
  CLEAN_ARCHIVES: "--clean-archives",
  SAVE_DIFFS: "--save-diffs-in-file",
  DO_NOT_PRINT_IN_CONSOLE: "--do-not-print-diffs-in-console",
} as const;

const EXAMPLE_VERSION = {
  OLD_VERSION: "139",
  NEW_VERSION: "140",
} as const;

const CLI_VALUES = {
  PATH_USAGE: "path",
  VERSION1: "version1",
  VERSION2: "version2",
  OLD_VERSION: "<old-version>",
  NEW_VERSION: "<new-version>",
} as const;

const createCleanOptions = (): SourceCleanupOptions => ({
  archives: process.argv.includes(CLI_ARGS.CLEAN_ARCHIVES),
  sources: process.argv.includes(CLI_ARGS.CLEAN_SOURCES),
});

const createKeepOptions = (): SourceCleanupOptions => ({
  archives: process.argv.includes(CLI_ARGS.KEEP_ARCHIVES),
  sources: process.argv.includes(CLI_ARGS.KEEP_SOURCES),
});

const createPrintOptions = (): OutputOptions => ({
  doNotPrintConsole: process.argv.includes(CLI_ARGS.DO_NOT_PRINT_IN_CONSOLE),
  saveDiffsInFile: process.argv.includes(CLI_ARGS.SAVE_DIFFS),
});

export const cleanOptions: SourceCleanupOptions = createCleanOptions();
export const keepOptions: SourceCleanupOptions = createKeepOptions();
export const printOptions: OutputOptions = createPrintOptions();

interface CliOption {
  readonly arguments: readonly string[];
  readonly help: string;
}

export abstract class BaseCli {
  protected readonly command?: string;
  protected readonly description: string;
  protected readonly commands: readonly CliOption[];
  protected readonly options: readonly CliOption[];
  protected fail: boolean;

  constructor(
    fail: boolean = true,
    description: string,
    commands: readonly CliOption[] = [],
    options: readonly CliOption[] = [],
  ) {
    this.description = description;
    this.fail = fail;
    this.commands = commands;
    this.options = options;
  }

  public abstract entrypoint(): Promise<void>;

  public usage(): void {
    const maxCmdLen =
      this.commands.length > 0
        ? Math.max(
            ...this.commands.map((cmd) => cmd.arguments.join(" ").length),
          )
        : 0;

    const maxOptLen =
      this.options.length > 0
        ? Math.max(
            ...this.options.map((opt) => opt.arguments.join(", ").length),
          )
        : 0;

    const maxLen = Math.max(maxCmdLen, maxOptLen) + 10;

    console.log(this.description);

    if (this.commands.length > 0) {
      this.printSection("Usage:", this.commands, maxLen, " ");
    }

    if (this.options.length > 0) {
      this.printSection("Options:", this.options, maxLen, ", ");
    }

    if (this.fail) {
      process.exit(1);
    }
  }

  private printSection(
    title: string,
    items: readonly CliOption[],
    maxLen: number,
    separator: string,
  ): void {
    console.log(`\n${CONSOLE_COLORS.GREEN}${title}${CONSOLE_COLORS.RESET}`);

    for (const item of items) {
      const args = item.arguments.join(separator);
      const coloredArgs =
        separator === ", "
          ? item.arguments
              .map(
                (arg) => `${CONSOLE_COLORS.CYAN}${arg}${CONSOLE_COLORS.RESET}`,
              )
              .join(", ")
          : `${CONSOLE_COLORS.CYAN}${args}${CONSOLE_COLORS.RESET}`;

      const helpLines = item.help.split("\n");
      const padding = " ".repeat(Math.max(0, maxLen - args.length + 4));

      console.log(`  ${coloredArgs}${padding}${helpLines[0]}`);

      for (let i = 1; i < helpLines.length; i++) {
        console.log(" ".repeat(maxLen + 6) + helpLines[i]);
      }
    }
  }
}

export class Cli extends BaseCli {
  constructor(fail = true) {
    super(
      fail,
      APP_DESCRIPTION,
      COMMANDS.map((cmd) => ({
        arguments: [cmd.COMMAND],
        help: cmd.DESCRIPTION,
      })),
      [
        { arguments: VERSION_ARGS, help: "Print version info and exit" },
        { arguments: HELP_ARGS, help: "Print help" },
      ],
    );
  }

  public async entrypoint(): Promise<void> {
    this.fail = true;
    await this.usage();
  }
}

export class DiffCommand extends BaseCli {
  public static readonly COMMAND = "diff";
  public static readonly DESCRIPTION =
    "Compare the default preferences of two firefox versions and highlight differences";

  private static readonly COMMANDS: readonly CliOption[] = [
    {
      arguments: [`${CLI_VALUES.OLD_VERSION} ${CLI_VALUES.NEW_VERSION}`],

      help: [
        "First arg is the old version, second arg is the new version",
        `  Example: diff ${EXAMPLE_VERSION.OLD_VERSION} ${EXAMPLE_VERSION.NEW_VERSION}`,
      ].join("\n"),
    },
  ];

  private static readonly OPTIONS: readonly CliOption[] = [
    {
      arguments: [CLI_ARGS.CLEAN_ARCHIVES],
      help: "Remove archives after retrieving preferences",
    },
    {
      arguments: [CLI_ARGS.CLEAN_SOURCES],
      help: "Remove binaries after retrieving preferences",
    },
    {
      arguments: [CLI_ARGS.DO_NOT_PRINT_IN_CONSOLE],
      help: "Suppress diff output in the console",
    },
    {
      arguments: [CLI_ARGS.SAVE_DIFFS],
      help: "Save diffs to a Markdown file",
    },
    {
      arguments: [`${CLI_ARGS.COMPARE_USERJS} ${CLI_VALUES.PATH_USAGE}`],
      help: "Check for removed or changed keys in the specified user.js file",
    },
  ];

  constructor(fail: boolean = true) {
    super(
      fail,
      DiffCommand.DESCRIPTION,
      DiffCommand.COMMANDS,
      DiffCommand.OPTIONS,
    );
  }

  public async entrypoint(): Promise<void> {
    await diff();
  }
}

export class UnusedPrefCommand extends BaseCli {
  public static readonly COMMAND = "unused-prefs";
  public static readonly DESCRIPTION =
    "Identify unused preferences from your user.js file";
  private static readonly COMMANDS: readonly CliOption[] = [
    {
      arguments: [CLI_VALUES.PATH_USAGE],
      help: "Path to your user.js file",
    },
  ];
  private static readonly OPTIONS: readonly CliOption[] = [
    {
      arguments: [`${CLI_ARGS.FIREFOX_PATH} ${CLI_VALUES.PATH_USAGE}`],
      help: "Path to the firefox binary",
    },
  ];

  constructor(fail: boolean = true) {
    super(
      fail,
      UnusedPrefCommand.DESCRIPTION,
      UnusedPrefCommand.COMMANDS,
      UnusedPrefCommand.OPTIONS,
    );
  }

  public async entrypoint(): Promise<void> {
    await unusedPrefs();
  }
}

export class CleanCommand extends BaseCli {
  public static readonly COMMAND = "clean";
  public static readonly DESCRIPTION = `Remove files generated by ${APP_NAME}`;
  private static readonly COMMANDS: readonly CliOption[] = [];
  private static readonly OPTIONS: readonly CliOption[] = [
    {
      arguments: [
        `${CLI_ARGS.KEEP} ${CLI_VALUES.VERSION1},${CLI_VALUES.VERSION2}`,
      ],
      help: [
        "Specify one or more versions whose archives and binaries should be preserved during cleanup",
        "Provide a comma-separated list of versions to keep",
        `   Example: ${CLI_ARGS.KEEP} ${EXAMPLE_VERSION.OLD_VERSION},${EXAMPLE_VERSION.NEW_VERSION}`,
      ].join("\n"),
    },
  ];

  constructor(fail: boolean = true) {
    super(
      fail,
      CleanCommand.DESCRIPTION,
      CleanCommand.COMMANDS,
      CleanCommand.OPTIONS,
    );
  }

  public async entrypoint(): Promise<void> {
    await clean();
  }
}

const COMMANDS = [CleanCommand, DiffCommand, UnusedPrefCommand];

export const createCommand = (command: string, fail = true): BaseCli => {
  const commands = Object.fromEntries(
    COMMANDS.map((cmd) => [cmd.COMMAND, (fail = true) => new cmd(fail)]),
  );
  return commands[command]?.(fail) ?? new Cli(fail);
};
