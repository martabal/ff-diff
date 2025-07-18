import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { getArgumentValue, installDir } from "./helpers";
import { keepOptions } from "./cli";

const parseKeepArgument = (): number[] => {
  const args = getArgumentValue("--keep");
  if (!args) {
    return [];
  }
  const versions = args.split(",").map((value) => {
    const version = Number.parseInt(value, 10);
    if (isNaN(version)) {
      console.error(`Error: Invalid version '${value}' provided.`);
      process.exit(1);
    }
    return version;
  });
  console.log("Versions kept:", versions.join(", "));
  return versions;
};

export const clean = async () => {
  const keptVersions = parseKeepArgument();
  try {
    const entries = await readdir(installDir, { withFileTypes: true });

    const removalPromises = entries.map(async (entry) => {
      const fullPath = join(installDir, entry.name);
      let shouldRemove = false;
      let logMessage = "";

      if (
        entry.isDirectory() &&
        !keptVersions.includes(Number.parseInt(entry.name, 10)) &&
        !keepOptions.sources
      ) {
        shouldRemove = true;
        logMessage = `Removing folder: ${entry.name}`;
      }

      if (
        entry.isFile() &&
        entry.name.startsWith("firefox-") &&
        !keepOptions.archives
      ) {
        const version = Number.parseInt(
          entry.name.slice("firefox-".length),
          10,
        );
        if (!keptVersions.includes(version)) {
          shouldRemove = true;
          logMessage = `Remove archive: ${entry.name}`;
        }
      }

      if (shouldRemove) {
        console.log(logMessage);
        await rm(fullPath, { recursive: true, force: true });
        return true;
      }

      return false;
    });

    const results = await Promise.all(removalPromises);
    const hasChanged = results.some(Boolean);
    if (hasChanged) {
      console.log("Cleanup complete.");
    } else {
      console.log("No archives/sources has been removed");
    }
  } catch (error) {
    console.error("Error reading dist/ directory:", error);
    process.exit(1);
  }
};
