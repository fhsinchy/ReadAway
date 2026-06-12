# ReadAway MVP Architecture & Implementation Guide

This document defines how ReadAway MVP must be implemented.

Its purpose is to ensure that both human developers and AI agents build the application consistently.

If this document conflicts with implementation preferences, this document takes precedence.

---

# Development Principles

ReadAway prioritizes:

1. Simplicity
2. Maintainability
3. Privacy
4. Predictability
5. Small scope

The MVP should solve a narrow problem exceptionally well.

Avoid premature abstraction.

Avoid building for hypothetical future requirements.

---

# AI Agent Rules

Before implementing any feature, AI agents must review:

1. PRD
2. Screen Specification
3. This Architecture Guide

No implementation should introduce functionality not defined in those documents.

---

# Documentation Policy

AI agents must always use the Context7 `find-docs` skill before implementing or modifying code that depends on external libraries or browser APIs.

The goal is to ensure implementation uses current APIs and best practices.

Do not rely solely on model knowledge.

Always consult Context7 documentation first.

If documentation conflicts with assumptions, documentation wins.

Examples include:

* React
* TypeScript
* Vite
* epub.js
* Dexie
* vite-plugin-pwa
* IndexedDB
* OPFS
* Web Crypto API
* archive libraries

---

# Technology Stack

Frontend:

```text id="m2lh0g"
React
```

Language:

```text id="jlwmbo"
TypeScript
```

Bundler:

```text id="ukcb1t"
Vite
```

Reader Engine:

```text id="s6q75h"
epub.js
```

Database:

```text id="4g2r44"
IndexedDB
```

Database Layer:

```text id="nfl1f7"
Dexie
```

PWA Support:

```text id="jlwmfh"
vite-plugin-pwa
```

Cryptography:

```text id="oc6vut"
Web Crypto API
```

Archive Support:

```text id="ct6dhz"
fflate
```

---

# Folder Structure

Use the following structure.

```text id="kkw0wo"
src/
├── app/
├── core/
├── db/
├── services/
├── features/
│   ├── library/
│   ├── import-books/
│   ├── reader/
│   ├── export-library/
│   └── settings/
├── components/
├── hooks/
├── types/
└── main.tsx
scripts/
└── dictionary/  # Build-time dictionary pack generation scripts
```

Do not introduce additional top-level folders without justification.

The `scripts/dictionary/` folder is reserved for build-time generation and
verification of static `.rawaydict` assets. Runtime application code must not
import from `scripts/`.

---

# Feature Isolation

Features must remain isolated.

Allowed dependencies:

```text id="r3owv7"
feature
↓
core
services
db
components
```

Forbidden dependencies:

```text id="c4tp2x"
feature
↓
other feature
```

Examples:

```text id="2yb94e"
reader → export-library ❌

library → reader ❌
```

Communication must occur through services.

---

# State Management Rules

Use React Context sparingly.

Prefer:

```text id="9o1h5k"
React local state
↓
custom hooks
↓
React Context (only when necessary)
```

Do not introduce:

* Redux
* Zustand
* MobX
* Recoil
* XState
* Jotai

Avoid global mutable state.

---

# Database Rules

Use Dexie.

Tables:

## Books

```text id="af4thf"
syncKey
source
sourceId
editionHash

title
author
language

coverPath
storageKey

importedAt
```

## Progress

```text id="6r2hwl"
syncKey

locator
percentage

updatedAt
```

## Page Maps

```text
key
syncKey
editionHash

algorithmVersion
charsPerPage
locations

createdAt
updatedAt
```

`locations` stores the serialized epub.js location map for stable synthetic page numbers.

## Dictionaries

```text
id
language
title

sourceName
sourceVersion
license
attribution

entryCount
formCount
installedAt
sizeBytes
```

## Dictionary Entries

```text
key
dictionaryId

lemma
normalizedLemma
entriesJson
```

`key` is:

```text
dictionaryId + ":" + normalizedLemma
```

## Dictionary Forms

```text
key
dictionaryId

normalizedForm
lemmasJson
```

`key` is:

```text
dictionaryId + ":" + normalizedForm
```

No additional tables without updating this document.

---

# Reader Architecture

