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
import { cleanOptions } from "@commands/cli";
import { FirefoxChangedPref, FirefoxPref, Pref } from "@lib/firefox";

export interface PrintDiff {
  label: string;
  keys: (FirefoxChangedPref | FirefoxPref)[];
  formatter: (key: FirefoxChangedPref | FirefoxPref, format: Format) => string;
}

export const formatValue = (val: Pref): Pref => ("" === val ? " " : val);

export enum Format {
  Markdown = "md",
  Text = "txt",
}

export interface Ticks {
  tickStart: string;
  tickSymbol?: string;
  tickKeyValue: Pref;
}

export interface AllFormated extends Ticks {
  tickSymbol: string;
}

export const formatTicks: Record<Format, Ticks> = {
  [Format.Markdown]: {
    tickStart: "",
    tickSymbol: "-",
    tickKeyValue: "`",
  },
  [Format.Text]: {
    tickStart: " ",
    tickSymbol: undefined,
    tickKeyValue: "",
  },
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

const RELATIVE_INSTALL_DIR = `.${APP_NAME}`;

const __dirname =
  process.env.USE_CURRENT_DIR === "true"
    ? path.join(process.cwd(), RELATIVE_INSTALL_DIR)
    : path.join(homedir(), RELATIVE_INSTALL_DIR);

const argumentWithoutValue = (argument: string) => {
  console.error(`Error: Argument "${argument}" is provided but has no value.`);
  process.exit(1);
};

export const getArgumentValue = (argument: string) => {
  const args = process.argv;
  const versionIndex = args.indexOf(argument);
  if (versionIndex + 1 >= args.length) {
    argumentWithoutValue(argument);
  }
  let versionValue = null;
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

const streamPipeline = promisify(pipeline);

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

const PLATFORM = getPlatform();
const ARCHITECTURE = getArchitecture();

export const installDir = path.join(__dirname, "firefox", PLATFORM);
export const diffsDir = path.join(__dirname, "diffs");
export const defaultsDir = path.join(__dirname, "default");
export const defaultsUserJSDir = path.join(__dirname, "default-userjs");

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
  }
  if (!response.ok || !response.body) {
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

  if (potentialArchivePath) {
    console.log(
      `Archive already exists at ${potentialArchivePath}. Skipping download.`,
    );
  } else {
    console.log(`Downloading firefox ${version}`);
    const url = `https://archive.mozilla.org/pub/firefox/releases/${version}/${PLATFORM}-${ARCHITECTURE}/en-US/firefox-${version}.tar.xz`;
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
  }

  if (!existsSync(executablePath)) {
    await extractArchive(destPath, potentialArchivePath, version, retry);
  }

  if (cleanOptions.archives) {
    console.log(`Removing archive for Firefox ${version}`);
    await rmSync(potentialArchivePath);
  }
};

const extractArchive = async (
  destPath: string,
  potentialArchivePath: string,
  version: string,
  retry: boolean,
) => {
  mkdirSync(destPath, { recursive: true });
  try {
    execSync(`tar -xvf ${potentialArchivePath} -C ${destPath}`, {
      stdio: "ignore",
    });
  } catch (error) {
    if (retry) {
      console.error("Error when extracting the archive: ", error);
    } else {
      console.error(
        "Error when extracting the archive, removing the archive and downloading the archive",
      );
      if (potentialArchivePath) {
        await rmSync(potentialArchivePath);
      }
      await installFirefox({ version, retry: true });
    }
  }
};
