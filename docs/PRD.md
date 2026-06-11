# ReadAway MVP PRD (Feature Locked)

## Product

**Name:** ReadAway

**Tagline:** Own your books. Own your progress.

---

# Vision

ReadAway is a private EPUB reader delivered as a Progressive Web App.

It provides a polished reading experience focused on public domain books while preserving user ownership and privacy.

Users can install ReadAway from the browser, read offline, and manage their own library without creating an account.

The MVP focuses exclusively on books from Standard Ebooks and Project Gutenberg.

---

# Platform

Progressive Web App (PWA)

Supported environments:

* Desktop browsers
* Android browsers
* iOS Safari (Add to Home Screen)

The installed PWA experience is considered first-class.

---

# Tech Stack

* React
* TypeScript
* Vite
* epub.js
* Dexie (IndexedDB)
* Vite PWA Plugin

---

# Supported Books

ReadAway MVP supports EPUB files originating from:

* Standard Ebooks
* Project Gutenberg

All other EPUB files are rejected.

Unsupported EPUB message:

> This version of ReadAway currently supports EPUB books from Standard Ebooks and Project Gutenberg only.

---

# Import Flow

```text
Select EPUB
↓
Validate source
↓
Generate book identity
↓
Copy EPUB into browser-managed storage
↓
Extract metadata and cover
↓
Add to library
```

Original EPUB files are never used after import.

---

# Book Identity

Each book has two identifiers.

## Sync Identity

Used to identify the book.

```ts
syncKey = source + ":" + sourceId
```

Examples:

```text
standardebooks:bram-stoker/dracula
gutenberg:10007
```

Books with identical sync keys are treated as the same book.

## Edition Identity

Used to identify the exact EPUB version.

```ts
editionHash = SHA256(epub bytes)
```

This is not used as the primary identity.

---

# Browser Storage

Imported EPUBs are copied into browser-managed storage.

ReadAway uses:

* IndexedDB for metadata and progress.
* OPFS (Origin Private File System) for EPUB files when available.
* IndexedDB for installed dictionary indexes.

If OPFS is unavailable, EPUBs may be stored using IndexedDB.

The original imported file is never used after import.

---

# Library

Features:

* View imported books
* Continue Reading section
* Display cover
* Display title
* Display author
* Display reading progress

No search.

No collections.

No sorting customization.

---

# Reader

Features:

* EPUB rendering
* Pagination
* Previous page
* Next page
* Stable whole-book page number
* Pages left in the current chapter
* Table of contents
* Chapter navigation
* Full screen reading when supported by the browser
* Adjustable font size
* Single-column and two-column layout on eligible screens
* English dictionary lookup from selected words
* Resume reading automatically

The single-column reader uses a fixed, comfortable text width. User-adjustable
margin controls are intentionally omitted for the MVP.

Two-column layout is available only when the reader surface is at least 840 CSS
pixels wide and 480 CSS pixels tall. If the user has
selected two columns and the screen becomes ineligible, ReadAway temporarily
renders single column without overwriting the saved preference.

Progress is saved:

* On page changes
* When the application backgrounds
* Before the browser tab closes

---

# Dictionary

ReadAway supports one English monolingual dictionary for the first dictionary
release.

Dictionary requirements:

* Source data is Open English WordNet.
* Dictionary data is packaged into a ReadAway-owned `.rawaydict` static asset.
* Users explicitly download/install the dictionary from ReadAway.
* Manual dictionary file import is not supported.
* Dictionary lookup works offline after installation.
* Dictionary data is stored separately from books and reading progress.
* Dictionary data is not included in `.raway` library backups.
* Attribution and license information are visible in Settings.

Lookup behavior:

* User selects a word in the reader.
* ReadAway normalizes the selected word.
* ReadAway first checks exact dictionary entries.
* If no exact entry exists, ReadAway checks a generated form map.
* If no form-map entry exists, ReadAway applies conservative local
  lemmatization rules.
* If no definition is found, ReadAway shows a clear no-definition state.

