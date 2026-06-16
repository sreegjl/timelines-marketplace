const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { renderThumbnail, generatePreview } = require("./thumbnail");

const ROOT = path.resolve(__dirname, "..");
const THEMES_DIR = path.join(ROOT, "themes");

async function main() {
  const args = process.argv.slice(2);
  const themeIdx = args.indexOf("--theme");
  const filterThemes = themeIdx >= 0 ? args.slice(themeIdx + 1).filter(a => !a.startsWith("--")) : null;

  const themeDirs = fs.readdirSync(THEMES_DIR)
    .filter(name => fs.statSync(path.join(THEMES_DIR, name)).isDirectory())
    .filter(name => !filterThemes || filterThemes.includes(name))
    .sort();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const id of themeDirs) {
    const themeFile = path.join(THEMES_DIR, id, `${id}.json`);
    if (!fs.existsSync(themeFile)) continue;

    const theme = JSON.parse(fs.readFileSync(themeFile, "utf8"));
    const outPath = path.join(THEMES_DIR, id, "thumbnail.png");
    await renderThumbnail(theme, outPath, page);
    console.log(`wrote ${outPath}`);
  }

  const allThumbPaths = fs.readdirSync(THEMES_DIR)
    .filter(name => fs.statSync(path.join(THEMES_DIR, name)).isDirectory())
    .sort()
    .map(name => path.join(THEMES_DIR, name, "thumbnail.png"))
    .filter(p => fs.existsSync(p));

  const previewPath = path.join(ROOT, "docs", "preview.png");
  await generatePreview(page, allThumbPaths, previewPath);
  console.log(`wrote ${previewPath}`);

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
