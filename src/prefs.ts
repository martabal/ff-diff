import { Pref } from "./firefox";

export interface UserPref {
  key: string;
  value: Pref;
}

interface Default {
  version?: number;
  value: Pref;
}

interface PrefInfo extends UserPref {
  versionAdded?: string;
  versionRemoved?: string;
  custom: boolean;
  hidden: boolean;
  default?: Default;
}

const parseValue = (rawValue: string): Pref => {
  const trimmed = rawValue.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if ((first === '"' || first === "'") && first === last) {
    return trimmed.slice(1, -1);
  }

  return Number(trimmed);
};

const parseDefaultValue = (comment: string): Default | undefined => {
  const match = comment.match(/\[DEFAULT:\s*([^[\]]+?)(\s+FF(\d+)\+)?\]/);
  if (!match) return undefined;

  const parsed = parseValue(match[1]);
  if (isNaN(Number(parsed)) && typeof parsed === "number") return undefined;

  return {
    value: parsed,
    ...(match[3] && { version: Number(match[3]) }),
  };
};

export const parseUserPrefs = (content: string): PrefInfo[] => {
  const regex =
    /user_pref\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]*?)\s*\)(?:;\s*\/\/\s*(.*))?/gm;
  const result: PrefInfo[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const [, key, rawValue, comment = ""] = match;

    const pref: PrefInfo = {
      key,
      value: parseValue(rawValue),
      versionAdded: comment.match(/\[FF(\d+)\+\]/)?.[1],
      versionRemoved: comment.match(/\[FF(\d+)-\]/)?.[1],
      custom: comment.includes("[CUSTOM PREF]"),
      hidden: comment.includes("[HIDDEN PREF]"),
    };

    const defaultValue = parseDefaultValue(comment);
    if (defaultValue !== undefined) {
      pref.default = defaultValue;
    }

    result.push(pref);
  }

  return result;
};
