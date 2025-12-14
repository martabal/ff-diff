import fs from "node:fs/promises";
import path from "node:path";
import { Cli, ALL_COMMANDS } from "$cli";

const generateUsage = (): string => {
  const lines: string[] = [];
  lines.push("Usage:");

  for (const CmdClass of ALL_COMMANDS) {
    const cmd = CmdClass.COMMAND;

    const commandArgs = CmdClass.COMMANDS.map((opt) => opt.values.join(" ")).join(" ");

    const optionalArgs = CmdClass.OPTIONS.map((opt) => `[${opt.longOption}]`).join(" ");

    let usageLine = `  ${APP_NAME} ${cmd}`;
    if (commandArgs) usageLine += ` ${commandArgs}`;
    if (optionalArgs) usageLine += ` ${optionalArgs}`;

    lines.push(usageLine);
  }

  lines.push("\nOptions:");
  const maxLength =
    Math.max(...Cli.OPTIONS.map((opt) => opt.longOption.length + (opt.shortOption?.length ?? 0))) +
    6;

  for (const option of Cli.OPTIONS) {
    const args = option.shortOption
      ? option.shortOption + ", " + option.longOption
      : option.longOption;
    const padding = " ".repeat(Math.max(0, maxLength - args.length));
    lines.push(`  ${args}${padding}${option.doc}`);
  }

  return lines.join("\n");
};

const updateReadme = async () => {
  const readmePath = path.resolve("README.md");
  const readme = await fs.readFile(readmePath, "utf8");

  const usageBlock = ["```bash", `$ ${APP_NAME}`, generateUsage(), "```"].join("\n");

  const updated = readme.replace(
    /(<!--- Begin usage -->)([\s\S]*?)(<!--- End usage -->)/,
    `$1\n\n${usageBlock}\n\n$3`,
  );

  await fs.writeFile(readmePath, updated);
};

await updateReadme();
