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
