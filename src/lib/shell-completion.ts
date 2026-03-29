import { ALL_COMMANDS, VERSION_ARGS, HELP_ARGS, Cli, SUPPORTED_SHELLS_COMPLETION } from "$cli";

import { type SupportedShell } from "$cli";

const removeLeadingDashes = (str: string): string => {
  return str.startsWith("--") ? str.slice(2) : str.startsWith("-") ? str.slice(1) : str;
};

export const create_shells_completions = (shell: SupportedShell) => {
  const globalOptions = [
    VERSION_ARGS.longOption,
    VERSION_ARGS.shortOption,
    HELP_ARGS.longOption,
    HELP_ARGS.shortOption,
  ];
  const commands = ALL_COMMANDS.map((cmd) => cmd.COMMAND);

  const commandOptions: Record<string, Array<{ arg: string; description: string }>> = {};

  for (const CmdClass of ALL_COMMANDS) {
    commandOptions[CmdClass.COMMAND] = CmdClass.OPTIONS.flatMap((opt) => {
      const args = [];
      if (opt.longOption) {
        args.push({
          arg: opt.longOption.split(" ")[0],
          description: opt.smallDoc ?? opt.doc.split("\n")[0],
        });
      }
      if (opt.shortOption) {
        args.push({
          arg: opt.shortOption,
          description: opt.smallDoc ?? opt.doc.split("\n")[0],
        });
      }
      return args.filter((item) => item.arg.startsWith("-"));
    });
  }

  switch (shell) {
    case SUPPORTED_SHELLS_COMPLETION.BASH: {
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
      console.log(bashCompletion);
      break;
    }

    case SUPPORTED_SHELLS_COMPLETION.FISH: {
      const fishCompletion = `# Fish completion for ${APP_NAME}
${Cli.COMMANDS.map(
  (cmd) =>
    `complete -c ${APP_NAME} -n __fish_use_subcommand -f -a "${cmd.values.join(" ")}" -d "${(cmd.smallDoc ?? cmd.doc).split("\n")[0]}"`,
).join("\n")}
${Cli.OPTIONS.map(
  (opt) =>
    `complete -c ${APP_NAME} -n __fish_use_subcommand ${
      opt.shortOption ? `-s "${removeLeadingDashes(opt.shortOption)}"` : ""
    } -a "${removeLeadingDashes(opt.longOption)}" -d "${opt.doc.split("\n")[0]}"`,
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

      console.log(fishCompletion);
      break;
    }
  }
};
