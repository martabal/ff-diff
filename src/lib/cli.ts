import { CLI_ARGS } from "$cli";

const argumentWithoutValue = (argument: string) => {
  console.error(`Error: Argument "${argument}" is provided but has no value.`);
  process.exit(1);
};

export const getArgumentValue = (argument: string): undefined | string => {
  const args = process.argv;
  const versionIndex = args.indexOf(argument);
  if (versionIndex + 1 >= args.length) {
    argumentWithoutValue(argument);
  }
  let versionValue = undefined;
  if (versionIndex !== -1 && args.length > versionIndex + 1) {
    versionValue = args[versionIndex + 1];
    if (versionValue.startsWith("--")) {
      argumentWithoutValue(argument);
    }
    return versionValue;
  }
  return versionValue;
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
    const version = Number.parseInt(value, 10);
    if (isNaN(version)) {
      console.error(`Error: Invalid version '${value}' provided.`);
      process.exit(1);
    }
    return version;
  });
  if (versions.length > 0) {
    console.log("Versions kept:", versions.join(", "));
  }
  return versions;
};
