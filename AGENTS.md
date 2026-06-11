# AGENTS.md

## Project: ReadAway

**Tagline:** Own your books. Own your progress.

ReadAway is a private EPUB reader delivered as a Progressive Web App. It provides a polished reading experience focused on public domain books (Standard Ebooks and Project Gutenberg) while preserving user ownership and privacy.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 |
| Language | TypeScript 6 |
| Bundler | Vite 8 |
| Reader Engine | epub.js |
| Database | IndexedDB via Dexie |
| PWA | vite-plugin-pwa |
| Archive | fflate |
| Crypto | Web Crypto API |

---

## Quick Start

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Lint
```

---

## Folder Structure

```
src/
├── app/          # App root, routing, layout
├── core/         # Shared constants, utilities
├── db/           # Dexie database definitions
├── services/     # Business logic services
├── features/     # Feature modules
│   ├── library/
│   ├── import-books/
│   ├── reader/
│   ├── export-library/
│   └── settings/
├── components/   # Shared UI components
├── hooks/        # Shared React hooks
├── types/        # TypeScript type definitions
└── main.tsx      # Entry point
```

Path alias: `@/` maps to `src/`

---

## Architecture Rules

### Feature Isolation
- Features must NOT import from other features
- Communication between features goes through services
- Allowed: `feature → core | services | db | components`

### State Management
1. React local state (preferred)
2. Custom hooks
3. React Context (only when necessary)
- No Redux, Zustand, MobX, or other state libraries

### Services
Business logic lives in services. Key services:
- **BookStorageService** — OPFS/IndexedDB abstraction for EPUB storage
- **ImportService** — EPUB validation, identity generation, metadata extraction
- **ExportService** — `.raway` archive generation and import
- **ReaderService** — epub.js interface, progress persistence

### Database (Dexie)
Tables:
- `books` — syncKey, source, sourceId, editionHash, title, author, language, coverPath, storageKey, importedAt
- `progress` — syncKey, locator, percentage, updatedAt

---

## Key Design Decisions

### Supported EPUBs Only
Only Standard Ebooks and Project Gutenberg EPUBs are accepted. All others are rejected with a clear message. Book identity: `syncKey = source + ":" + sourceId`.

### Storage
- Preferred: OPFS (Origin Private File System)
- Fallback: IndexedDB
- Original imported files are never used after import

### Archive Format
`.raway` files are ZIP archives containing `manifest.json` and `books/`. Books are always included; reading progress is optional.

---

## PWA
- Offline application shell via service worker
- Installable with manifest
- Imported books cached for offline reading
- `registerType: 'autoUpdate'`

---

## UI Principles
- Calm, minimal, focused
- No bottom navigation bars, floating action buttons, onboarding, or promotional elements
- Reader experience takes precedence over feature discoverability
- When in doubt, choose the simpler option
- App chrome follows freeCodeCamp Command-line Chic design language
- Reader page color is independent of app chrome; use fCC semantic tokens for chrome,
  reader page colors for the EPUB viewport only

---

## Testing
Critical paths requiring tests:
- EPUB import and unsupported EPUB rejection
- Progress persistence and restoration
- `.raway` export and import
- Offline reading

---

## Documentation
Before implementing any feature, review:
1. `docs/PRD.md` — Product requirements (includes fCC design system policy)
2. `docs/SCREEN_SPEC.md` — Screen specifications (includes visual language rules)
3. `docs/ARCHITECTURE.md` — Architecture guide (includes token and accessibility policies)
4. `docs/FCC_COMMAND_LINE_CHIC_MIGRATION_PLAN.md` — fCC migration plan
5. Context7 (`find-docs` skill) for external library APIs
6. `.agents/skills/command-line-chic/SKILL.md` — freeCodeCamp design guidelines

---

## Design System

ReadAway uses the **freeCodeCamp Command-line Chic** design language.

### Skill
Before any UI work, review the `command-line-chic` skill:

`.agents/skills/command-line-chic/SKILL.md`

### Token Policy
All app chrome uses fCC semantic tokens from `src/index.css`. Hardcoded
colors are forbidden in component CSS with one documented exception:

**Reader page colors** (light `#FAF8F2`, dark `#1C1C1E`, black `#000000`)
are user reading preferences and may remain hardcoded. They must never be
used for app chrome, drawers, navigation, or any non-viewport surface.

### Visual Identity
- App chrome is dark-first (fCC dark palette).
- Reader chrome (topbar, bottombar, drawers) uses app theme colors, not
  reader page colors.
- Yellow primary CTAs, blue interactive states, green success, red danger.
- 18px base body text.
- Global `:focus-visible` with blue-mid outline.

### Reference Documents
- `docs/PRD.md` — Product requirements.
- `docs/SCREEN_SPEC.md` — Screen specifications with visual language rules.
- `docs/ARCHITECTURE.md` — Architecture guide with token and accessibility
  policies.
- `docs/FCC_COMMAND_LINE_CHIC_MIGRATION_PLAN.md` — Full migration plan.

---

## Scope Boundaries
The MVP is feature-locked. Out of scope:
- Arbitrary EPUB, PDF, or MOBI support
- Highlights, notes, dictionaries, TTS
- Accounts, cloud sync, social features
- Book purchasing or stores
- Onboarding tutorials or reading statistics
