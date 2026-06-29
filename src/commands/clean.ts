import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { keepOptions } from "$cli";
import { installDir } from "$lib/install";
import { exit } from "$lib/helpers";

export const clean = async (keptVersions: number[]) => {
  try {
    const entries = await readdir(installDir, { withFileTypes: true });

    const removalPromises = entries.map(async (entry) => {
      const fullPath = join(installDir, entry.name);

      if (
        entry.isDirectory() &&
        !keepOptions.sources &&
        !keptVersions.includes(Math.trunc(Number(entry.name)))
      ) {
        console.log(`Removing folder: ${entry.name}`);
        await rm(fullPath, { recursive: true, force: true });
        return true;
      }

      if (entry.isFile() && !keepOptions.archives && entry.name.startsWith("firefox-")) {
        const version = Math.trunc(Number(entry.name.slice("firefox-".length)));
        if (!keptVersions.includes(version)) {
          console.log(`Remove archive: ${entry.name}`);
          await rm(fullPath, { recursive: true, force: true });
          return true;
        }
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
    exit(`Error reading dist/ directory: ${String(error)}`);
  }
};