The reader must follow this structure:

```text id="p9sq0j"
React
↓
Reader Component
↓
epub.js
```

No bridge layer.

No iframe communication layer.

epub.js is integrated directly.

---

# Reader Service Boundary

epub.js must not leak into the rest of the application.

All reader interactions must go through ReaderService.

Responsibilities:

* Open book
* Restore progress
* Save progress
* Calculate stable whole-book page position
* Calculate pages left in current EPUB section/chapter
* Navigate chapters
* Retrieve table of contents
* Apply page colors
* Apply font size
* Apply reader layout
* Emit selected reader text for dictionary lookup without leaking epub.js
  objects into feature code

---

# Services

Business logic belongs in services.

---

## BookStorageService

Responsibilities:

* Store imported EPUBs
* Retrieve EPUBs
* Delete EPUBs
* Abstract OPFS/IndexedDB storage

Only this service may access EPUB files.

---

## ImportService

Responsibilities:

* Validate EPUB source
* Detect Standard Ebooks
* Detect Project Gutenberg
* Generate identities
* Extract metadata
* Persist Book records

---

## ExportService

Responsibilities:

* Generate `.raway` archives
* Import `.raway` archives
* Validate archive structure

---

## ReaderService

Responsibilities:

* Interface with epub.js
* Persist reading progress
* Restore reading progress
* Apply reader appearance settings

## DictionaryService

Responsibilities:

* Fetch the dictionary manifest from static assets
* Download the `.rawaydict` pack after explicit user action
* Verify pack checksum before installation
* Validate dictionary pack structure
* Install dictionary metadata, entries, and form mappings into IndexedDB
* Remove installed dictionary data
* Report installed dictionary status and storage size
* Normalize selected words
* Apply conservative English lemmatization
* Lookup definitions
* Return dictionary results to reader UI

Only DictionaryService may access dictionary tables directly.

DictionaryService must not call live dictionary APIs.

---

# Dictionary Rules

ReadAway supports one managed English dictionary pack for the first dictionary
release.

Dictionary source:

```text
Open English WordNet 2025 core JSON
```

Dictionary pack extension:

```text
.rawaydict
```

Dictionary packs are static assets deployed with ReadAway:

```text
/dictionaries/manifest.json
/dictionaries/en-oewn-2025.rawaydict
```

Rules:

* Dictionary packs are not manually imported by users.
* Dictionary packs are not precached by the service worker by default.
* Dictionary download happens only after explicit user action.
* Installed dictionary lookup must work offline.
* Dictionary data is separate from books, progress, and page maps.
* Dictionary data is not included in `.raway` backups.
* Dictionary attribution must be visible in Settings/About.
* If no dictionary is installed, lookup returns a not-installed state.
* If no entry is found, lookup returns a no-definition state.

---

# Storage Rules

Preferred storage:

```text id="g06i4f"
OPFS
```

Fallback:

```text id="gdjlwm"
IndexedDB
```

The original imported file must never be used after import.

Reading always uses internally stored copies.

Installed dictionaries are stored in IndexedDB. They may be removed and
reinstalled independently from the user library.

---

# Supported EPUB Policy

ReadAway MVP supports only:

* Standard Ebooks
* Project Gutenberg

Unsupported EPUBs must be rejected.

No heuristic matching.

No universal EPUB identification.

---

# Book Identity Rules

Synchronization identity:

```text id="0epj0n"
syncKey = source + ":" + sourceId
```

Examples:

```text id="84vhuu"
standardebooks:bram-stoker/dracula

gutenberg:10007
```

Edition identity:

```text id="66lkvb"
SHA256(epub bytes)
```

Synchronization uses:

```text id="m4t95l"
syncKey
```

Edition hashes are informational only.

---

# Archive Rules

Archive extension:

```text id="xzcj4o"
.raway
```

Archive format:

```text id="08gjlwm"
ZIP
```

Archive contents:

```text id="jlwmku"
manifest.json
books/
progress/
```

Users choose:

* Which books to back up

Each selected book is backed up as a snapshot.

The snapshot always keeps the EPUB file, metadata, reading progress when it
exists, and original timestamps together.

Dictionaries are never included in `.raway` archives.

