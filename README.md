![Banner](docs/banner.png)

## Adding a theme

Submit your theme `.json` file by either:

- Forking the repo and opening a pull request (see steps below), or
- Emailing it to [sreegjl@gmail.com](mailto:sreegjl@gmail.com)

See the [theme documentation](https://github.com/sreegjl/timelines/wiki/Themes) for the full JSON format.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)

### Steps

1. Fork and clone this repo
2. Install dependencies:
   ```
   npm install
   ```
3. Drop your theme `.json` file(s) into the `inbox/` folder
4. Run the import script:
   ```
   node scripts/import.js
   ```
   This will:
   - Create `themes/<id>/` with your theme JSON and a generated thumbnail
   - Add your theme to `index.json`
   - Update `docs/preview.png`
   - Remove any `index.json` entries whose `themes/` folder no longer exists

5. Open a pull request with the changes

## Regenerating thumbnails

To regenerate thumbnails for all existing themes and update `docs/preview.png`:

```
node scripts/generate_thumbnails.js
```

To regenerate a single theme:

```
node scripts/generate_thumbnails.js --theme <id>
```

![Preview](docs/preview.png)
