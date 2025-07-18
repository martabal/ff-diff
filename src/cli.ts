import { clean } from "./clean";
import { diff } from "./diff";
import { unusedPrefs } from "./unused-prefs";

enum ConsoleColors {
  Green = "\x1b[32m",
  Reset = "\x1b[0m",
  Cyan = "\x1b[36m",
}

type SourcesOptions = {
  archives: boolean;
  sources: boolean;
};

type PrintOptions = {
  doNotPrintConsole: boolean;
  saveDiffsInFile: boolean;
};

export const versionArgs = ["-v", "--version"];
export const helpArgs = ["-h", "--help"];

export enum CliCommand {
  cleanArg = "clean",
  diffArg = "diff",
  unusedPrefsArg = "unused-prefs",
}

export enum CliArg {
  compareUserjs = "--compare-userjs",
  keep = "--keep",
  firefoxPath = "--firefox-path",
  keepArchives = "--keep-archives",
  keepSources = "--keep-sources",
  cleanSources = "--clean-sources",
  cleanArchives = "--clean-archives",
  saveDiffs = "--save-diffs-in-file",
  doNotPrintInConsole = "--do-not-print-diffs-in-console",
}

enum CliValue {
  pathUsage = "path",
  version1 = "version1",
  version2 = "version2",
  oldVersion = "<old-version>",
  newVersion = "<new-version>",
}

export const cleanOptions: SourcesOptions = {
  archives: process.argv.includes(CliArg.cleanArchives),
  sources: process.argv.includes(CliArg.cleanSources),
};

export const keepOptions: SourcesOptions = {
  archives: process.argv.includes(CliArg.keepArchives),
  sources: process.argv.includes(CliArg.keepSources),
};

export const printOptions: PrintOptions = {
  doNotPrintConsole: process.argv.includes(CliArg.doNotPrintInConsole),
  saveDiffsInFile: process.argv.includes(CliArg.saveDiffs),
};

type Option = {
  arguments: string[];
  help: string;
};

export class Cli {
  description: string;
  commands: Option[];
  options: Option[];
  fail: boolean;

  constructor(
    fail?: boolean,
    description?: string,
    commands?: Option[],
    options?: Option[],
  ) {
    this.description = description ?? APP_DESCRIPTION;
    this.fail = fail ?? true;
    this.commands = commands ?? [
      {
        arguments: [CliCommand.cleanArg],
        help: Clean.description,
      },
      {
        arguments: [CliCommand.diffArg],
        help: Diff.description,
      },
      {
        arguments: [CliCommand.unusedPrefsArg],
        help: UnusedPref.description,
      },
    ];
    this.options = options ?? [
      {
        arguments: versionArgs,
        help: "Print version info and exit",
      },
      {
        arguments: helpArgs,
        help: "Print help",
      },
    ];
  }
  async entrypoint() {
    this.fail = true;
    this.usage();
  }
  usage(fail?: boolean): void {
    if (fail !== undefined) {
      this.fail = fail;
    }

    const maxCmdLen = Math.max(
      ...this.commands.map((cmd) => cmd.arguments.join(" ").length),
    );
    const maxOptLen =
      this.options.length > 0
        ? Math.max(
            ...this.options.map((opt) => opt.arguments.join(", ").length),
          )
        : 0;
    const maxLen = Math.max(maxCmdLen, maxOptLen) + 10;

    console.log(`${this.description}`);
    if (this.commands.length > 0) {
      console.log(`\n${ConsoleColors.Green}Usage:${ConsoleColors.Reset}`);
      this.commands.forEach((cmd) => {
        const args = cmd.arguments.join(" ");
        const helpLines = cmd.help.split("\n");
        console.log(
          `  ${ConsoleColors.Cyan}${args.padEnd(maxLen)}${ConsoleColors.Reset}  ${helpLines[0]}`,
        );
        for (let i = 1; i < helpLines.length; i++) {
          console.log(" ".repeat(maxLen + 4) + helpLines[i]);
        }
      });
    }

    if (this.options.length > 0) {
      console.log(`\n${ConsoleColors.Green}Options:${ConsoleColors.Reset}`);
      this.options.forEach((opt) => {
        const coloredArgs = opt.arguments
          .map((arg) => `${ConsoleColors.Cyan}${arg}${ConsoleColors.Reset}`)
          .join(", ");
        const plainArgs = opt.arguments.join(", ");
        const helpLines = opt.help.split("\n");
        console.log(
          `  ${coloredArgs}${" ".repeat(maxLen - plainArgs.length)}  ${helpLines[0]}`,
        );
        for (let i = 1; i < helpLines.length; i++) {
          console.log(" ".repeat(maxLen + 4) + helpLines[i]);
        }
      });
      process.exit(+this.fail);
    }
  }
}

export class Diff extends Cli {
  static description = "Perform a comparison between preference files";
  static commands?: Option[] = [
    {
      arguments: [`${CliValue.oldVersion} ${CliValue.newVersion}`],
      help: "First arg is the old version, second arg is the new version",
    },
  ];
  static options?: Option[] = [
    {
      arguments: [`${CliArg.cleanArchives}`],
      help: "Remove archives after retrieving preferences",
    },
    {
      arguments: [`${CliArg.cleanSources}`],
      help: "Remove binaries after retrieving preferences",
    },
    {
      arguments: [`${CliArg.doNotPrintInConsole}`],
      help: "Suppress diff output in the console",
    },
    {
      arguments: [`${CliArg.saveDiffs}`],
      help: "Save diffs to a Markdown file",
    },
    {
      arguments: [`${CliArg.compareUserjs} ${CliValue.pathUsage}`],
      help: "Check for removed or changed keys in the specified user.js file",
    },
  ];

  constructor(fail?: boolean) {
    super(fail, Diff.description, Diff.commands, Diff.options);
  }

  usage() {
    super.usage();
  }
  async entrypoint() {
    await diff();
  }
}

export class UnusedPref extends Cli {
  static description = "Identify unused preferences from your user.js file";
  static commands?: Option[] = [
    { arguments: [CliValue.pathUsage], help: "Path to your user.js file" },
  ];
  static options?: Option[] = [
    {
      arguments: [`${CliArg.firefoxPath} ${CliValue.pathUsage}`],
      help: "Path to the firefox binary",
    },
  ];

  constructor(fail?: boolean) {
    super(
      fail,
      UnusedPref.description,
      UnusedPref.commands,
      UnusedPref.options,
    );
  }

  usage() {
    super.usage();
  }
  async entrypoint() {
    await unusedPrefs();
  }
}

export class Clean extends Cli {
  static description = "Remove files generated by ff-diff";
  static commands?: Option[] = [];
  static options?: Option[] = [
    {
      arguments: [`${CliArg.keep} ${CliValue.version1},${CliValue.version2}`],
      help: "Specify one or more versions whose archives and binaries should be preserved during cleanup.\nProvide a comma-separated list of versions to keep.\n   Example: --keep 139.0,140.0",
    },
  ];
  constructor(fail?: boolean) {
    super(fail, Clean.description, Clean.commands, Clean.options);
  }

  usage() {
    super.usage();
  }
  async entrypoint() {
    await clean();
  }
}
