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
* html5-qrcode
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

QR Scanning:

```text id="siy3au"
html5-qrcode
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
```

Do not introduce additional top-level folders without justification.

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
* Navigate chapters
* Retrieve table of contents
* Apply themes
* Apply font size

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
```

Users choose:

* Which books to export
* Whether to include progress

Books are always included.

Progress is optional.

---

# PWA Rules

Requirements:

* Offline application shell
* Installable experience
* Service worker support
* Imported books accessible offline

The application must function without an internet connection after installation and import.

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
