interface PrefInfo {
  key: string;
  value: string;
  versionAdded?: string;
  versionRemoved?: string;
  custom: boolean;
  hidden: boolean;
}

export const parseUserPrefs = (content: string): PrefInfo[] => {
  const result: PrefInfo[] = [];

  const regex =
    /user_pref\(\s*['"]([^'"]+)['"]\s*,\s*([\s\S]*?)\s*\)(?:;\s*\/\/\s*(.*))?/gm;

  for (const match of content.matchAll(regex)) {
    const key = match[1];
    const value = match[2];
    const comment = match[3] || "";

    const custom = /\[CUSTOM PREF\]/i.test(comment);
    const hidden = /\[HIDDEN PREF\]/i.test(comment);

    const versionAddedMatch = comment.match(/\[FF(\d+)\+\]/);
    const versionRemovedMatch = comment.match(/\[FF(\d+)-\]/);

    const versionAdded = versionAddedMatch ? versionAddedMatch[1] : undefined;
    const versionRemoved = versionRemovedMatch
      ? versionRemovedMatch[1]
      : undefined;

    result.push({ key, value, versionAdded, versionRemoved, custom, hidden });
  }

  return result;
};
