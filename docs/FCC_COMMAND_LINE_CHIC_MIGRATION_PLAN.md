# freeCodeCamp Command-line Chic Migration Plan

This document plans the migration of ReadAway into a freeCodeCamp-aligned app
using the local `command-line-chic` skill.

The goal is to make ReadAway feel like a natural member of the freeCodeCamp
product constellation while preserving its core reader promise: a calm,
offline-first EPUB reading experience focused on user-owned public-domain
books.

---

# Source References

Primary design references:

* `.agents/skills/command-line-chic/SKILL.md`
* `.agents/skills/command-line-chic/references/color-system.md`
* `.agents/skills/command-line-chic/references/syntax-theme.md`

Current product references:

* `docs/PRD.md`
* `docs/SCREEN_SPEC.md`
* `docs/ARCHITECTURE.md`

---

# Migration Thesis

ReadAway should become:

```text
A freeCodeCamp offline reader for public-domain books, with local ownership,
private progress, and a developer-tool-inspired interface.
```

The app shell should follow freeCodeCamp's Command-line Chic design language:

* dark-first
* navy editor surfaces
* high-contrast text
* 18px base UI typography
* restrained semantic accents
* yellow primary CTAs
* blue interactive states
* green success states
* red destructive/error states

The EPUB reading page itself remains a reader-controlled environment. Reader
page colors are preferences, not app chrome. This means ReadAway can keep
reader page color options while migrating all application UI, controls, panels,
and settings to freeCodeCamp visual language.

---

# Design Decisions

## App Theme

The app UI should become dark-first and default to the freeCodeCamp dark
palette.

Recommended default:

```text
App theme: dark
Reader page color: user preference
```

The existing System / Light / Dark app theme setting can remain, but dark
should be the primary designed experience.

## Reader Page Color

Reader page color stays separate from app theme.

Keep the MVP reader page colors unless we deliberately revisit them:

```text
Light: #FAF8F2
Dark:  #1C1C1E
Black: #000000
```

The pure-black page color conflicts with the Command-line Chic guardrail against
pure black backgrounds, but it is acceptable as an explicit reader preference.
It should not be used for app chrome, drawers, settings, or navigation.

## Typography

Command-line Chic requires 18px minimum body-sized UI text.

Migration target:

* App base size: 18px.
* App body/prose font: Lato if bundled locally; otherwise system sans as an
  interim step.
* Technical labels/status text: Hack-ZeroSlash if bundled locally; otherwise
  Fira Mono, Menlo, Consolas, monospace.
* EPUB content: controlled by reader theme settings and epub.js themes.

Open implementation question:

```text
Should ReadAway bundle fCC fonts locally for offline-first fidelity?
```

Recommendation: yes, but after the token migration. Do not block the first UI
pass on font bundling.

## Color Tokens

Components should use semantic tokens instead of hardcoded hex values.

Target semantic layer:

```css
--primary-background
--secondary-background
--tertiary-background
--quaternary-background
--primary-color
--secondary-color
--tertiary-color
--quaternary-color
--highlight-color
--highlight-background
--selection-color
--success-color
--success-background
--danger-color
--danger-background
--yellow-color
--yellow-background
--purple-color
--purple-background
--focus-outline-color
--editor-background
```

ReadAway's app aliases map chrome-specific roles to these tokens:

```css
--app-bg: var(--primary-background);
--app-surface: var(--secondary-background);
--app-surface-subtle: var(--tertiary-background);
--app-surface-muted: var(--quaternary-background);
--app-border: var(--quaternary-background);
--app-border-subtle: var(--tertiary-background);
--app-text: var(--primary-color);
--app-text-muted: var(--quaternary-color);
--app-text-subtle: var(--gray-45);
--app-primary: var(--yellow-gold);
--app-primary-text: var(--gray-90);
--app-primary-hover
--app-selected-text
--app-overlay
--app-overlay-subtle
--app-shadow
--app-inset-border
```

Component CSS should use these aliases instead of primitive palette tokens or
raw `rgba(...)` values.

## Accents

Use accents only for semantic meaning:

* Yellow: primary action buttons, explicit CTAs.
* Blue: links, interactive states, selected controls, sliders, focus-adjacent
  emphasis.
* Green: success, installed/downloaded/completed states.
* Red: errors, destructive actions, failed states.
* Purple: rare emphasis or code/developer metadata, not general decoration.

---

# Current Gap Analysis

## Global App UI

Current state:

* Warm paper app palette.
* Charcoal dark mode.
* Many colors are ReadAway-specific rather than fCC tokens.
* Base typography is system UI at browser default size.
* Focus styles are not yet systematized.

Migration needs:

