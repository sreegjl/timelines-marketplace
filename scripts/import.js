const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { renderThumbnail, generatePreview } = require("./thumbnail");
const { decodeJsonBuffer } = require("./json-encoding");

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

  const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8").replace(/^﻿/, ""));

  const before = index.themes.length;
  index.themes = index.themes.filter(t => {
    const themeDir = path.join(THEMES_DIR, t.id);
    if (!fs.existsSync(themeDir)) {
      console.log(`removed "${t.id}" from index — folder missing`);
      return false;
    }
    return true;
  });
  const removed = index.themes.length < before;
  if (removed) {
    fs.writeFileSync(INDEX_FILE, Buffer.from(JSON.stringify(index, null, 2) + "\n", "utf8"));
  }

  if (files.length === 0 && !removed) {
    console.log("nothing to do — inbox is empty and index is clean.");
    return;
  }

  for (const entry of index.themes) delete entry.new;

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();

  for (const file of files) {
    const inboxPath = path.join(INBOX_DIR, file);
    let theme;
    let encoding;
    try {
      ({ value: theme, encoding } = decodeJsonBuffer(fs.readFileSync(inboxPath)));
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
    fs.writeFileSync(themeFile, JSON.stringify(theme, null, 2) + "\n", "utf8");
    if (encoding !== "UTF-8") {
      console.log(`  converted ${encoding} → UTF-8`);
    }

    await renderThumbnail(theme, thumbFile, page);
    console.log(`  thumbnail → themes/${id}/thumbnail.png`);

    const exists = index.themes.some(t => t.id === id);
    if (!exists) {
      index.themes.push({
        id,
        name: theme.name,
        author: theme.author,
        collection: theme.collection ?? null,
        type: theme.type ?? "light",
        new: true,
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

  fs.writeFileSync(INDEX_FILE, Buffer.from(JSON.stringify(index, null, 2) + "\n", "utf8"));

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
