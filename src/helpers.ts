import { execSync } from "child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "fs";
import { arch, homedir, platform } from "os";
import path from "path";
import { exit } from "process";
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

type InstallFirefoxOptions = {
  version: string;
  retry: boolean;
};

type DownloadArchiveOptions = {
  url: string;
  fileDest: string;
  retry: boolean;
};

export const cleanArg = "clean";
export const diffArg = "diff";
export const unusedPrefsArg = "unused-prefs";

export const compareUserjsArg = "--compare-userjs";
export const keepArg = "--keep";
export const firefoxPathArg = "--firefox-path";
export const keepArchivesArg = "--keep-archives";
export const keepSourcesArg = "--keep-sources";
export const cleanSourcesArg = "--clean-sources";
export const cleanArchivesArg = "--clean-archives";
export const saveDiffsArg = "--save-diffs-in-file";
export const doNotPrintInConsole = "--do-not-print-diffs-in-console";

export const cleanOptions: SourcesOptions = {
  archives: process.argv.includes(cleanArchivesArg),
  sources: process.argv.includes(cleanSourcesArg),
};

export const keepOptions: SourcesOptions = {
  archives: process.argv.includes(keepArchivesArg),
  sources: process.argv.includes(keepSourcesArg),
};

export const printOptions: PrintOptions = {
  doNotPrintConsole: process.argv.includes(doNotPrintInConsole),
  saveDiffsInFile: process.argv.includes(saveDiffsArg),
};

const pathUsageValue = "<path>";
const version1Value = "<version1>";
const version2Value = "<version2>";
const binaryName = "ff-diff";

export const usage = `Usage:
  ${binaryName} ${cleanArg} [${keepArg} ${version1Value},${version2Value}] [${keepArchivesArg}] [${keepSourcesArg}]
  ${binaryName} ${diffArg} ${version1Value} ${version2Value} [${cleanArchivesArg}] [${cleanSourcesArg}] [${doNotPrintInConsole}] [${saveDiffsArg}] [${compareUserjsArg} ${pathUsageValue}]
  ${binaryName} ${unusedPrefsArg} ${compareUserjsArg} ${pathUsageValue} [${firefoxPathArg} ${pathUsageValue}]`;

const __dirname =
  process.env.USE_CURRENT_DIR === "true"
    ? process.cwd()
    : path.join(homedir(), `.${binaryName}`);

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

export const installDir = path.join(__dirname, "firefox");
export const diffsDir = path.join(__dirname, "diffs");

const getArchitecture = () => {
  const architecture = arch();
  switch (architecture) {
    case "arm64":
      return "aarch64";
    case "x64":
      return "x86_64";
    default:
      console.error(`Your architecture (${architecture}) is not supported`);
      exit(1);
  }
};

const getPlatform = () => {
  const os = platform();
  switch (os) {
    case "linux":
      return "linux";
    default:
      console.error(`Your platform (${os}) is not supported`);
      exit(1);
  }
};

const downloadArchive = async ({
  url,
  fileDest,
  retry,
}: DownloadArchiveOptions): Promise<string> => {
  let response = await fetch(url);

  if (response.status === 404 && url.endsWith(".tar.xz") && !retry) {
    url = url.replace(".tar.xz", ".tar.bz2");
    fileDest = fileDest.replace(".tar.xz", ".tar.bz2");
    console.warn(`${url} it not found, trying ${url} instead`);
    return await downloadArchive({ url, fileDest, retry: true });
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

export const installFirefox = async ({
  version,
  retry,
}: InstallFirefoxOptions): Promise<void> => {
  const fileName = `firefox-${version}.tar`;
  let potentialArchivePath = getFilePathWithPrefix(fileName);
  const destPath = path.join(installDir, version);
  const fileDest = path.join(installDir, `${fileName}.xz`);
  const executablePath = path.join(destPath, "firefox");

  if (!potentialArchivePath) {
    console.log(`Downloading firefox ${version}`);
    const url = `https://archive.mozilla.org/pub/firefox/releases/${version}/${getPlatform()}-${getArchitecture()}/en-US/firefox-${version}.tar.xz`;
    try {
      potentialArchivePath = await downloadArchive({
        url,
        fileDest,
        retry: false,
      });
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
    try {
      execSync(`tar -xvf ${potentialArchivePath} -C ${destPath}`, {
        stdio: "ignore",
      });
    } catch (error) {
      if (!retry) {
        console.error(
          "Error when extracting the archive, removing the archive and downloading the archive",
        );
        if (potentialArchivePath) {
          await rmSync(potentialArchivePath);
        }
        await installFirefox({ version, retry: true });
      } else {
        console.error("Error when extracting the archive: ", error);
      }
    }
  }

  if (cleanOptions.archives) {
    console.log(`Removing archive for Firefox ${version}`);
    await rmSync(potentialArchivePath);
  }
};
