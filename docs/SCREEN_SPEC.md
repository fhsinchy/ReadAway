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

ReadAway MVP contains exactly seven screens and two reader panels.

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

---

## Reader Controls

Shown when center is tapped.

---

### Top Bar

```text id="jlwmit"
Back

Book Title

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

Two Columns is disabled when the reader surface is below 900 CSS px wide or the
content area is below 600 CSS px tall.

When disabled, show:

```text
Two columns are available on wider screens.
```

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

# 6. Settings Screen

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

# 7. Back Up Library Screen

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

# 8. Restore Library Screen

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
