# ff-diff

`ff-diff` is a simple node script to compare changes in user.js preference files between two versions of Firefox. You don't need to mess with your firefox instance.

Features:

- Compares user.js files from two specified Firefox versions
- Automatically downloads official Firefox binaries
- Highlights differences without requiring a local Firefox installation

Requirements:

- Internet connection (for downloading Firefox binaries)
- node >= 20 and npm
- tar

## Installation (NPM)

```bash
npm i -g ff-diff
```

## Usage

```bash
$ ff-diff
Usage:
  ff-diff clean [--keep version1,version2] [--keep-archives] [--keep-sources]
  ff-diff diff <old-version> <new-version> [--clean-archives] [--clean-sources] [--do-not-print-diffs-in-console] [-o,--output] [--compare-userjs path]
  ff-diff unused-prefs <path> [--firefox-path path]
  ff-diff default-prefs [--firefox-path path] [--do-not-print-diffs-in-console] [-o,--output]

Options:
  -v, --version        Print version info and exit
  -h, --help           Print help
```

Example:

```bash
ff-diff diff 137.0 138.0
```

## Develop

Clone this repository:

```bash
git clone https://github.com/martabal/ff-diff.git
cd ff-diff
npm ci
```

Run the comparison script:

```bash
npm run ff-diff diff <old-version> <new-version>
```

for example:

```bash
npm run ff-diff diff 137.0 138.0
```

If you use a custom `user.js`. You can check if some of the keys are removed/changed with the argument `--compare-userjs <path_to_your_userjs>`.

## Clean

When running the script in development mode with `npm run dev`, Firefox sources and binaries are saved in the current directory.
In production mode (i.e., when the script is installed globally using `npm i -g ff-diff`), these files are stored in `~/.ff-diff`.

By default, the script keep both the downloaded archives and the extracted source files. To remove them, you can run the script with the `--remove-archives` and/or `--remove-sources` arguments. If you want to use specific version you can use:

```bash
npm run ff-diff clean -- --keep <version1>,<version2>
```

If you want to only keep archives you can use `npm run clean -- --keep <version1>,<version2> --keep-archives` or `npm run clean -- --keep <version1>,<version2> --keep-sources` if you want to keep the sources

## Compare user.js

If you want to check if some of your prefs from a `user.js` file are unused, you can use `npm run ff-diff -- unused-prefs --compare-userjs <path>`

> [!NOTE]  
> The script may take some time to run depending on your connection speed.

Example of a generated diffs:

![Image of the example](https://raw.githubusercontent.com/martabal/ff-diff/refs/heads/main/images/diffs-example.png)
`
