import { readdir, rm } from "fs/promises";
import { join } from "path";
import { getArgumentValue, installDir, keepOptions } from "./helpers";

const parseKeepArgument = (): number[] => {
  const args = getArgumentValue("--keep");
  if (!args) {
    return [];
  }
  const versions = args.split(",").map((value) => {
    const version = parseInt(value, 10);
    if (isNaN(version)) {
      console.error(`Error: Invalid version '${value}' provided.`);
      process.exit(1);
    }
    return version;
  });

  return versions;
};

export const clean = () => {
  const keptVersions = parseKeepArgument();
  console.log("Versions kept:", keptVersions.join(", "));
  removeFolders(keptVersions);
};

async function removeFolders(keptVersions: number[]) {
  try {
    const entries = await readdir(installDir, { withFileTypes: true });

    const removalPromises = entries.map(async (entry) => {
      const fullPath = join(installDir, entry.name);
      let shouldRemove = false;
      let logMessage = "";

      if (
        entry.isDirectory() &&
        !keptVersions.includes(parseInt(entry.name)) &&
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
        const version = parseInt(entry.name.slice("firefox-".length), 10);
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
    const hasChanged = results.some((changed) => changed);
    if (!hasChanged) {
      console.log("No archives/sources has been removed");
    } else {
      console.log("Cleanup complete.");
    }
  } catch (error) {
    console.error("Error reading dist/ directory:", error);
    process.exit(1);
  }
}
