// oxlint-disable max-lines
import { clean } from "./clean";
import { getDefaultPrefs } from "./default-prefs";
import { defaultPrefsUserJS } from "./default-prefs-userjs";
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

export interface OutputOptions {
  doNotPrintConsole: boolean;
  saveOutput: boolean;
}

export const VERSION_ARGS = ["-v", "--version"];
export const HELP_ARGS = ["-h", "--help"];

export const CLI_ARGS = {
  CLEAN_ARCHIVES: "--clean-archives",
  CLEAN_SOURCES: "--clean-sources",
  COMPARE_USERJS: "--compare-userjs",
  DO_NOT_PRINT_IN_CONSOLE: "--do-not-print-in-console",
  FIREFOX_PATH: "--firefox-path",
  KEEP: "--keep",
  KEEP_ARCHIVES: "--keep-archives",
  KEEP_SOURCES: "--keep-sources",
  SAVE_OUTPUT: "--save-output-in-file",
  PATH: "--path",
} as const;

const EXAMPLE_VERSION = {
  NEW_VERSION: "140",
  OLD_VERSION: "139",
} as const;

const CLI_VALUES = {
  PATH_USAGE: "path",

  VERSION1: "version1",
  VERSION2: "version2",

  OLD_VERSION: "old-version",
  NEW_VERSION: "new-version",
} as const;

const printAndSave = [
  {
    arguments: [CLI_ARGS.DO_NOT_PRINT_IN_CONSOLE],
    help: "Do not output in the console",
  },
  {
    arguments: [CLI_ARGS.SAVE_OUTPUT],
    help: "Save output to a file",
  },
];

const pathToFirefox = {
  arguments: [`${CLI_ARGS.FIREFOX_PATH} ${CLI_VALUES.PATH_USAGE}`],
  help: "Path to the firefox binary",
};
const createCleanOptions = (): SourceCleanupOptions => ({
  archives: process.argv.includes(CLI_ARGS.CLEAN_ARCHIVES),
  sources: process.argv.includes(CLI_ARGS.CLEAN_SOURCES),
});

const createKeepOptions = (): SourceCleanupOptions => ({
  archives: process.argv.includes(CLI_ARGS.KEEP_ARCHIVES),
  sources: process.argv.includes(CLI_ARGS.KEEP_SOURCES),
});

export const hasAnyArg = (args: readonly string[]): boolean => {
  return process.argv.some((arg) => args.includes(arg));
};

export const createPrintOptions = (): OutputOptions => ({
  doNotPrintConsole: process.argv.includes(CLI_ARGS.DO_NOT_PRINT_IN_CONSOLE),
  saveOutput: process.argv.includes(CLI_ARGS.SAVE_OUTPUT),
});

export const cleanOptions: SourceCleanupOptions = createCleanOptions();
export const keepOptions: SourceCleanupOptions = createKeepOptions();
export const printOptions: OutputOptions = createPrintOptions();

interface CliOption {
  readonly arguments: readonly string[];
  readonly help: string;
}

export abstract class BaseCli {
  public readonly command?: string;
  public readonly description: string;
  public readonly commands: readonly CliOption[];
  public readonly options: readonly CliOption[];
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

export class DiffCommand extends BaseCli {
  public static readonly COMMAND = "diff";
  public static readonly DESCRIPTION =
    "Compare the default preferences of two firefox versions and highlight differences";

  public static readonly COMMANDS: readonly CliOption[] = [
    {
      arguments: [`<${CLI_VALUES.OLD_VERSION}> <${CLI_VALUES.NEW_VERSION}>`],

      help: [
        "First arg is the old version, second arg is the new version",
        `  Example: diff ${EXAMPLE_VERSION.OLD_VERSION} ${EXAMPLE_VERSION.NEW_VERSION}`,
      ].join("\n"),
    },
  ];

