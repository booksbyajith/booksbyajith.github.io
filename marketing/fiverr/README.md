# Fiverr portfolio thumbnail

- `thumbnail.html`: the design (1024x768; screenshot embedded; only Google Fonts load from outside).
- `thumbnail.png` (1024x768) and `thumbnail@2x.png` (2048x1536): rendered with Playwright.
- `screen.png`: real capture of the order form's payment step (iPhone 13 size, demo data from the
  local emulators: "Demo Bank", fictional customer).

Recreate: `bash marketing/fiverr/run-capture.sh` (build, seed demo data, capture `screen.png`),
then update the embedded image in `thumbnail.html` and run `node marketing/fiverr/render.mjs`.
