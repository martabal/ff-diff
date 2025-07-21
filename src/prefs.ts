import { Pref } from "./firefox";

export interface UserPref {
  key: string;
  value: Pref;
}

interface PrefInfo extends UserPref {
  versionAdded?: string;
  versionRemoved?: string;
  custom: boolean;
  hidden: boolean;
}

export const parseUserPrefs = (content: string): PrefInfo[] => {
  const regex =
    /user_pref\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]*?)\s*\)(?:;\s*\/\/\s*(.*))?/gm;
  const result: PrefInfo[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const [, key, rawValue, comment = ""] = match;
    const trimmedValue = rawValue.trim();

    let value: Pref;
    const firstChar = trimmedValue[0];
    const lastChar = trimmedValue[trimmedValue.length - 1];

    if (trimmedValue === "true") {
      value = true;
    } else if (trimmedValue === "false") {
      value = false;
    } else if (
      (firstChar === '"' || firstChar === "'") &&
      firstChar === lastChar
    ) {
      value = trimmedValue.slice(1, -1);
    } else {
      value = Number(trimmedValue);
    }

    // Extract metadata from comment using single regex operations
    const custom = comment.includes("[CUSTOM PREF]");
    const hidden = comment.includes("[HIDDEN PREF]");

    // More efficient version extraction
    const versionAdded = comment.match(/\[FF(\d+)\+\]/)?.[1];
    const versionRemoved = comment.match(/\[FF(\d+)-\]/)?.[1];

    result.push({
      key,
      value,
      versionAdded,
      versionRemoved,
      custom,
      hidden,
    });
  }

  return result;
};
