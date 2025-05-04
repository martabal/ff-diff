import { execSync } from "child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { pipeline, Readable } from "stream";
import { promisify } from "util";

export type SourcesOptions = {
  archives: boolean;
  sources: boolean;
};

export type PrintOptions = {
  doNotPrintConsole: boolean;
  saveDiffsInFile: boolean;
};

export const cleanOptions: SourcesOptions = {
  archives: process.argv.includes("--remove-archives"),
  sources: process.argv.includes("--remove-sources"),
};

export const keepOptions: SourcesOptions = {
  archives: process.argv.includes("--keep-archives"),
  sources: process.argv.includes("--keep-sources"),
};

export const printOptions: PrintOptions = {
  doNotPrintConsole: process.argv.includes("--do-not-print-diffs-in-console"),
  saveDiffsInFile: process.argv.includes("--save-diffs-in-file"),
};

export const __dirname = process.cwd();

export const getArgumentValue = (argument: string): string | undefined => {
  const args = process.argv;
  const versionIndex = args.indexOf(argument);
  if (versionIndex + 1 >= args.length) {
    console.error(
      `Error: Argument "${argument}" is provided but has no value.`,
    );
    process.exit(1);
  }
  if (versionIndex !== -1 && versionIndex + 1 < args.length) {
    const versionValue = args[versionIndex + 1];
    if (versionValue.startsWith("--")) {
      console.error(
        `Error: Argument "${argument}" is provided but has no value.`,
      );
      process.exit(1);
    }
    return versionValue;
  } else {
    return undefined;
  }
};

const streamPipeline = promisify(pipeline);

const downloadFile = async (url: string, dest: string) => {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download file, status code: ${response.status}`);
  }

  const readableStream = response.body as ReadableStream<Uint8Array>;

  const nodeReadableStream = Readable.from(readableStream);

  await streamPipeline(nodeReadableStream, createWriteStream(dest));
};

export const installFirefox = async (
  version: string,
  installDir: string,
): Promise<void> => {
  const archivePath = path.join(installDir, `firefox-${version}.tar.xz`);
  const destPath = path.join(installDir, version);
  const executablePath = path.join(destPath, "firefox");

  if (!existsSync(archivePath)) {
    console.log(`Downloading firefox ${version}`);
    const downloadUrl = `https://archive.mozilla.org/pub/firefox/releases/${version}/linux-x86_64/en-US/firefox-${version}.tar.xz`;
    await downloadFile(downloadUrl, archivePath);
  } else {
    console.log(`Archive already exists at ${archivePath}. Skipping download.`);
  }

  if (!existsSync(executablePath)) {
    mkdirSync(destPath, { recursive: true });
    execSync(`tar -xvf ${archivePath} -C ${destPath}`);
  }

  if (cleanOptions.archives) {
    console.log(`Removing archive for Firefox ${version}`);
    await rmSync(archivePath);
  }
};
