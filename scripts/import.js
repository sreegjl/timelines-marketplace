const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { renderThumbnail, generatePreview } = require("./thumbnail");

const ROOT = path.resolve(__dirname, "..");
const INBOX_DIR = path.join(ROOT, "inbox");
const THEMES_DIR = path.join(ROOT, "themes");
const INDEX_FILE = path.join(ROOT, "index.json");

const REQUIRED_COLORS = ["app-bg", "text-primary", "ui-muted", "accent-color", "surface", "inset-bg"];

function toId(filename) {
  return path.basename(filename, ".json")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function validate(theme, file) {
  const missing = [];
  if (!theme.name) missing.push("name");
  if (!theme.author) missing.push("author");
  for (const key of REQUIRED_COLORS) {
    if (!theme.colors?.[key]) missing.push(`colors.${key}`);
  }
  if (missing.length) throw new Error(`${file}: missing fields: ${missing.join(", ")}`);
}

async function main() {
  fs.mkdirSync(INBOX_DIR, { recursive: true });

  const files = fs.readdirSync(INBOX_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("inbox/ is empty — drop theme JSON files there and re-run.");
    return;
  }

  const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const file of files) {
    const inboxPath = path.join(INBOX_DIR, file);
    let theme;
    try {
      theme = JSON.parse(fs.readFileSync(inboxPath, "utf8"));
      validate(theme, file);
    } catch (err) {
      console.error(`skipping ${file}: ${err.message}`);
      continue;
    }

    const id = toId(file);
    const themeDir = path.join(THEMES_DIR, id);
    const themeFile = path.join(themeDir, `${id}.json`);
    const thumbFile = path.join(themeDir, "thumbnail.png");

    fs.mkdirSync(themeDir, { recursive: true });
    fs.copyFileSync(inboxPath, themeFile);

    await renderThumbnail(theme, thumbFile, page);
    console.log(`  thumbnail → themes/${id}/thumbnail.png`);

    const exists = index.themes.some(t => t.id === id);
    if (!exists) {
      index.themes.push({
        id,
        name: theme.name,
        author: theme.author,
        collection: theme.collection ?? null,
        description: "",
        paths: {
          theme: `themes/${id}/${id}.json`,
          thumbnail: `themes/${id}/thumbnail.png`,
        },
      });
      console.log(`  added "${theme.name}" to index.json`);
    } else {
      console.log(`  "${id}" already in index.json — skipped index update`);
    }

    fs.unlinkSync(inboxPath);
    console.log(`imported ${file} → themes/${id}/`);
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + "\n", "utf8");

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
