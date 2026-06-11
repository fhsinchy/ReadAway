# ReadAway MVP Screen Specification

This document defines every screen in the ReadAway MVP.

AI agents must not introduce additional screens, navigation patterns, or user flows unless explicitly requested.

The objective is to keep ReadAway calm, predictable, and focused.

---

# Navigation Structure

ReadAway uses a simple stack-based navigation model.

There is no bottom navigation bar.

Primary flow:

```text id="c6eq5n"
Library
↓
Reader
```

Secondary flows:

```text id="kjlwmr"
Library
↓
Import EPUB

Library
↓
Settings
↓
Back Up Library

Library
↓
Settings
↓
Restore Library

Library
↓
Settings
```

---

# Screen Inventory

ReadAway MVP contains exactly seven screens and three reader panels.

Screens:

1. Library
2. Import EPUB
3. Reader
4. Table of Contents
5. Settings
6. Back Up Library
7. Restore Library

Reader panels:

8. Table of Contents Panel
9. Appearance Panel
10. Dictionary Panel

No additional screens should be introduced without updating this document.

---

# 1. Library Screen

Purpose:

The home screen of ReadAway.

This is where users spend most of their non-reading time.

---

## Layout

```text id="mkjlwm"
App Bar
--------------------------------
ReadAway

[Add Book]
[Settings]

Continue Reading
--------------------------------
Current reads

Library
--------------------------------
Grid of books
```

---

## Continue Reading Section

Displays books with progress.

Each card shows:

```text id="xjlwmh"
Cover

Title
Author

Progress
```

Tapping a book:

```text id="ptjlwm"
Open Reader
```

---

## Library Grid

Displays all imported books.

Book card:

```text id="jlwm4p"
Cover

Title
Author

Progress
```

Tapping:

```text id="jlwm6q"
Open Reader
```

---

## Empty State

Displayed when no books exist.

```text id="jlwm8s"
No books yet.

Import EPUB books from
Standard Ebooks or Project Gutenberg.

[Import EPUB]
```

---

# 2. Import EPUB Screen

Purpose:

Import supported EPUB files.

---

## Flow

```text id="jlwm9t"
Choose EPUB
↓
Validate Source
↓
Extract Metadata
↓
Store Book
↓
Import Complete
```

---

## Supported Sources

* Standard Ebooks
* Project Gutenberg

---

## Success State

```text id="jlwmat"
Book imported successfully.
```

Actions:

```text id="jlwmbt"
[Read Now]
[Back to Library]
```

---

## Unsupported EPUB State

```text id="jlwmct"
This version of ReadAway currently supports EPUB books from Standard Ebooks and Project Gutenberg only.
```

Actions:

```text id="jlwmdt"
[Back]
```

---

# 3. Reader Screen

Purpose:

Provide a distraction-free reading experience.

---

## Default State

Immersive.

Controls hidden.

Only the book content is visible.

---

## Reader Layout

```text id="jlwmet"
EPUB Content
```

---

## Tap Zones

Left:

```text id="jlwmft"
Previous Page
```

Center:

```text id="jlwmgt"
Toggle Controls
```

Right:

```text id="jlwmht"
Next Page
```

Horizontal swipe:

```text
Swipe left: Next Page
Swipe right: Previous Page
```

Swipe gestures must ignore mostly vertical movement and must not run while
reader panels are open.

Text selection:

```text
Select word: Dictionary Lookup
```

Only single-word lookup is supported. Multi-word, full-line, or
multi-paragraph selections must not open the Dictionary Panel.

---

## Reader Controls

Shown when center is tapped.

---

### Top Bar

```text id="jlwmit"
Back

Book Title

Full Screen
Table of Contents
Appearance
```

---

### Bottom Bar

```text id="jlwmjt"
Previous

Whole-book page number, e.g. Page 82-85 of 112
Pages left in current chapter

Next
```

---

## Reader Persistence

Remember:

* Reading position
* Page color
* Font size
* Preferred layout

Automatically save progress:

* On page change
* When tab becomes hidden
* Before browser unload

---

# 4. Table of Contents Panel

Purpose:

Navigate chapters.

---

## Layout

```text id="jlwmkt"
Book Title

Chapter List
```

Presentation:

Right-side panel.

Not a separate screen.

Opening and closing must animate smoothly.

---

## Interaction

Tap chapter:

```text id="jlwmlt"
Jump to chapter
Return to Reader
```

---

# 5. Appearance Panel

Purpose:

Adjust reading appearance.

Presentation:

Right-side panel.

Not a separate screen.

Opening and closing must animate smoothly.

---

## Page Color Selection

```text id="jlwmmt"
○ Light
○ Dark
○ Black
```

---

## Font Size

```text id="jlwmnt"
A [slider] A
```

---

## Layout

```text
Single Column
Two Columns
```

Two Columns is disabled when the reader surface is below 840 CSS px wide or
480 CSS px tall.

When disabled, show:

```text
Two columns are available on larger screens.
```

---

## Page Turn

No page-turn animation setting is shown.

---

## Behavior

Changes apply immediately.

Reader position must not reset.

Pagination should not unnecessarily restart.

If the saved preferred layout is Two Columns but the current screen is
ineligible, render Single Column temporarily and restore Two Columns when the
screen becomes eligible again.

