import { clean } from "$commands/clean";
import { getDefaultPrefs } from "$commands/default-prefs";
import { defaultPrefsUserJS } from "$commands/default-prefs-userjs";
import { diff } from "$commands/diff";
import { unusedPrefs } from "$commands/unused-prefs";
import { getArgumentValue, parseKeepArgument } from "$lib/cli";
import { getFirefoxReleaseProfilePath } from "$lib/firefox";
import { startsWithNumberDotNumber } from "$lib/helpers";
import { styleText } from "node:util";

interface SourceCleanupOptions {
  archives: boolean;
  sources: boolean;
}

interface OutputOptions {
  doNotPrintConsole: boolean;
  saveOutput: boolean;
}

export const VERSION_ARGS = {
  shortOption: "-v",
  longOption: "--version",
  doc: "Print version info and exit",
};
export const VERSION_ARGS_VALUES = Object.values(VERSION_ARGS);
export const HELP_ARGS = {
  shortOption: "-h",
  longOption: "--help",
  doc: "Print help",
};
export const HELP_ARGS_VALUES = Object.values(HELP_ARGS);

export const CLI_ARGS = {
  CLEAN_ARCHIVES: "--clean-archives",
  CLEAN_SOURCES: "--clean-sources",
  COMPARE_USERJS: "--compare-userjs",
  DO_NOT_PRINT_IN_CONSOLE: "--do-not-print-in-console",
  FIREFOX_PATH: "--firefox-path",
  FIREFOX_VERSION: "--firefox-version",
  FORCE_DEFAULT_PROFILE: "--force-default-profile",
  HIDE_COMMON_CHANGED_VALUES: "--hide-common-changed-values",
  KEEP: "--keep",
  KEEP_ARCHIVES: "--keep-archives",
  KEEP_SOURCES: "--keep-sources",
  SAVE_OUTPUT: "--save-output-in-file",
  PATH: "--path",
  PROFILE_PATH: "--profile-path",
} as const;

const EXAMPLE_VERSION = {
  NEW_VERSION: "140",
  OLD_VERSION: "139",
} as const;

const CLI_VALUES = {
  PATH_USAGE: "path",

  VERSION: "version",

  VERSION1: "version1",
  VERSION2: "version2",

  OLD_VERSION: "old-version",
  NEW_VERSION: "new-version",
} as const;

const pathUsageUserJS: CliCommand = {
  values: [CLI_VALUES.PATH_USAGE],
  doc: "Path to your user.js file",
};

const printAndSave: CliOption[] = [
  {
    longOption: CLI_ARGS.DO_NOT_PRINT_IN_CONSOLE,
    doc: "Do not output in the console",
  },
  {
    longOption: CLI_ARGS.SAVE_OUTPUT,
    doc: "Save output to a file",
  },
];

const pathToFirefox: CliOption = {
  longOption: `${CLI_ARGS.FIREFOX_PATH} ${CLI_VALUES.PATH_USAGE}`,
  doc: "Path to the firefox binary",
};

const forceDefaultFFProfile: CliOption = {
  longOption: CLI_ARGS.FORCE_DEFAULT_PROFILE,
  doc: "Explicitly force firefox to use the default profile",
};

const FFProfilePath: CliOption = {
  longOption: CLI_ARGS.PROFILE_PATH,
  doc: `Set the profile path to use (conflicts with ${CLI_ARGS.FORCE_DEFAULT_PROFILE})`,
};

const FFVersion: CliOption = {
  longOption: `${CLI_ARGS.FIREFOX_VERSION} ${CLI_VALUES.VERSION}`,
  doc: `Use a specific firefox version`,
};

const exitWithError = (firstArg: string, secondArg: string) => {
  console.error(
    `You can't have ${firstArg} and ${secondArg} set at the same time`,
  );
  process.exit(1);
};

const getUserJSBasedCommands = () => {
  const forceDefaultProfile = process.argv.includes(
    CLI_ARGS.FORCE_DEFAULT_PROFILE,
  );

  const profilePath = getArgumentValue(CLI_ARGS.PROFILE_PATH);
  if (profilePath && forceDefaultFFProfile) {
    exitWithError(CLI_ARGS.FORCE_DEFAULT_PROFILE, CLI_ARGS.PROFILE_PATH);
  }

  const firefoxVersion = getArgumentValue(FFVersion.longOption);
  if (profilePath && forceDefaultFFProfile) {
    exitWithError(CLI_ARGS.FIREFOX_VERSION, CLI_ARGS.PROFILE_PATH);
  }

  return { profilePath, forceDefaultProfile, firefoxVersion };
};

export const hasAnyArg = (args: readonly string[]): boolean => {
  return process.argv.some((arg) => args.includes(arg));
};