During restore, ReadAway must compare backup progress timestamps with local
progress timestamps. Books with newer local progress are unchecked by default.

---

# PWA Rules

Requirements:

* Offline application shell
* Installable experience
* Service worker support
* Imported books accessible offline
* Installed dictionaries accessible offline

The application shell and imported books must function without an internet
connection after installation and import. Installed dictionaries must also
function without an internet connection after dictionary installation.

---

# UI Rules

UI must follow the Screen Specification exactly.

Do not introduce:

* Bottom navigation bars
* Floating action buttons
* Onboarding flows
* Tutorial screens
* Promotional dialogs
* Feature discovery popups
* Developer menus

When in doubt:

Choose the simpler UI.

---

# Design Tokens

ReadAway uses the freeCodeCamp Command-line Chic semantic color tokens.

## Token Policy

All application chrome, controls, panels, and surfaces must use the fCC
semantic variables defined in `src/index.css`. Hardcoded hex or rgba color
values are not permitted in component CSS files with exactly one exception:

**Reader page colors** (light `#FAF8F2`, dark `#1C1C1E`, black `#000000`)
are user reading preferences and may remain hardcoded in:

* `src/services/ReaderService.ts` — epub.js theme registration.
* `src/features/reader/ReaderScreen.css` — `.reader-theme-*` container
  background classes.
* `src/types/index.ts` — `PAGE_COLORS` constant.

## Token Architecture

Tokens are structured in three layers:

1. **Primitives** (`--gray-*`, `--yellow-gold`, `--blue-mid`, etc.) — raw
   color values defined on `html`.
2. **Semantic mappings** (`--primary-background`, `--highlight-color`, etc.) —
   swapped per theme under `[data-app-theme='dark']` and
   `[data-app-theme='light']`.
3. **App aliases** (`--app-bg`, `--app-text`, `--app-primary`, etc.) —
   convenience layer that maps to semantic tokens for concise component use.

Components must reference the **app alias layer** or the **semantic layer**,
never primitive tokens directly.

Overlay, shadow, hover, and active-state values also live in the app alias
layer (`--app-overlay`, `--app-shadow`, `--app-primary-hover`,
`--app-selected-text`, etc.) so component CSS does not need raw `rgba(...)`
or primitive palette references.

## Theme Switching

The resolved app theme is stored in `data-app-theme` on `<html>`. The reader
page color (`reader-theme-light/dark/black`) is a separate CSS class on the
reader container and does not affect app chrome.

---

# Accessibility Requirements

ReadAway targets the freeCodeCamp Command-line Chic accessibility standard:

* **Contrast**: 7:1 minimum for body text on backgrounds (WCAG AAA).
* **Typography**: 18px base font size for application UI.
* **Focus**: `:focus-visible` outline (2px solid `#198eee`) on all
  interactive elements.
* **Touch targets**: 44px minimum height for buttons and controls.
* **Keyboard navigation**: Every interactive element reachable and operable.
  Drawer panels must close via Escape key.
* **Screen readers**: Icon-only or visually abbreviated controls must have
  `aria-label` attributes. Drawer panels must use `aria-hidden` + `inert`
  when closed.
* **Accessible signaling**: Color is paired with text or icons; never used
  as the sole differentiator.

---

# Testing Expectations

Every completed feature should include:

* Unit tests for business logic
* Component tests for critical UI
* End-to-end tests where appropriate

Critical paths requiring tests:

* EPUB import
* Unsupported EPUB rejection
* Progress persistence
* Progress restoration
* RAWAY export
* RAWAY import
* Offline reading
* Dictionary installation
* Dictionary lookup
* Dictionary removal

---

# Definition of Done

A task is complete only when:

* Implementation matches the PRD
* Implementation matches the Screen Specification
* Context7 documentation has been consulted
* Tests have been added
* No unnecessary functionality has been introduced
* The feature works in supported browsers

---

# Guiding Principle

If there is uncertainty during implementation, prefer the solution that is:

* simpler,
* more maintainable,
* more private,
* and more aligned with the MVP scope.

ReadAway should feel calm, focused, and intentional.

The goal is not to build the most powerful reader.

The goal is to build the best reading experience for public domain EPUB readers.