* Replace warm-paper app theme with fCC semantic palette.
* Keep a mirrored light palette.
* Add global `:focus-visible`.
* Move shared button styles out of feature CSS if practical.

## Library

Current state:

* Simple app bar.
* Book grid with soft mobile-reader styling.
* Small labels, including 10px progress percentages.
* Primary button inherits neutral app color.

Migration needs:

* Compact fCC header.
* Yellow primary Add Book / Import EPUB CTA.
* fCC panel/card surfaces for books.
* Larger, more readable card text.
* Progress indicator using semantic accent, likely blue or green.
* Keep covers visually prominent.

## Settings

Current state:

* iOS-like grouped settings rows.
* Segmented app theme picker.
* Dictionary install/remove flows.
* Backup/restore entry points.

Migration needs:

* Convert rows to editor-panel surfaces.
* Use mono section labels where appropriate.
* Green installed dictionary state.
* Yellow download/install/backup CTA.
* Red remove dictionary action.
* Warning panels using yellow semantic tokens.

## Import, Backup, Restore

Current state:

* Mostly functional screens with shared app colors.
* Some inline styles remain in TSX.

Migration needs:

* Remove or minimize inline colors.
* Make primary actions yellow.
* Use fCC warning/success/error states.
* Ensure all text meets size and contrast targets.

## Reader Chrome

Current state:

* Reader page colors are separate.
* Topbar/bottombar use per-page-color translucent surfaces.
* Drawers use reader-theme-specific hardcoded colors.
* Appearance and dictionary panels include several 12-14px labels.

Migration needs:

* Keep EPUB page color preference.
* Migrate topbar, bottombar, drawers, and panel controls to fCC app tokens.
* Avoid pure black app chrome even when reader page color is black.
* Use blue for selected layout controls and sliders.
* Use readable 16-18px text in panels.
* Keep the reader itself quiet and low-distraction.

## Documentation

Current state:

* Product docs define the existing calm/minimal ReadAway design.
* No freeCodeCamp design-system policy is documented yet.

Migration needs:

* Update PRD to position ReadAway as freeCodeCamp-aligned.
* Update screen spec with visual language expectations.
* Update architecture guide with design token rules.
* Add `command-line-chic` usage guidance to project agent instructions.

---

# Implementation Phases

## Phase 0: Baseline and Visual Inventory

Goal: capture the current state before changing UI.

Tasks:

* Run `npm run lint`.
* Run `npm run build`.
* Capture screenshots for:
  * Library empty state.
  * Library with books.
  * Import EPUB.
  * Settings.
  * Backup Library.
  * Restore Library.
  * Reader light page.
  * Reader dark page.
  * Reader black page.
  * TOC panel.
  * Appearance panel.
  * Dictionary panel.
* Record viewport checks:
  * mobile portrait
  * tablet portrait
  * tablet landscape
  * desktop

Exit criteria:

* We have a visual baseline for comparison.
* Existing build and lint status is known.

## Phase 1: Token Foundation

Goal: introduce fCC tokens without changing component structure.

Tasks:

* Add fCC primitive color tokens to `src/index.css`.
* Add dark and light semantic mappings.
* Map existing `--app-*` variables to the semantic tokens.
* Add global `:focus-visible` outline using `--focus-outline-color`.
* Set `color-scheme` correctly for resolved app theme.
* Keep reader page-color variables separate.

Files:

* `src/index.css`
* `src/hooks/useAppTheme.ts`

Exit criteria:

* App uses fCC palette through existing aliases.
* No feature CSS has to be rewritten yet.
* Light and dark app themes both render.
* Lint and build pass.

## Phase 2: Shared Component Primitives

Goal: make common controls fCC-consistent.

Tasks:

* Move shared button primitives to global CSS or a shared component stylesheet.
* Define:
  * primary CTA button
  * secondary/ghost button
  * danger button
  * link-style button
  * disabled state
  * focus-visible state
* Standardize checkbox and range input accent colors.
* Replace neutral primary button color with yellow/gold.
* Remove duplicated button rules from feature styles where practical.

Files:

* `src/index.css`
* `src/features/library/LibraryScreen.css`
* `src/features/settings/SettingsScreen.css`
* `src/features/reader/ReaderScreen.css`

Exit criteria:

* All primary actions are visually consistent.
* Keyboard focus is clearly visible.
* No primary action uses neutral black/white as its main identity.

## Phase 3: Typography Migration

Goal: bring app UI toward fCC readability.

Tasks:

* Set app base font size to 18px.
* Audit all `font-size` values below 18px.
* Increase body-sized UI copy to 18px.
* Keep small metadata only where truly secondary, and avoid going below 16px
  except for compact progress metadata after explicit review.
* Decide whether to bundle Lato and Hack-ZeroSlash locally.
* If fonts are bundled, add them as static assets and define font-face rules.

