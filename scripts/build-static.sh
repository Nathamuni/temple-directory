#!/usr/bin/env bash
#
# Build the read-only public site as a static export, then zip it for a
# drag-and-drop deploy to Netlify (or any static host).
#
# The directory's editorial half — login, /contribute, /status, the admin
# screens and every /api route — reads a session cookie and writes JSON files
# to disk. Neither works on a static host, and their presence alone fails
# `output: "export"`. So they are moved out of src/app for the duration of the
# build and moved back afterwards, including on failure or Ctrl-C.
#
# Output: out/ and temple-directory-static.zip
set -euo pipefail

cd "$(dirname "$0")/.."

STASH=".static-build-stash"
ROUTES=(api admin contribute login my-submissions request-access status signup apply account "temple/[slug]/propose" "temple/[slug]/suggest")

restore() {
  if [ -d "$STASH" ]; then
    for route in "${ROUTES[@]}"; do
      [ -e "$STASH/$route" ] && mv "$STASH/$route" "src/app/$route"
    done
    find "$STASH" -depth -type d -empty -delete 2>/dev/null
    [ ! -d "$STASH" ] || echo "note: $STASH is not empty — check it before rebuilding"
  fi
}
trap restore EXIT INT TERM

if [ -d "$STASH" ]; then
  echo "error: $STASH already exists — a previous build was interrupted."
  echo "Move its contents back into src/app/ by hand, then re-run."
  exit 1
fi

mkdir "$STASH"
for route in "${ROUTES[@]}"; do
  if [ -e "src/app/$route" ]; then
    mkdir -p "$(dirname "$STASH/$route")"
    mv "src/app/$route" "$STASH/$route"
  fi
done

echo "Building static export (editorial routes excluded)..."
rm -rf out
STATIC_EXPORT=1 npx next build

# Netlify serves a drag-and-drop zip from its root, so the archive must contain
# the contents of out/, not the out/ directory itself.
rm -f temple-directory-static.zip
( cd out && zip -qr ../temple-directory-static.zip . -x '.DS_Store' )

echo
echo "Done."
echo "  Folder: out/"
echo "  Zip:    temple-directory-static.zip  ($(du -h temple-directory-static.zip | cut -f1))"
echo "  Pages:  $(find out -name 'index.html' | wc -l | tr -d ' ')"
