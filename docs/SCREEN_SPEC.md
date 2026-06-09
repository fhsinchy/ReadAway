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
Export Books

Library
↓
Import Archive

Library
↓
Settings
```

---

# Screen Inventory

ReadAway MVP contains exactly seven screens and one sheet.

Screens:

1. Library
2. Import EPUB
3. Reader
4. Table of Contents
5. Settings
6. Export Books
7. Import Archive

Sheet:

8. Appearance Sheet

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

[Import]
[Export]
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

Long press:

```text id="jlwm7r"
Enter Selection Mode
```

---

## Selection Mode

Available actions:

* Select books
* Select all
* Deselect all
* Export selected

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

Progress

Next
```

---

## Reader Persistence

Remember:

* Reading position
* Theme
* Font size

Automatically save progress:

* On page change
* When tab becomes hidden
* Before browser unload

---

# 4. Table of Contents Screen

Purpose:

Navigate chapters.

---

## Layout

```text id="jlwmkt"
Book Title

Chapter List
```

---

## Interaction

Tap chapter:

```text id="jlwmlt"
Jump to chapter
Return to Reader
```

---

# 5. Appearance Sheet

Purpose:

Adjust reading appearance.

Presentation:

Bottom sheet.

Not a separate screen.

---

## Theme Selection

```text id="jlwmmt"
○ Light
○ Dark
○ Black
```

---

## Font Size

```text id="jlwmnt"
[-] 16 [+]
```

---

## Behavior

Changes apply immediately.

Reader position must not reset.

Pagination should not unnecessarily restart.

Dismiss:

```text id="jlwmot"
Swipe down
Tap outside
```

---

# 6. Settings Screen

Purpose:

Minimal application settings.

---

## Layout

Library

```text id="jlwmpt"
Import Archive
```

Appearance

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

# 7. Export Books Screen

Purpose:

Generate ReadAway archives.

---

## Layout

```text id="jlwmst"
Export Books

Selected:
3 books

☑ Include reading progress

[Export]
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
Archive created successfully.
```

Native browser save dialog opens.

---

# 8. Import Archive Screen

Purpose:

Import RAWAY archives.

---

## Flow

```text id="jlwmut"
Choose Archive
↓
Preview Contents
↓
Select Books
↓
Import
```

---

## Preview

```text id="jlwmvt"
☑ Dracula
☑ Carmilla
☑ Interim

Includes Progress: Yes
```

---

## Import Action

```text id="jlwmwt"
[Import Selected]
```

---

## Success State

```text id="jlwmxt"
Books imported successfully.
```

Actions:

```text id="jlwmyt"
[Back to Library]
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
