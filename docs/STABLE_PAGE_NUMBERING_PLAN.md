# Stable Page Numbering Implementation Plan

## Goal

ReadAway should show page numbers that behave like common ebook readers for reflowable EPUBs:

- Stable across font size, viewport, theme, and device.
- Deterministic for the same EPUB edition.
- Available offline and private.
- Efficient for large books after the first generation pass.

The books in scope are Standard Ebooks and Project Gutenberg EPUBs. The fixture set in `books/` does not include EPUB `page-list`, `pagebreak`, `doc-pagebreak`, NCX `pageList`, or NCX `pageTarget` markers, so MVP page numbering will use synthetic stable pages.

## Algorithm

Use epub.js locations as ReadAway's synthetic stable page map.

```ts
SYNTHETIC_PAGE_CHARS = 2000
PAGE_MAP_ALGORITHM_VERSION = 1
```

epub.js generates CFI anchors every `SYNTHETIC_PAGE_CHARS` characters across the spine. These anchors are stable content positions, not rendered viewport pages.

The footer displays:

```text
current / total
```

or, when the current rendered view spans multiple stable synthetic pages:

```text
current-end / total
```

where:

- `total = book.locations.length()`
- `current = book.locations.locationFromCfi(currentVisibleStartCfi) + 1`
- `end = book.locations.locationFromCfi(currentVisibleEndCfi) + 1`

While the map is not ready, the reader may temporarily show the current rendered section page as:

```text
Page N
```

## Caching

Generating locations is linear in book size and may be noticeable for large books like *War and Peace*. It must be cached.

Add a Dexie `pageMaps` table:

```ts
key = `${syncKey}|${editionHash}|stable-pages-v1`
```

Fields:

- `key`
- `syncKey`
- `editionHash`
- `algorithmVersion`
- `charsPerPage`
- `locations`
- `createdAt`
- `updatedAt`

`locations` stores `book.locations.save()`.

## Reader Flow

1. Open EPUB and render immediately.
2. Try to load a cached page map for the book's `syncKey`, `editionHash`, algorithm version, and char size.
3. If found, load it into `book.locations`.
4. If absent, generate locations in the background and save them.
5. Update footer page position after load/generation.
6. Save reading progress using CFI plus percentage derived from the stable page map when available.

## Rendered Page Normalization

Stable page numbers are content anchors, but epub.js still advances through rendered CSS columns. Standard Ebooks titlepages can include accessibility text hidden with very large negative offsets such as `left: -999em`. In paginated column layout, that can inflate the rendered column width and make next/previous navigation walk through many empty columns while the stable synthetic page number stays unchanged.

ReadAway injects reader-level EPUB normalization CSS before the user theme:

- Hidden Standard Ebooks titlepage, imprint, and colophon labels are converted to clipped 1px visually hidden elements.
- Standard Ebooks titlepage images are constrained to the current reader viewport.

This keeps page-turn navigation aligned with the visible book content without changing the stable page-numbering algorithm.

## Invalidating Cache

Page maps are invalidated by changing any of:

- `editionHash`
- `PAGE_MAP_ALGORITHM_VERSION`
- `SYNTHETIC_PAGE_CHARS`

## Non-Goals

- Matching Google Play Books, Kindle, or Kobo exactly.
- Rendering every viewport page.
- Supporting arbitrary EPUBs outside Standard Ebooks and Project Gutenberg.
- Adding user-facing page-number settings in MVP.

## Verification

- Build must pass.
- Existing reader behavior must remain: open, next/previous, progress restore, TOC, themes, font size.
- `npm run lint` may still report unrelated existing hook lint errors in files outside this change.
