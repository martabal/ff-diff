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

const parse = (v: string): number[] => v.split(".").map((part) => Number(part) || 0);

export const warnIncorrectOldVersion = (oldVersion: string, newVersion: string): void => {
  const a = parse(oldVersion);
  const b = parse(newVersion);

  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);

    if (diff > 0) {
      console.warn(
        styleText(
          "yellow",
          `Warning: The previous version \`${oldVersion}\` is greater than the new version \`${newVersion}\``,
        ),
      );
      return;
    }

    if (diff < 0) {
      return;
    }
  }
};
