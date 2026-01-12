import { ENOENT } from "node:constants";
import { stat } from "node:fs/promises";
import { styleText } from "node:util";

export const startsWithNumberDotNumber = (str: string): boolean => {
  const dotIndex = str.indexOf(".");
  if (dotIndex === -1 || dotIndex === 0) {
    return false;
  }

  const beforeDot = str.slice(0, dotIndex);
  for (let i = 0; i < beforeDot.length; i++) {
    const char = beforeDot[i];
    if (char < "0" || char > "9") {
      return false;
    }
  }

  const afterDotChar = str[dotIndex + 1];
  return afterDotChar !== undefined && afterDotChar >= "0" && afterDotChar <= "9";
};

export const gettingPrefsMessage = "Getting prefs...";
export const gettingVersionMessage = "Getting firefox version...";

export const isUnitDifferenceOne = (a: string, b: string): boolean => {
  const unitA = Math.floor(parseFloat(a));
  const unitB = Math.floor(parseFloat(b));
  return Math.abs(unitA - unitB) === 1;
};

type ParsedVersion = {
  parts: number[];
  beta: number | null;
};

const parseVersion = (v: string): ParsedVersion => {
  let beta: number | null = null;
  let base = v;

  const bIndex = v.indexOf("b");
  if (bIndex !== -1) {
    base = v.slice(0, bIndex);

    const betaPart = v.slice(bIndex + 1);
    const betaNum = Number(betaPart);
    beta = Number.isFinite(betaNum) ? betaNum : null;
  }

  const parts = base.split(".").map((p) => {
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  });

  return { parts, beta };
};

export const warnIncorrectOldVersion = (oldVersion: string, newVersion: string): void => {
  const a = parseVersion(oldVersion);
  const b = parseVersion(newVersion);

  const len = Math.max(a.parts.length, b.parts.length);

  // Compare numeric parts
  for (let i = 0; i < len; i++) {
    const av = a.parts[i] ?? 0;
    const bv = b.parts[i] ?? 0;

    if (av !== bv) {
      if (av > bv) warn(oldVersion, newVersion);
      return;
    }
  }

  if (a.beta === null && b.beta !== null) {
    warn(oldVersion, newVersion);
    return;
  }

  if (a.beta !== null && b.beta === null) {
    return;
  }

  if (a.beta !== null && b.beta !== null && a.beta > b.beta) {
    warn(oldVersion, newVersion);
  }
};

const warn = (oldVersion: string, newVersion: string): void => {
  console.warn(
    styleText(
      "yellow",
      `Warning: The previous version \`${oldVersion}\` is greater than the new version \`${newVersion}\``,
    ),
  );
};

export const getPathType = async (
  path: string,
): Promise<"file" | "directory" | "other" | "missing"> => {
  try {
    const s = await stat(path);

    if (s.isFile()) return "file";
    if (s.isDirectory()) return "directory";
    return "other";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).errno === ENOENT) {
      return "missing";
    }
    console.error(err);
    process.exit(1);
  }
};

export const exit = (msg?: string): never => {
  if (msg) {
    console.error(styleText("red", msg));
  }
  process.exit(1);
};
