import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { keepOptions } from "$cli";
import { installDir } from "$lib/install";

export const clean = async (keptVersions: number[]) => {
  try {
    const entries = await readdir(installDir, { withFileTypes: true });

    const removalPromises = entries.map(async (entry) => {
      const fullPath = join(installDir, entry.name);

      if (
        entry.isDirectory() &&
        !keepOptions.sources &&
        !keptVersions.includes(Number.parseInt(entry.name, 10))
      ) {
        console.log(`Removing folder: ${entry.name}`);
        await rm(fullPath, { recursive: true, force: true });
        return true;
      }

      if (entry.isFile() && !keepOptions.archives && entry.name.startsWith("firefox-")) {
        const version = Number.parseInt(entry.name.slice("firefox-".length), 10);
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
    console.error("Error reading dist/ directory:", error);
    process.exit(1);
  }
};
