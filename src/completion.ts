import fs from "fs";
import path from "path";
import { ALL_COMMANDS, VERSION_ARGS, HELP_ARGS, CLI_ARGS, Cli } from "./cli";
import { getArgumentValue } from "./helpers";

const pathArg = getArgumentValue(CLI_ARGS.PATH);
if (pathArg === null) {
  console.error("Error: You must provide --path <output-directory>");
  process.exit(1);
}

const outputDir = path.resolve(pathArg);
fs.mkdirSync(outputDir, { recursive: true });

const globalOptions = [
  VERSION_ARGS.help,
  VERSION_ARGS.smallHelp,
  HELP_ARGS.help,
  HELP_ARGS.smallHelp,
];
const commands = ALL_COMMANDS.map((cmd) => cmd.COMMAND);

const removeLeadingDashes = (str: string): string => {
  return str.startsWith("--")
    ? str.slice(2)
    : str.startsWith("-")
      ? str.slice(1)
      : str;
};

const commandOptions: Record<
  string,
  Array<{ arg: string; description: string }>
> = {};

for (const CmdClass of ALL_COMMANDS) {
  commandOptions[CmdClass.COMMAND] = CmdClass.OPTIONS.flatMap((opt) => {
    const args = [];
    if (opt.argument.help) {
      args.push({
        arg: opt.argument.help.split(" ")[0],
        description: opt.smallDoc ?? opt.doc.split("\n")[0],
      });
    }
    if (opt.argument.smallHelp) {
      args.push({
        arg: opt.argument.smallHelp,
        description: opt.smallDoc ?? opt.doc.split("\n")[0],
      });
    }
    return args.filter((item) => item.arg.startsWith("-"));
  });
}

const bashCompletion = `#!/bin/bash
# Bash completion for ${APP_NAME}
_${APP_NAME}_complete() {
  local cur cmds opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  cmds="${commands.join(" ")}"
  opts="${globalOptions.join(" ")}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    mapfile -t COMPREPLY < <(compgen -W "$cmds $opts" -- "$cur")
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
${commands
  .map(
    (cmd) => `    ${cmd})
      mapfile -t COMPREPLY < <(compgen -W "${commandOptions[cmd].map((opt) => opt.arg).join(" ")}" -- "$cur")
      return 0
      ;;`,
  )
  .join("\n")}
  esac
}

complete -F _${APP_NAME}_complete ${APP_NAME}
`;

const fishCompletion = `# Fish completion for ${APP_NAME}

${Cli.COMMANDS.map(
  (cmd) =>
    `complete -c ${APP_NAME} -n __fish_use_subcommand -f -a "${cmd.arguments.join(" ")}" -d "${(cmd.smallDoc ?? cmd.doc).split("\n")[0]}"`,
).join("\n")}

${Cli.OPTIONS.map(
  (opt) =>
    `complete -c ${APP_NAME} -n __fish_use_subcommand ${opt.argument.smallHelp ? `-s "${removeLeadingDashes(opt.argument.smallHelp)}"` : ""} -a "${removeLeadingDashes(opt.argument.help)}" -d "${opt.doc.split("\n")[0]}"`,
).join("\n")}

${ALL_COMMANDS.map(
  (CmdClass) =>
    `complete -c ${APP_NAME} -n __fish_use_subcommand -f -a "${CmdClass.COMMAND}" -d "${CmdClass.SMALL_DESCRIPTION ?? CmdClass.DESCRIPTION}"`,
).join("\n")}

${commands
  .map((cmd) =>
    commandOptions[cmd]
      .map(
        (opt) =>
          `complete -c ${APP_NAME} -n "__fish_seen_subcommand_from ${cmd}" -l '${removeLeadingDashes(opt.arg)}' -d '${opt.description}'`,
      )
      .join("\n"),
  )
  .join("\n")}
`;

const completionFileName = "completion";

fs.writeFileSync(
  path.join(outputDir, `${completionFileName}.bash`),
  bashCompletion,
  "utf8",
);

fs.writeFileSync(
  path.join(outputDir, `${completionFileName}.fish`),
  fishCompletion,
  "utf8",
);

console.log(`Bash, Fish, and Zsh completions generated in: ${outputDir}`);
