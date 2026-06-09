# ReadAway

**Own your books. Own your progress.**

A private EPUB reader for public domain books, delivered as a Progressive Web App.

ReadAway lets you import EPUBs from [Standard Ebooks](https://standardebooks.org/) and [Project Gutenberg](https://www.gutenberg.org/), read them in a distraction-free reader, and manage your library — all without accounts, cloud sync, or tracking.

---

## Features

- 📖 Distraction-free EPUB reader with pagination
- 📚 Library with "Continue Reading" and book grid
- 🌗 Light, Dark, and Black themes
- 🔤 Adjustable font size
- 📑 Table of contents with chapter navigation
- 📦 Back up and restore your library as `.raway` archives
- 📱 Install as a PWA for offline reading
- 🔒 Fully private — everything stays on your device

---

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Building

```bash
npm run build
npm run preview
```

---

## Supported Books

ReadAway MVP supports EPUB files from:

- [Standard Ebooks](https://standardebooks.org/)
- [Project Gutenberg](https://www.gutenberg.org/)

Other EPUB files are not supported in this version.

---

## Tech Stack

React · TypeScript · Vite · epub.js · Dexie (IndexedDB) · PWA

---

## Project Documentation

- [Product Requirements](docs/PRD.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Screen Specification](docs/SCREEN_SPEC.md)

---

## License

MIT