const createPrintOptions = (): OutputOptions => ({
  doNotPrintConsole: process.argv.includes(CLI_ARGS.DO_NOT_PRINT_IN_CONSOLE),
  saveOutput: process.argv.includes(CLI_ARGS.SAVE_OUTPUT),
});

const createCleanOptions = (): SourceCleanupOptions => ({
  archives: process.argv.includes(CLI_ARGS.CLEAN_ARCHIVES),
  sources: process.argv.includes(CLI_ARGS.CLEAN_SOURCES),
});

const createKeepOptions = (): SourceCleanupOptions => ({
  archives: process.argv.includes(CLI_ARGS.KEEP_ARCHIVES),
  sources: process.argv.includes(CLI_ARGS.KEEP_SOURCES),
});

export const cleanOptions: SourceCleanupOptions = createCleanOptions();
export const keepOptions: SourceCleanupOptions = createKeepOptions();
export const printOptions: OutputOptions = createPrintOptions();

interface CliDoc {
  readonly doc: string;
  readonly smallDoc?: string;
}

interface CliCommand extends CliDoc {
  readonly values: readonly string[];
}

interface CliOption extends CliDoc {
  readonly longOption: string;
  readonly shortOption?: string;
}

abstract class BaseCli {
  public readonly command?: string;
  public readonly description: string;
  public readonly commands: readonly CliCommand[];
  public readonly options: readonly CliOption[];
  protected fail: boolean;

  constructor(
    fail: boolean = true,
    description: string,
    commands: readonly CliCommand[] = [],
    options: readonly CliOption[] = [],
  ) {
    this.description = description;
    this.fail = fail;
    this.commands = commands;
    this.options = options;
  }

  public abstract entrypoint(): Promise<void> | void;

  public usage(): void {
    const maxCmdLen =
      this.commands.length > 0
        ? Math.max(...this.commands.map((cmd) => cmd.values.join(" ").length))
        : 0;

    const maxOptLen =
      this.options.length > 0
        ? Math.max(
            ...this.options.map(
              (opt) => opt.longOption.length + (opt.shortOption?.length ?? 0),
            ),
          )
        : 0;

    const maxLen = Math.max(maxCmdLen, maxOptLen) + 10;

    (this.fail ? console.error : console.log)(this.description);

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
    items: readonly CliOption[] | readonly CliCommand[],
    maxLen: number,
    separator: string,
  ): void {
    const output = this.fail ? console.error : console.log;

    output(`\n${styleText("green", title)}`);

    for (const item of items) {
      const isOption = (item as CliOption).longOption !== undefined;

      const args = isOption
        ? (item as CliOption).longOption
        : (item as CliCommand).values.join(separator);

      const coloredArgs = isOption
        ? styleText("cyan", args)
        : (item as CliCommand).values
            .map((value) => styleText("cyan", value))
            .join(separator);

      const helpText = isOption
        ? (item as CliOption).doc
        : (item as CliCommand).doc;

      const helpLines = helpText.split("\n");
      const padding = " ".repeat(Math.max(0, maxLen - args.length + 4));

      output(`  ${coloredArgs}${padding}${helpLines[0]}`);

      for (let i = 1; i < helpLines.length; i++) {
        output(" ".repeat(maxLen + 6) + helpLines[i]);
      }
    }
  }
}

class CleanCommand extends BaseCli {
  public static readonly COMMAND = "clean";
  public static readonly SMALL_DESCRIPTION = undefined;
  public static readonly DESCRIPTION = `Remove files generated by ${APP_NAME}`;
  public static readonly COMMANDS: readonly CliCommand[] = [];
  public static readonly OPTIONS: readonly CliOption[] = [
    {
      longOption: `${CLI_ARGS.KEEP} ${CLI_VALUES.VERSION1},${CLI_VALUES.VERSION2}`,
      doc: [
        "Specify one or more versions whose archives and binaries should be preserved during cleanup",
        "Provide a comma-separated list of versions to keep",
        `   Example: ${CLI_ARGS.KEEP} ${EXAMPLE_VERSION.OLD_VERSION},${EXAMPLE_VERSION.NEW_VERSION}`,
      ].join("\n"),
      smallDoc: "Version to keep",
    },
    {
      longOption: CLI_ARGS.KEEP_ARCHIVES,
      doc: "Keep all archives",
    },
    {
      longOption: CLI_ARGS.KEEP_SOURCES,
      doc: "Keep all binaries",
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
    const keptVersions = parseKeepArgument();
    await clean(keptVersions);
  }
}

class DefaultPrefsUserJSCommand extends BaseCli {
  public static readonly COMMAND = "default-prefs-userjs";
  public static readonly SMALL_DESCRIPTION = undefined;
  public static readonly DESCRIPTION =
    "Identify default preferences from your user.js file";
  public static readonly COMMANDS: readonly CliCommand[] = [pathUsageUserJS];
  public static readonly OPTIONS: readonly CliOption[] = [
    pathToFirefox,
    ...printAndSave,
    forceDefaultFFProfile,
    FFProfilePath,
    FFVersion,
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
    const [, , , compareUserjs] = process.argv;
    const userjsBasedCommands = getUserJSBasedCommands();

    if (compareUserjs === undefined) {
      this.usage();
    }
    await defaultPrefsUserJS({
      compareUserjs,
      ...userjsBasedCommands,
    });
  }
}

class DefaultPrefsCommand extends BaseCli {
  public static readonly COMMAND = "default-prefs";
  public static readonly SMALL_DESCRIPTION = undefined;
  public static readonly DESCRIPTION = `Get a list of all default prefs`;
  public static readonly COMMANDS: readonly CliCommand[] = [];
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
    const install = getFirefoxReleaseProfilePath();
    if (install === null) {
      this.usage();
      return;
    }
    await getDefaultPrefs(install.profilePath);
  }
}

