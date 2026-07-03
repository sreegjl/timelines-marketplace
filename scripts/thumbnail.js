const fs = require("fs");
const path = require("path");

const WIDTH = 410;
const HEIGHT = 160;
const SWATCH_H = 38.24;
const SWATCH_KEYS = ["text-primary", "ui-muted", "accent-color", "surface", "inset-bg"];
const FONT_SIZES = {
  collection: 17,
  title: 46,
  subtitle: 17,
};
const MIN_FONT_SIZES = {
  collection: 12,
  title: 16,
  subtitle: 11,
};

function buildHtml(theme) {
  const c = theme.colors;
  const title = theme.name.toLowerCase();
  const showCollection = Boolean(theme.collection) && theme.collection.toLowerCase() !== "featured";
  const collection = showCollection ? theme.collection.toLowerCase() : "";
  const subtitle = `by ${theme.author}`;
  const fontFamily = theme.font?.family ?? "Inter";
  const cssUrl = theme.font?.cssUrl ?? "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap";

  const swatchCss = SWATCH_KEYS.map((key, i) =>
    `.swatch:nth-child(${i + 1}) { background: ${c[key]}; }`
  ).join("\n    ");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${cssUrl}" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    background: ${c["app-bg"]};
    font-family: '${fontFamily}', sans-serif;
    overflow: hidden;
  }
  .text-block {
    position: absolute;
    left: 24px;
    top: 50%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    transform: translateY(calc(-50% - ${SWATCH_H / 2}px));
  }
  .collection {
    display: block;
    color: ${c["ui-muted"]};
    font-size: ${FONT_SIZES.collection}px;
    font-weight: 900;
    letter-spacing: 0.1em;
    line-height: 0.95;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .title {
    display: block;
    color: ${c["text-primary"]};
    font-size: ${FONT_SIZES.title}px;
    font-weight: 900;
    line-height: 0.95;
    white-space: nowrap;
  }
  .subtitle {
    display: block;
    color: ${c["text-primary"]};
    font-size: ${FONT_SIZES.subtitle}px;
    font-weight: 900;
    line-height: 0.95;
    white-space: nowrap;
  }
  .swatches {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: ${SWATCH_H}px;
    display: flex;
  }
  .swatch { flex: 1; }
  ${swatchCss}
</style>
</head>
<body>
  <div class="text-block">
    ${showCollection ? `<span class="collection">${collection}</span>` : ""}
    <span class="title">${title}</span>
    <span class="subtitle">${subtitle}</span>
  </div>
  <div class="swatches">
    ${SWATCH_KEYS.map(() => `<div class="swatch"></div>`).join("\n    ")}
  </div>
</body>
</html>`;
}

async function renderThumbnail(theme, outPath, page) {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.setContent(buildHtml(theme), { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }
  });
  await page.evaluate(({ maxWidth, minSizes }) => {
    const selectors = [".collection", ".title", ".subtitle"];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > maxWidth && size > minSizes[selector]) {
        size -= 0.5;
        el.style.fontSize = size + "px";
      }
    }
  }, {
    maxWidth: WIDTH - 2 * 24,
    minSizes: {
      ".collection": MIN_FONT_SIZES.collection,
      ".title": MIN_FONT_SIZES.title,
      ".subtitle": MIN_FONT_SIZES.subtitle,
    },
  });
  await page.screenshot({ path: outPath });
}

async function generatePreview(page, thumbPaths, outPath) {
  const cols = 4;
  const bg = "#111111";

  const images = thumbPaths.map(p => {
    const data = fs.readFileSync(p).toString("base64");
    return `data:image/png;base64,${data}`;
  });

  const thumbW = WIDTH / 2;
  const thumbH = HEIGHT / 2;
  const rows = Math.ceil(images.length / cols);
  const totalW = cols * thumbW;
  const totalH = rows * thumbH;

  const imgTags = images.map(src =>
    `<img src="${src}" width="${thumbW}" height="${thumbH}" style="display:block;">`
  ).join("\n    ");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${totalW}px;
    height: ${totalH}px;
    background: ${bg};
    display: grid;
    grid-template-columns: repeat(${cols}, ${thumbW}px);
  }
</style>
</head>
<body>
  ${imgTags}
</body>
</html>`;

  await page.setViewportSize({ width: totalW, height: totalH });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: outPath });
}

module.exports = { renderThumbnail, generatePreview };
