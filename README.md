# ff-diff

`ff-diff` is a simple node script to compare changes in user.js preference files between two versions of Firefox. You don't need to mess with your firefox instance.

Features:

- Compares user.js files from two specified Firefox versions
- Automatically downloads official Firefox binaries
- Highlights differences without requiring a local Firefox installation

Requirements:

- Internet connection (for downloading Firefox binaries)
- node >= 22 and npm
- tar

## Usage

Clone this repository:

```bash
git clone https://github.com/martabal/ff-diff.git
cd ff-diff
npm ci
```

Run the comparison script:

```bash
npm run ff-diff <version1> <version2>
```

for example:

```bash
npm run ff-diff 137.0 138.0
```

If you use a custom `user.js`. You can check if some of the keys are removed/changed with the argument `--compare-userjs <path_to_your_userjs>`.

## Clean

The Firefox sources will be downloaded into the `dist/` directory. By default, the script keeps the archives and the sources extracted from the archives. If you want to remove them, you can execute the script with the `--remove-archives` `--remove-sources` arguments. But you can also use the script `npm run clean` to delete all archives and sources in `dist/`. If you want to use specific version you can use:

```bash
npm run ff-diff clean -- --keep <version1>,<version2>
```

If you want to only keep archives you can use `npm run clean -- --keep <version1>,<version2> --keep-archives` or `npm run clean -- --keep <version1>,<version2> --keep-sources` if you want to keep the sources

> [!NOTE]  
> The script may take some time to run depending on your connection speed.

Example of a generated diffs:

![Image of the example](https://raw.githubusercontent.com/martabal/ff-diff/refs/heads/main/images/diffs-example.png)
