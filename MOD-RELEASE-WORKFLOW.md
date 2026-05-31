# GitHub Actions release workflow for the Lua mod

When you flip the mod repo public, drop this workflow file in to get automatic GitHub Releases on tag pushes. Players download the zip directly from the Releases page.

## How releases will work after this

1. You edit the mod code locally, commit, push.
2. When you want to release: `git tag v1.0.0 && git push --tags`
3. GitHub Actions builds a zip (`balatro-league-mod-v1.0.0.zip`), creates a Release with that tag, attaches the zip.
4. Players download from `https://github.com/<you>/<mod-repo>/releases/latest`

You can also draft releases manually from the GitHub UI; the workflow only fires on tag push.

## Setup

In your mod repo (the now-public one), create the file `.github/workflows/release.yml` with the contents in the next section. Push to default branch. That's it — no secrets to configure, GitHub provides the `GITHUB_TOKEN` automatically.

## release.yml

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'   # any tag starting with v: v1.0.0, v0.2.3, etc.

permissions:
  contents: write   # needed to create releases

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get version from tag
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/}" >> "$GITHUB_OUTPUT"

      # Adjust the source paths if your mod files live in a subdirectory.
      # As-written, this zips the whole repo minus .git and the workflow files.
      - name: Build mod zip
        run: |
          mkdir -p dist
          zip -r "dist/balatro-league-mod-${{ steps.version.outputs.version }}.zip" . \
            -x ".git/*" ".github/*" "dist/*" "README.md" "LICENSE"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: dist/*.zip
          generate_release_notes: true
          draft: false
          prerelease: ${{ contains(steps.version.outputs.version, '-') }}
```

## Cutting your first release

```bash
# In your mod repo
git tag v0.1.0 -m "Initial public release"
git push origin v0.1.0
```

Watch the Actions tab; should be green in <1 minute. Releases tab will show the new release with `balatro-league-mod-v0.1.0.zip` attached.

For prereleases (alpha/beta), tag with a hyphen: `v0.2.0-beta1` → automatically marked as prerelease.

## Things to consider

- **What gets zipped**: the `-x` flags exclude `.git`, `.github`, the build output itself, and the README. Adjust to your repo shape — if the mod is in a `src/` or `mod/` subdirectory, change the zip command to just `zip -r dist/...zip mod/`.
- **README**: keep it in the repo root (not in the zip) so it shows on the GitHub repo page. Players see it before they download.
- **CHANGELOG**: `generate_release_notes: true` auto-builds release notes from PRs/commits since the last tag. If you write commits well it's good enough on its own.
- **Lua dependencies**: if your mod uses an external Lua module (Steamodded etc.), don't ship a vendored copy — link to the dep in the README. Or vendor it explicitly if license requires.