Files:

* `src/index.css`
* all CSS feature files
* possibly `public/fonts/`

Exit criteria:

* Main UI text is 18px or larger.
* Small text exceptions are documented by component need.
* No layout breaks on mobile.

## Phase 4: Library Screen

Goal: make the home screen feel like a freeCodeCamp app.

Tasks:

* Convert header to compact fCC app chrome.
* Style Add Book as yellow primary CTA.
* Style Settings as secondary/ghost.
* Convert install banner to fCC panel.
* Convert book cards to fCC panel/card style with restrained radius.
* Use semantic progress color.
* Improve empty state typography and spacing.

Files:

* `src/features/library/LibraryScreen.tsx`
* `src/features/library/LibraryScreen.css`

Exit criteria:

* Library reads as fCC dark-first UI.
* Book covers remain legible and important.
* Empty and populated states both work on mobile/tablet/desktop.

## Phase 5: Settings, Backup, and Restore

Goal: make utility screens match fCC panels and semantic states.

Tasks:

* Convert settings rows to fCC panel surfaces.
* Restyle theme segmented control.
* Restyle dictionary status:
  * not installed
  * downloading
  * installed
  * failed
* Use green for installed/success states.
* Use red for remove/destructive actions.
* Convert backup/restore warnings to semantic yellow panels.
* Remove inline color styles from backup/restore TSX files.

Files:

* `src/features/settings/SettingsScreen.tsx`
* `src/features/settings/SettingsScreen.css`
* `src/features/export-library/ExportBooksScreen.tsx`
* `src/features/import-books/ImportArchiveScreen.tsx`

Exit criteria:

* Settings feels like a developer-tool panel, not a mobile preferences sheet.
* Backup/restore risk states are clearer.
* Dictionary state uses semantic accents consistently.

## Phase 6: Reader Chrome and Panels

Goal: migrate reader controls while preserving the reader page experience.

Tasks:

* Keep EPUB content page colors as reader preferences.
* Convert topbar and bottombar to fCC app-chrome surfaces.
* Avoid pure black app chrome in black reader mode.
* Convert TOC, Appearance, and Dictionary drawers to fCC panel surfaces.
* Replace hardcoded drawer colors with semantic variables.
* Increase panel text sizes where needed.
* Use blue selected states for:
  * page color selection
  * layout selection
  * font slider active track
* Ensure dictionary drawer remains readable over all reader page colors.

Files:

* `src/features/reader/ReaderScreen.tsx`
* `src/features/reader/ReaderScreen.css`
* `src/services/ReaderService.ts`
* `src/types/index.ts`

Exit criteria:

* Reader page remains calm.
* App controls read as fCC.
* TOC, Appearance, and Dictionary panels share one coherent drawer language.
* Page color changes do not cause a visual flash between app UI and reader UI.

## Phase 7: Import EPUB Screen

Goal: align import flow with fCC forms and status states.

Tasks:

* Convert centered import state to fCC focused-content layout.
* Style file picker trigger as yellow primary CTA.
* Use green success messaging.
* Use red/error state for unsupported EPUB.
* Ensure all copy meets typography and contrast rules.

Files:

* `src/features/import-books/ImportEpubScreen.tsx`
* `src/features/reader/ReaderScreen.css` if import styles remain there

Exit criteria:

* Import flow feels native to the fCC app shell.
* Unsupported EPUB state is clear and accessible.

## Phase 8: Accessibility and Contrast Audit

Goal: ensure the migration is not just visual.

Tasks:

* Keyboard test every screen.
* Verify focus-visible for every interactive element.
* Check contrast against fCC's 7:1 target where feasible.
* Check touch targets on mobile and tablet.
* Verify drawer close controls are keyboard reachable.
* Verify screen-reader labels for icon-only or ambiguous controls.

Exit criteria:

* No keyboard traps.
* Focus ring is visible.
* Text contrast is high on dark and light themes.
* Reader controls remain usable on tablet landscape and mobile portrait.

## Phase 9: Documentation Update

Goal: make the design migration part of the product contract.

Tasks:

* Update `docs/PRD.md`:
  * freeCodeCamp positioning
  * app theme vs reader page color
  * dark-first design expectation
* Update `docs/SCREEN_SPEC.md`:
  * visual language per screen
  * reader panel expectations
* Update `docs/ARCHITECTURE.md`:
  * semantic token policy
  * no hardcoded colors in component CSS except documented reader page colors
  * accessibility requirements
* Update `AGENTS.md`:
  * use `command-line-chic` for UI work
  * preserve reader page-color exception

Exit criteria:

* Future UI work has clear design-system rules.
* Documentation and implementation no longer drift.