export interface Diff {
  compareUserJS?: string;
  hideCommonChangedValues: boolean;
  oldVersion: string;
  newVersion: string;
}

class DiffCommand extends BaseCli {
  public static readonly COMMAND = "diff";
  public static readonly SMALL_DESCRIPTION =
    "Compare the default preferences of two firefox versions";
  public static readonly DESCRIPTION =
    DiffCommand.SMALL_DESCRIPTION + " and highlight differences";

  public static readonly COMMANDS: readonly CliCommand[] = [
    {
      values: [`<${CLI_VALUES.OLD_VERSION}> <${CLI_VALUES.NEW_VERSION}>`],
      doc: [
        "First arg is the old version, second arg is the new version",
        `  Example: diff ${EXAMPLE_VERSION.OLD_VERSION} ${EXAMPLE_VERSION.NEW_VERSION}`,
      ].join("\n"),
    },
  ];

  public static readonly OPTIONS: readonly CliOption[] = [
    {
      longOption: CLI_ARGS.CLEAN_ARCHIVES,
      doc: "Remove archives after retrieving preferences",
    },
    {
      longOption: CLI_ARGS.CLEAN_SOURCES,
      doc: "Remove binaries after retrieving preferences",
    },
    ...printAndSave,
    {
      longOption: `${CLI_ARGS.COMPARE_USERJS} ${CLI_VALUES.PATH_USAGE}`,
      doc: "Check for removed or changed keys in the specified user.js file",
    },
    {
      longOption: CLI_ARGS.HIDE_COMMON_CHANGED_VALUES,
      doc: "Hide the common changed values",
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
    const [, , , oldVersion, newVersion] = process.argv;

    if (
      !oldVersion ||
      !newVersion ||
      !startsWithNumberDotNumber(oldVersion) ||
      !startsWithNumberDotNumber(newVersion)
    ) {
      this.usage();
    }

    const compareUserJS = getArgumentValue(CLI_ARGS.COMPARE_USERJS);
    const hideCommonChangedValues = process.argv.includes(
      CLI_ARGS.HIDE_COMMON_CHANGED_VALUES,
    );
    await diff({
      compareUserJS,
      oldVersion,
      newVersion,
      hideCommonChangedValues,
    });
  }
}

class UnusedPrefCommand extends BaseCli {
  public static readonly COMMAND = "unused-prefs-userjs";
  public static readonly SMALL_DESCRIPTION = undefined;
  public static readonly DESCRIPTION =
    "Identify unused preferences from your user.js file";
  public static readonly COMMANDS: readonly CliCommand[] = [pathUsageUserJS];
  public static readonly OPTIONS: readonly CliOption[] = [
    pathToFirefox,
    forceDefaultFFProfile,
    FFProfilePath,
    FFVersion,
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
    const [, , , compareUserjs] = process.argv;
    const userjsBasedCommands = getUserJSBasedCommands();

    if (compareUserjs === undefined) {
      this.usage();
    }
    await unusedPrefs({ compareUserjs, ...userjsBasedCommands });
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
  public static readonly COMMANDS: readonly CliCommand[] = ALL_COMMANDS.map(
    (cmd) => ({
      values: [cmd.COMMAND],
      doc: cmd.DESCRIPTION,
      smallDoc: cmd.SMALL_DESCRIPTION,
    }),
  );

  public static readonly OPTIONS: readonly CliOption[] = [
    VERSION_ARGS,
    HELP_ARGS,
  ];

  constructor(fail = true) {
    super(fail, APP_DESCRIPTION, Cli.COMMANDS, Cli.OPTIONS);
  }

  public entrypoint(): void {
    this.fail = true;
    this.usage();
  }
}

export const createCommand = (command: string, fail = true): BaseCli => {
  const commands = Object.fromEntries(
    ALL_COMMANDS.map((cmd) => [cmd.COMMAND, (fail = true) => new cmd(fail)]),
  );
  return commands[command]?.(fail) ?? new Cli(fail);
};
