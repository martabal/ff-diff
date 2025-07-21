import { ALL_COMMANDS, Cli } from "./cli";

function generateUsage(): string {
  const lines: string[] = [];
  lines.push("Usage:");

  for (const CmdClass of ALL_COMMANDS) {
    const cmd = CmdClass.COMMAND;

    const commandArgs = CmdClass.COMMANDS.map((opt) =>
      opt.arguments.join(" "),
    ).join(" ");

    const optionalArgs = CmdClass.OPTIONS.map(
      (opt) => `[${opt.arguments.join(" ")}]`,
    ).join(" ");

    let usageLine = `  ${APP_NAME} ${cmd}`;
    if (commandArgs) usageLine += ` ${commandArgs}`;
    if (optionalArgs) usageLine += ` ${optionalArgs}`;

    lines.push(usageLine);
  }

  lines.push("\nOptions:");
  const maxLength =
    Math.max(...Cli.OPTIONS.map((opt) => opt.arguments.join(", ").length)) + 4;

  for (const option of Cli.OPTIONS) {
    const args = option.arguments.join(", ");
    const padding = " ".repeat(Math.max(0, maxLength - args.length));
    lines.push(`  ${args}${padding}${option.help}`);
  }

  return lines.join("\n");
}

console.log(generateUsage());
