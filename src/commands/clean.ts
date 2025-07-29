import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { keepOptions } from "@cli";
import { installDir } from "@lib/helpers";

export const clean = async (keptVersions: number[]) => {
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
