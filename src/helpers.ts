import { execSync } from "child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "fs";
import { homedir } from "os";
import path from "path";
import { pipeline, Readable } from "stream";
import { promisify } from "util";

type SourcesOptions = {
  archives: boolean;
  sources: boolean;
};

type PrintOptions = {
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

const __dirname =
  process.env.USE_CURRENT_DIR === "true"
    ? process.cwd()
    : path.join(homedir(), ".ff-diff");

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

export const installDir = path.join(__dirname, "dist");
export const diffsDir = path.join(__dirname, "diffs");

const downloadFile = async (url: string, fileDest: string): Promise<string> => {
  let response = await fetch(url);
  fileDest = path.join(installDir, `${fileDest}.xz`);
  if (response.status === 404 && url.endsWith(".tar.xz")) {
    const fallbackUrl = url.replace(".tar.xz", ".tar.bz2");
    fileDest = fileDest.replace(".tar.xz", ".tar.bz2");
    console.warn(`${url} it not found, trying ${fallbackUrl} instead`);
    response = await fetch(fallbackUrl);
    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to download file (fallback), status code: ${response.status}`,
      );
    }
    url = fallbackUrl;
  } else if (!response.ok || !response.body) {
    throw new Error(`Failed to download file, status code: ${response.status}`);
  }

  const readableStream = response.body as ReadableStream<Uint8Array>;
  const nodeReadableStream = Readable.from(readableStream);
  await streamPipeline(nodeReadableStream, createWriteStream(fileDest));
  return fileDest;
};

const getFilePathWithPrefix = (filePrefix: string): string | null => {
  if (!existsSync(installDir)) {
    return null;
  }

  const files = readdirSync(installDir);
  const match = files.find((file) => file.startsWith(filePrefix));
  return match ? path.join(installDir, match) : null;
};

export const installFirefox = async (version: string): Promise<void> => {
  const tar = `firefox-${version}.tar`;
  let potentialArchivePath = getFilePathWithPrefix(tar);
  const destPath = path.join(installDir, version);
  const executablePath = path.join(destPath, "firefox");

  if (!potentialArchivePath) {
    console.log(`Downloading firefox ${version}`);
    const downloadUrl = `https://archive.mozilla.org/pub/firefox/releases/${version}/linux-x86_64/en-US/firefox-${version}.tar.xz`;
    try {
      potentialArchivePath = await downloadFile(downloadUrl, tar);
    } catch (error) {
      console.error(`Can't download firefox ${version}: ${error}`);
      process.exit(1);
    }
  } else {
    console.log(
      `Archive already exists at ${potentialArchivePath}. Skipping download.`,
    );
  }

  if (!existsSync(executablePath)) {
    mkdirSync(destPath, { recursive: true });
    execSync(`tar -xvf ${potentialArchivePath} -C ${destPath}`);
  }

  if (cleanOptions.archives) {
    console.log(`Removing archive for Firefox ${version}`);
    await rmSync(potentialArchivePath);
  }
};
