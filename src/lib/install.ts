import { cleanOptions } from "$cli";
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { arch, homedir, platform } from "node:os";
import { join } from "node:path";
import { pipeline, Readable } from "node:stream";
import { promisify } from "node:util";
import { getPrefs, Pref } from "$lib/firefox";

type InstallFirefoxOptions = {
  version: string;
  retry: boolean;
};

type DownloadArchiveOptions = {
  url: string;
  fileDest: string;
  retry: boolean;
  version: string;
};

enum PlatformOS {
  LinuxArm64 = "linux-aarch64",
  LinuxX86_64 = "linux-x86_64",
}

type PlatformAndArch = `${NodeJS.Platform}-${NodeJS.Architecture}`;

type Host = {
  platformOS: PlatformOS;
  architecture: string;
  os: string;
};

const mapPlatformArch: Map<PlatformAndArch, PlatformOS> = new Map([
  ["linux-x64", PlatformOS.LinuxX86_64],
  ["linux-arm64", PlatformOS.LinuxArm64],
]);

const getPlatformOS = (): Host => {
  const os = platform();
  const architecture = arch();
  const key: PlatformAndArch = `${os}-${architecture}`;
  const platformOS = mapPlatformArch.get(key);
  if (platformOS === undefined) {
    console.error(`Unsupported architecture/OS: ${key}`);
    process.exit(1);
  }
  return { os, platformOS, architecture };
};

const RELATIVE_INSTALL_DIR = `.${APP_NAME}`;

const __dirname =
  process.env.USE_CURRENT_DIR === "true"
    ? join(process.cwd(), RELATIVE_INSTALL_DIR)
    : join(homedir(), RELATIVE_INSTALL_DIR);

const host: Host = getPlatformOS();

export const installDir = join(__dirname, "firefox", host.os);
export const diffsDir = join(__dirname, "diffs");
export const defaultsDir = join(__dirname, "default");
export const defaultsUserJSDir = join(__dirname, "default-userjs");

const streamPipeline = promisify(pipeline);

const getFilePathWithPrefix = (filePrefix: string): string | null => {
  if (!existsSync(installDir)) {
    return null;
  }

  const files = readdirSync(installDir);
  const match = files.find((file) => file.startsWith(filePrefix));
  return match ? join(installDir, match) : null;
};

export const getPrefsFromInstalledVersion = async (
  version: string,
  executablePath: string,
): Promise<Map<string, Pref>> => {
  await installFirefox({ version, retry: false });
  return getPrefs({ executablePath });
};

const downloadArchive = async ({
  url,
  fileDest,
  retry,
  version,
}: DownloadArchiveOptions): Promise<string> => {
  let response = await fetch(url);

  if (response.status === 404 && url.endsWith(".tar.xz") && !retry) {
    url = url.replace(".tar.xz", ".tar.bz2");
    fileDest = fileDest.replace(".tar.xz", ".tar.bz2");
    console.warn(`${url} it not found, trying ${url} instead`);
    return downloadArchive({ url, fileDest, retry: true, version });
  }

  if (retry) {
    throw new Error(`Can't find firefox version ${version}`);
  }

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download file, status code: ${response.status}`);
  }

  const readableStream = response.body;
  const nodeReadableStream = Readable.from(readableStream);
  await streamPipeline(nodeReadableStream, createWriteStream(fileDest));
  return fileDest;
};

export const installFirefox = async ({ version, retry }: InstallFirefoxOptions): Promise<void> => {
  const fileName = `firefox-${version}.tar`;
  let potentialArchivePath = getFilePathWithPrefix(fileName);
  const destPath = join(installDir, version);
  const fileDest = join(installDir, `${fileName}.xz`);
  const executablePath = join(destPath, "firefox");

  if (potentialArchivePath) {
    console.log(`Archive already exists at ${potentialArchivePath}. Skipping download.`);
  } else {
    console.log(`Downloading firefox ${version}`);
    const url = `https://archive.mozilla.org/pub/firefox/releases/${version}/${host.platformOS}/en-US/firefox-${version}.tar.xz`;
    try {
      potentialArchivePath = await downloadArchive({
        url,
        fileDest,
        retry: false,
        version,
      });
    } catch (error) {
      console.error(String(error));
      process.exit(1);
    }
  }

  if (!existsSync(executablePath)) {
    await extractArchive(destPath, potentialArchivePath, version, retry);
  }

  if (cleanOptions.archives) {
    console.log(`Removing archive for Firefox ${version}`);
    rmSync(potentialArchivePath);
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
        rmSync(potentialArchivePath);
      }
      await installFirefox({ version, retry: true });
    }
  }
};
