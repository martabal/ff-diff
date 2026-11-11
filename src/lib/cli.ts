import { CLI_ARGS } from "$cli";
import { exit } from "$lib/helpers";

const argumentWithoutValue = (argument: string) => {
  exit(`Error: Argument "${argument}" is provided but has no value.`);
};

export const getArgumentValue = (argument: string): string | undefined => {
  const args = process.argv;
  const index = args.indexOf(argument);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    argumentWithoutValue(argument);
  }

  return value;
};

export const getArgumentValues = (argument: string): string[] => {
  const args = process.argv;
  const values: string[] = [];

  let index = args.indexOf(argument);
  while (index !== -1) {
    if (index + 1 >= args.length || args[index + 1].startsWith("--")) {
      argumentWithoutValue(argument);
    }

    const rawValue = args[index + 1];

    values.push(
      ...rawValue
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v !== ""),
    );

    index = args.indexOf(argument, index + 2);
  }

  return values;
};

export const parseKeepArgument = (): number[] => {
  const args = getArgumentValues(CLI_ARGS.KEEP);
  if (!args) {
    return [];
  }
  const versions = args.map((value) => {
    const version = Math.trunc(Number(value));
    if (isNaN(version)) {
      argumentWithoutValue(`Error: Invalid version '${value}' provided.`);
    }
    return version;
  });
  if (versions.length > 0) {
    console.log("Versions kept:", versions.join(", "));
  }
  return versions;
};
