# ff-diff

`ff-diff` is a CLI to compare changes in user preference between two versions of Firefox without messing with your firefox instance.

Features:

- Compares user.js files from two specified Firefox versions
- Automatically downloads official Firefox binaries
- Highlights differences without requiring a local Firefox installation
- Detect and identify changes required in your `user.js`

Requirements:

- Internet connection (for downloading Firefox binaries, only for the diff command)
- node >= 20 and pnpm
- tar (only for the diff command)

## Installation (pnpm)

```bash
pnpm i -g ff-diff
```

## Usage

<!--- Begin usage -->

```bash
$ ff-diff
Usage:
  ff-diff clean [--keep version1,version2] [--keep-archives] [--keep-sources]
  ff-diff diff <old-version> <new-version> [--clean-archives] [--clean-sources] [--do-not-print-in-console] [--save-output-in-file] [--compare-userjs path] [--hide-common-changed-values]
  ff-diff default-prefs [--do-not-print-in-console] [--save-output-in-file] [--firefox-path path]
  ff-diff unused-prefs-userjs path [--firefox-path path] [--force-default-profile] [--profile-path] [--firefox-version version]
  ff-diff default-prefs-userjs path [--firefox-path path] [--do-not-print-in-console] [--save-output-in-file] [--force-default-profile] [--profile-path] [--firefox-version version]

Options:
  -v, --version    Print version info and exit
  -h, --help       Print help
```

<!--- End usage -->

Example:

```bash
ff-diff diff 137.0 138.0
```

## Develop

Clone this repository:

```bash
git clone https://github.com/martabal/ff-diff.git
cd ff-diff
pnpm install --frozen-lockfile
```

## Commands

### diff

Run the comparison command:

```bash
pnpm run ff-diff diff <old-version> <new-version>
```

for example:

```bash
pnpm run ff-diff diff 137.0 138.0
```

If you use a custom `user.js`. You can check if some of the keys are removed/changed with the argument `--compare-userjs <path_to_your_userjs>`.

> [!NOTE]  
> The script may take some time to run depending on your connection speed.

Example of a generated diffs:

![Image of the example](https://raw.githubusercontent.com/martabal/ff-diff/refs/heads/main/images/diffs-example.png)

### clean

When running the script in development mode with `pnpm run dev`, Firefox sources and binaries are saved in the current directory.
In production mode (i.e., when the script is installed globally using `pnpm i -g ff-diff`), these files are stored in `~/.ff-diff`.

By default, the script keep both the downloaded archives and the extracted source files. To remove them, you can run the script with the `--remove-archives` and/or `--remove-sources` arguments. If you want to use specific version you can use:

```bash
pnpm run ff-diff clean --keep <version1>,<version2>
```

If you want to only keep archives you can use `pnpm run clean -- --keep <version1>,<version2> --keep-archives` or `pnpm run clean -- --keep <version1>,<version2> --keep-sources` if you want to keep the sources

### default-prefs

Get all the default prefs from your firefox instance. You can specify the executable path with `--firefox-path path` and save the output in `.ff-diff/default/<version>-user.js` if you add the argument `--save-output-in-file`.

### unused-prefs-userjs

The first argument is the path to your `user.js`. It will detect all prefs set in your firefox instance which are not used anymore. You can specify the executable path with `--firefox-path path`. If you add a comment next to your `user_pref()` entry like `// [CUSTOM PREF]` or the version the pref has been removed like `// [FF136-]`, `ff-diff` won't identify that entry as a default entry.

### default-prefs-userjs

The first argument is the path to your `user.js`. It will detect all prefs set in your firefox instance which are already the defaults. You can specify the executable path with `--firefox-path path`. If you add a comment next to your `user_pref()` entry like `// [DEFAULT: false]` or `// [DEFAULT: true FF141+]` (with or without the version), `ff-diff` won't identify that entry as a default entry.
