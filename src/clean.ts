import { readdir, rm } from "fs/promises";
import { join } from "path";
import { getArgumentValue, installDir, keepOptions } from "./helpers.js";

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
    let hasChanged = false;

    for (const entry of entries) {
      const fullPath = join(installDir, entry.name);

      if (
        entry.isDirectory() &&
        !keptVersions.includes(parseInt(entry.name)) &&
        !keepOptions.sources
      ) {
        console.log(`Removing folder: ${entry.name}`);
        await rm(fullPath, { recursive: true, force: true });
        hasChanged = true;
      }

      if (
        entry.isFile() &&
        entry.name.startsWith("firefox-") &&
        !keepOptions.archives
      ) {
        const version = parseInt(entry.name.slice("firefox-".length), 10);
        if (!keptVersions.includes(version)) {
          console.log(`Remove archive: ${entry.name}`);

          await rm(fullPath, { recursive: true, force: true });
          hasChanged = true;
        }
      }
    }
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
