export const startsWithNumberDotNumber = (str: string): boolean => {
  const parts = str.split(".");

  if (parts.length < 2) {
    return false;
  }

  const first = parts[0];
  const second = parts[1];

  if (!first || isNaN(Number(first)) || !/^\d+$/.test(first)) {
    return false;
  }
  if (!second || isNaN(Number(second[0]))) {
    return false;
  }

  return true;
};

export const gettingPrefsMessage = "Getting prefs...";
export const gettingVersionMessage = "Getting firefox version...";

export const isUnitDifferenceOne = (a: string, b: string): boolean => {
  const unitA = Math.floor(parseFloat(a));
  const unitB = Math.floor(parseFloat(b));
  return Math.abs(unitA - unitB) === 1;
};