Dismiss:

```text id="jlwmot"
Tap outside
```

---

# 6. Dictionary Panel

Purpose:

Show a compact definition for a selected word without leaving the reader.

Presentation:

Right-side panel.

Not a separate screen.

Opening and closing must animate smoothly.

---

## Installed Dictionary State

```text
Dictionary

selected word
base word, when different

part of speech
definition
definition
definition
```

Show at most three definition groups or five total definitions in the panel.

Examples and synonyms may be stored but are not required in the first panel UI.

---

## Dictionary Not Installed State

```text
English dictionary is not installed.

Download it for offline lookup?

[Download]
[Not Now]
```

The prompt must be dismissible and must not block reading permanently.

---

## No Definition State

```text
No definition found.
```

---

## Dismiss

Close the panel when:

* User taps outside.
* User turns the page.
* User opens Table of Contents.
* User opens Appearance.
* User presses Escape.

---

# 7. Settings Screen

Purpose:

Minimal application settings.

---

## Layout

Appearance

```text
App Theme
System / Light / Dark
```

Library

```text id="jlwmpt"
Back Up Library
Restore Library
```

Dictionary

```text
English Dictionary
Open English WordNet
Downloaded size / Installed size
[Download] or [Remove]
```

When installed, Settings must show source, version, license, and attribution.

```text id="jlwmqt"
Install ReadAway
```

About

```text id="jlwmrt"
Version
```

Nothing else.

---

## Exclusions

Do not add:

* Experimental toggles
* Developer settings
* Analytics settings
* Hidden menus

---

# 8. Back Up Library Screen

Purpose:

Generate ReadAway backups.

---

## Layout

```text id="jlwmst"
Back Up Library

Selected:
3 books

Progress and timestamps included

[Back Up]
```

---

## Book Selection

Users may:

* Select individual books
* Select all books
* Deselect all books

---

## Success State

```text id="jlwmtt"
Backup created successfully.
```

Native browser save dialog opens.

---

# 9. Restore Library Screen

Purpose:

Restore RAWAY backups.

---

## Flow

```text id="jlwmut"
Choose Backup
↓
Preview Contents
↓
Select Books
↓
Restore
```

---

## Preview

```text id="jlwmvt"
☑ Dracula
☐ Carmilla — newer progress on this device
☑ Interim — backup has newer progress

Different EPUB versions are marked before restore.
```

---

## Import Action

```text id="jlwmwt"
[Restore Selected]
```

---

## Success State

```text id="jlwmxt"
Library restored successfully.
```

Actions:

```text id="jlwmyt"
[Back to Settings]
```

---

# PWA Installation Experience

Purpose:

Allow users to install ReadAway.

Presentation:

Non-blocking prompt.

Only shown when installation is supported.

---

## Layout

```text id="jlwmzt"
Install ReadAway

Read books offline and access ReadAway from your home screen.

[Install]
[Not Now]
```

---

## Rules

* Never blocks reading.
* Dismissible.
* Never shown more than once per session.
* Never shown while actively reading.

---

# Screen Rules

ReadAway should feel:

* Calm
* Minimal
* Focused

Avoid introducing:

* Bottom navigation
* Floating action buttons
* Promotional banners
* Onboarding carousels
* Tutorial overlays
* Achievement systems
* Pop-up interruptions

If a UI decision is unclear:

> Choose the simpler option.

The reader experience should always take precedence over feature discoverability.

---

# Visual Language

ReadAway uses the freeCodeCamp Command-line Chic design system.

## Application Chrome

All non-reader application UI (library, settings, backup, restore, import)
follows the fCC dark-first palette:

* Dark surface backgrounds (`--primary-background`, `--secondary-background`).
* High-contrast white or near-white text (`--primary-color`, `--tertiary-color`).
* Yellow primary CTAs and gold accent for actions.
* Blue links and interactive controls.
* Green success states.
* Red warning and destructive states.
* Monospace section labels for developer-tool character.
* 18px base body text with reviewed compact exceptions for metadata.

## Reader Chrome

The reader topbar, bottombar, and drawer panels use the same fCC app theme
colors, not the reader page color. This ensures the chrome remains stable
when the user changes the EPUB page color preference.

## Reader Page Color

Reader page colors (light `#FAF8F2`, dark `#1C1C1E`, black `#000000`)
are user-configured preferences that only affect the EPUB content viewport.
They are exempt from the fCC semantic token requirement.

## Reader Panels

TOC, Appearance, and Dictionary panels share a unified drawer language:

* fCC surface background (`--app-surface`).
* fCC border (`--app-border`).
* fCC text tokens for all copy.
* Blue (`--highlight-color`) for selected page-color, layout, and font-slider
  active states.
* 16-18px panel text.
* Escape key and a labeled close button dismiss any panel.

## Accessibility

* 7:1 contrast target for body text.
* `:focus-visible` outlines on all interactive elements (blue-mid `#198eee`).
* 44px minimum touch targets for interactive controls.
* All icon-only controls carry `aria-label`.
* Drawer panels are keyboard-dismissable via Escape.
* Closed drawers use `inert` + `aria-hidden` to prevent keyboard focus escape.
