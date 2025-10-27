release:
        git-cliff -l | wl-copy

update-corepack:
        corepack use pnpm@latest
