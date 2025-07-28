import { ALL_COMMANDS, Cli } from "./cli";

function generateUsage(): string {
  const lines: string[] = [];
  lines.push("Usage:");

  for (const CmdClass of ALL_COMMANDS) {
    const cmd = CmdClass.COMMAND;

    const commandArgs = CmdClass.COMMANDS.map((opt) =>
      opt.values.join(" "),
    ).join(" ");

    const optionalArgs = CmdClass.OPTIONS.map(
      (opt) => `[${opt.longOption}]`,
    ).join(" ");

    let usageLine = `  ${APP_NAME} ${cmd}`;
    if (commandArgs) usageLine += ` ${commandArgs}`;
    if (optionalArgs) usageLine += ` ${optionalArgs}`;

    lines.push(usageLine);
  }

  lines.push("\nOptions:");
  const maxLength =
    Math.max(
      ...Cli.OPTIONS.map(
        (opt) => opt.longOption.length + (opt.shortOption?.length ?? 0),
      ),
    ) + 6;

  for (const option of Cli.OPTIONS) {
    const args = option.shortOption
      ? option.shortOption + ", " + option.longOption
      : option.longOption;
    const padding = " ".repeat(Math.max(0, maxLength - args.length));
    lines.push(`  ${args}${padding}${option.doc}`);
  }

  return lines.join("\n");
}

console.log(generateUsage());