  public static readonly OPTIONS: readonly CliOption[] = [
    {
      arguments: [CLI_ARGS.CLEAN_ARCHIVES],
      help: "Remove archives after retrieving preferences",
    },
    {
      arguments: [CLI_ARGS.CLEAN_SOURCES],
      help: "Remove binaries after retrieving preferences",
    },
    ...printAndSave,
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
  public static readonly COMMAND = "unused-prefs-userjs";
  public static readonly DESCRIPTION =
    "Identify unused preferences from your user.js file";
  public static readonly COMMANDS: readonly CliOption[] = [
    {
      arguments: [CLI_VALUES.PATH_USAGE],
      help: "Path to your user.js file",
    },
  ];
  public static readonly OPTIONS: readonly CliOption[] = [pathToFirefox];

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
  public static readonly COMMANDS: readonly CliOption[] = [];
  public static readonly OPTIONS: readonly CliOption[] = [
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
    {
      arguments: [CLI_ARGS.KEEP_ARCHIVES],
      help: "Keep all archives",
    },
    {
      arguments: [CLI_ARGS.KEEP_SOURCES],
      help: "Keep all binaries",
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

export class DefaultPrefsCommand extends BaseCli {
  public static readonly COMMAND = "default-prefs";
  public static readonly DESCRIPTION = `Get a list of all default prefs`;
  public static readonly COMMANDS: readonly CliOption[] = [];
  public static readonly OPTIONS: readonly CliOption[] = [
    ...printAndSave,
    pathToFirefox,
  ];

  constructor(fail: boolean = true) {
    super(
      fail,
      DefaultPrefsCommand.DESCRIPTION,
      DefaultPrefsCommand.COMMANDS,
      DefaultPrefsCommand.OPTIONS,
    );
  }

  public async entrypoint(): Promise<void> {
    await getDefaultPrefs();
  }
}

export class DefaultPrefsUserJSCommand extends BaseCli {
  public static readonly COMMAND = "default-prefs-userjs";
  public static readonly DESCRIPTION =
    "Identify default preferences from your user.js file";
  public static readonly COMMANDS: readonly CliOption[] = [
    {
      arguments: [CLI_VALUES.PATH_USAGE],
      help: "Path to your user.js file",
    },
  ];
  public static readonly OPTIONS: readonly CliOption[] = [
    pathToFirefox,
    ...printAndSave,
  ];

  constructor(fail: boolean = true) {
    super(
      fail,
      DefaultPrefsUserJSCommand.DESCRIPTION,
      DefaultPrefsUserJSCommand.COMMANDS,
      DefaultPrefsUserJSCommand.OPTIONS,
    );
  }

  public async entrypoint(): Promise<void> {
    await defaultPrefsUserJS();
  }
}

export const ALL_COMMANDS = [
  CleanCommand,
  DiffCommand,
  DefaultPrefsCommand,
  UnusedPrefCommand,
  DefaultPrefsUserJSCommand,
];
export class Cli extends BaseCli {
  public static readonly COMMANDS: readonly CliOption[] = ALL_COMMANDS.map(
    (cmd) => ({
      arguments: [cmd.COMMAND],
      help: cmd.DESCRIPTION,
    }),
  );

  public static readonly OPTIONS: readonly CliOption[] = [
    { arguments: VERSION_ARGS, help: "Print version info and exit" },
    { arguments: HELP_ARGS, help: "Print help" },
  ];

  constructor(fail = true) {
    super(fail, APP_DESCRIPTION, Cli.COMMANDS, Cli.OPTIONS);
  }

  public async entrypoint(): Promise<void> {
    this.fail = true;
    await this.usage();
  }
}

export const createCommand = (command: string, fail = true): BaseCli => {
  const commands = Object.fromEntries(
    ALL_COMMANDS.map((cmd) => [cmd.COMMAND, (fail = true) => new cmd(fail)]),
  );
  return commands[command]?.(fail) ?? new Cli(fail);
};
