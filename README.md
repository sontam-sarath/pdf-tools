# PDF Merge — Browser-native

A fully static PDF merger that runs entirely in your browser. No server, no database, no uploads to any cloud. Files are processed locally using [pdf-lib](https://pdf-lib.js.org/) and merged PDFs are saved to your browser's IndexedDB.

## Features

- **Drag & drop** PDF files to upload
- **Drag to reorder** files before merging
- **Merge** any number of PDFs into one
- **History tab** — re-download past merges (stored in IndexedDB)
- **100% offline** after first load — no data leaves your device

## Stack

| Layer | Library |
|---|---|
| UI interactions | [HTMX](https://htmx.org/) |
| PDF processing | [pdf-lib](https://pdf-lib.js.org/) |
| Storage | Browser IndexedDB (no backend) |
| Hosting | GitHub Pages (static) |

## Deploy to GitHub Pages

1. **Fork or clone** this repo
2. Push to `main`
3. Go to **Settings → Pages**
4. Set **Source** to `GitHub Actions`
5. The workflow in `.github/workflows/deploy.yml` will auto-deploy on every push

Your site will be live at `https://<your-username>.github.io/<repo-name>/`

## Local development

No build step needed — just open `index.html` in a browser:

```bash
# Option 1: Python
python -m http.server 8080

# Option 2: Node
npx serve .

# Option 3: VS Code Live Server extension
```

Then visit `http://localhost:8080`

## Project structure

```
├── index.html          # App shell + HTMX
├── style.css           # All styles
├── app.js              # File handling, drag/drop, merge logic
├── db.js               # IndexedDB wrapper
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Pages deployment
```