## Phase 10: Final QA

Goal: verify the migrated product as a PWA reader.

Tasks:

* Run `npm run lint`.
* Run `npm run build`.
* Run dictionary verification if dictionary assets changed:
  * `npm run dictionary:verify`
* Test PWA install prompt and installed-window behavior.
* Test offline reload.
* Test book import and open.
* Test reader refresh in one-column and two-column modes.
* Test dictionary lookup and dictionary-not-installed flow.
* Test backup and restore.

Exit criteria:

* Build passes.
* Reader remains functional.
* PWA behavior remains intact.
* UI matches Command-line Chic principles across the full app.

---

# Suggested First Pull Request

The first migration PR should be intentionally narrow:

```text
Phase 1: Token Foundation
Phase 2: Shared Component Primitives
minimal documentation updates
```

Avoid changing every layout at once. The first PR should prove the token system,
dark-first palette, focus styling, and button semantics. Screen-by-screen
polish should follow in smaller PRs.

---

# Implementation Log

## Phase 1/2 Start

Initial implementation scope:

* Added the freeCodeCamp primitive and semantic color tokens to `src/index.css`.
* Made the default unresolved app shell dark-first.
* Mapped existing ReadAway `--app-*` aliases onto the fCC semantic token layer.
* Added shared button primitives for primary, secondary, text, and danger
  actions.
* Added a global `:focus-visible` outline using the fCC blue focus token.
* Moved primary CTA styling toward yellow/gold.
* Shifted selection and checkbox accents toward blue interactive tokens.
* Shifted reading progress toward the green success token.
* Kept EPUB reader page colors separate from app chrome.

Next intended step:

```text
Run checks, then continue screen-by-screen polish starting with Library and
Settings.
```

## Phase 4/5 Start

Second implementation scope:

* Made Library's Add Book action the yellow primary CTA.
* Converted book cards from mouse-only `div` elements to keyboard-reachable
  buttons.
* Shifted Library cards toward fCC panel surfaces with borders, compact radius,
  and semantic hover/focus states.
* Applied mono section-label treatment to Library, Settings, and Backup/Restore.
* Constrained Settings and Backup/Restore content widths for focused reading.
* Converted Settings rows and Backup/Restore book rows to bordered fCC panels.
* Changed installed dictionary removal from a primary CTA to a danger action.
* Replaced Backup/Restore one-off inline status layouts with reusable status
  classes.

## Phase 3 Start

Typography migration scope:

* Keep `html` at the Command-line Chic 18px base size.
* Treat `1rem` as the default app-shell UI size.
* Raise normal Library, Settings, Backup, and Restore text toward `1rem`.
* Allow reviewed compact exceptions for:
  * metadata such as author names, progress percentages, source/version labels
  * uppercase section labels
  * compact nav/header actions
  * reader chrome and reader panels until the reader-specific phase
* Do not change EPUB content typography in this phase. EPUB content remains
  controlled by reader appearance settings and epub.js themes.
* Defer the sharper fCC structural pass for cards/settings to the later
  Library and Settings phases.

Current audit summary:

```text
App shell:
- Library section labels, book metadata, progress labels
- Settings section labels, segmented controls, dictionary metadata
- Backup/Restore summaries, book metadata, status details

Deferred:
- Reader topbar/bottombar labels
- TOC, Appearance, and Dictionary panel typography
- EPUB content typography
```

---

# Acceptance Criteria for the Full Migration

ReadAway can be considered migrated when:

* The default app UI is recognizably freeCodeCamp dark-first.
* App colors are expressed through semantic fCC tokens.
* Primary CTAs use yellow/gold.
* Interactive accents use blue.
* Success, warning, and danger states use semantic colors.
* App UI body text is 18px by default, with reviewed exceptions.
* Keyboard focus is visible throughout.
* Reader page colors remain user-controlled.
* Reader chrome and drawers follow fCC surfaces.
* No app chrome uses pure black as its default surface.
* Product docs describe the fCC visual identity.

---

# Known Tradeoffs

## Reading Comfort vs Design-System Consistency

The EPUB page itself may need more flexibility than a typical fCC dashboard or
challenge interface. Reader page color, font size, and layout must remain
reader-centered.

## Density vs 18px Type

The current Library and Settings screens use compact 10-15px metadata. Moving
toward 18px will reduce density. We should accept this for primary UI and use
carefully reviewed 16px metadata where density is necessary.

## Offline Fonts

Using Lato and Hack-ZeroSlash improves brand fidelity, but font files add asset
weight. Since ReadAway is offline-first, any brand fonts should be bundled
locally rather than fetched from a third-party CDN.

## Black Reader Mode

Black reader mode should stay because it is a reading preference users expect.
It is not a precedent for app chrome.
