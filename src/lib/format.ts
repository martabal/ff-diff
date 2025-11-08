import {
  type FirefoxChangedPref,
  type FirefoxPref,
  type Pref,
} from "$lib/firefox";

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

interface Ticks {
  tickStart: string;
  tickSymbol?: string;
  tickKeyValue: Pref;
  tickTransform: string;
}

export interface AllFormatted extends Ticks {
  tickSymbol: string;
}

export const formatTicks: Record<Format, Ticks> = {
  [Format.Markdown]: {
    tickStart: "",
    tickSymbol: "-",
    tickKeyValue: "`",
    tickTransform: "&rarr;",
  },
  [Format.Text]: {
    tickStart: " ",
    tickSymbol: undefined,
    tickKeyValue: "",
    tickTransform: "->",
  },
};