If no dictionary is installed, selecting a word may show a dismissible prompt to
download the English dictionary for offline lookup.

---

# Page Colors

Reader page color is separate from the application theme.

Three page colors:

## Light

Warm paper.

```text
#FAF8F2
```

## Dark

Charcoal.

```text
#1C1C1E
```

## Black

Pure black.

```text
#000000
```

Page color selection is remembered.

Default behavior:

* System Light → Light
* System Dark → Dark

Black is manually selected.

---

# App Theme

The application shell supports:

* System
* Light
* Dark

Default behavior:

* App theme defaults to System.
* System Light resolves to Light.
* System Dark resolves to Dark.

The app theme applies to library, settings, backup, restore, and import screens.
It does not override the reader page color.

---

# Design System

ReadAway uses the **freeCodeCamp Command-line Chic** design language.

## Visual Identity

ReadAway is a freeCodeCamp-aligned offline reader for public-domain books,
with local ownership, private progress, and a developer-tool-inspired
interface.

## App Theme: Dark-First

The default unresolved app shell is dark. The Command-line Chic dark palette
is the primary designed experience. Light mode is supported via mirrored
semantic tokens and must maintain equivalent contrast.

```text
App theme: dark (default, user-configurable)
Reader page color: user preference (independent of app theme)
```

## Design Tokens

All application UI uses fCC semantic color tokens defined in `src/index.css`.
Hardcoded hex or rgba colors are not permitted in component CSS except for
the documented reader page colors (light `#FAF8F2`, dark `#1C1C1E`, black
`#000000`) which are user reading preferences, not app chrome.

## Semantic Accent Roles

| Accent | Role |
|--------|------|
| Yellow | Primary actions, CTAs |
| Blue   | Links, interactive states, selected controls |
| Green  | Success, completed, installed states |
| Red    | Errors, destructive actions, failed states |
| Purple | Rare emphasis or developer metadata |

## Typography

* App base font size: 18px (16px on viewports below 500px).
* App body font: Lato if bundled locally; otherwise system sans-serif.
* Technical labels: Hack-ZeroSlash if bundled locally; otherwise Fira Mono,
  Menlo, Consolas, monospace.
* EPUB content typography is controlled by reader appearance settings and
  epub.js themes, not by the app chrome.

---

# Offline Support

ReadAway is installable as a PWA.

Requirements:

* Core application shell available offline.
* Previously imported books available offline.
* Reading progress preserved offline.
* Installed dictionaries available offline.

---

# Library Backup

Users can back up selected books from Settings.

Backup flow:

```text
Settings
↓
Select books
↓
Generate backup
↓
Save or share
```

Users can:

* Select individual books
* Select multiple books
* Select all books

Books, reading progress, and timestamps are always included together.

---

# Library Restore

ReadAway restores its own archive format.

Restore flow:

```text
Select .raway archive
↓
Preview contents and local conflicts
↓
Select books
↓
Restore
```

Restored books are copied into browser-managed storage.

Each selected book is restored as a snapshot: EPUB file, metadata, reading
progress, and timestamps are imported together.

If this device has newer progress than the backup for a book, that book is
unchecked by default and clearly marked in the preview.

---

# Archive Format

Extension:

```text
.raway
```

Structure:

```text
manifest.json

books/

progress/
```

The archive contains:

* EPUB files
* Metadata
* Reading progress
* Snapshot timestamps

---

# Installation Experience

ReadAway may prompt users to install the application as a PWA.

Requirements:

* Never blocks reading.
* Dismissible.
* Never shown more than once per session.

---

# Feature Lock

The following are explicitly out of scope for the MVP:

* Arbitrary EPUB support
* PDF support
* MOBI support
* Highlights
* Notes
* Text-to-speech
* Social features
* Accounts
* Cloud synchronization
* Book purchasing
* Book stores
* Onboarding tutorials
* Reading statistics
* Cross-device synchronization

If a feature is not listed in this document, it is not part of the MVP.
