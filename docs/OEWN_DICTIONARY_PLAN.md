# Open English WordNet Dictionary Plan

This document plans the implementation of ReadAway's offline-first English
dictionary feature using Open English WordNet plus a small local lemmatizer.

The product contract for this feature is defined in:

* `docs/PRD.md`
* `docs/SCREEN_SPEC.md`
* `docs/ARCHITECTURE.md`

---

# Goals

* Provide instant dictionary lookup while reading.
* Work fully offline after the dictionary is installed.
* Avoid live dictionary APIs and server-side lookup infrastructure.
* Keep the app install reasonably small.
* Let ReadAway own the data shape, lookup behavior, and UI.
* Start with English monolingual lookup only.

---

# Non-Goals

* No multilingual dictionaries in the first version.
* No translation dictionaries.
* No OCR or image text lookup.
* No etymology-heavy dictionary UI.
* No pronunciation audio in the first version.
* No cloud sync of installed dictionary data.
* No inclusion of dictionaries in `.raway` library backups.

---

# Source Data

Use Open English WordNet as the source dataset.

Relevant source facts:

* Open English WordNet is a lexical network for English that groups words into
  synsets and links them through lexical relationships.
* It is available in multiple release formats, including JSON.
* The core 2025 release is listed as 135,969 words and 107,519 synsets.
* It is released under CC-BY 4.0.

Primary references:

* <https://github.com/globalwordnet/english-wordnet>
* <https://en-word.net/>
* <https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md>

Recommended dataset:

```text
Open English WordNet 2025 core JSON release
```

Avoid the 2025+ release initially. Proper nouns are less important for a reader
dictionary and can increase size/noise.

---

# Product Shape

The dictionary should be a downloadable offline pack.

ReadAway should not bundle the dictionary directly into the JavaScript bundle.
Instead:

```text
App installs small
↓
User opens Settings → Dictionary
↓
User downloads English Dictionary
↓
ReadAway stores/indexes it locally
↓
Reader lookup works offline
```

This keeps the PWA lightweight and makes dictionary storage explicit.

---

# User Flows

## First Lookup Without Dictionary

```text
User selects a word in Reader
↓
ReadAway detects no installed dictionary
↓
Dictionary panel opens
↓
"English dictionary is not installed."
"Download it for offline lookup?"
↓
[Download] [Not Now]
```

Download should not block reading permanently. The user can dismiss and continue.

## Dictionary Installation From Settings

```text
Settings
↓
Dictionary
↓
English Dictionary
↓
[Download]
```

Installed state should show:

```text
English Dictionary
Open English WordNet 2025
Installed
Size
[Remove]
```

## Reader Lookup

```text
User selects a word
↓
ReadAway normalizes selected text
↓
DictionaryService looks up exact word
↓
If not found, lemmatizer tries base forms
↓
Dictionary panel shows definitions
```

Panel content:

```text
word
part of speech
definition 1
definition 2
definition 3
```

If a selected word maps to a base form:

```text
gentlemen
gentleman
noun
...
```

If no match:

```text
No definition found.
```

---

# Data Pipeline

Add a build/preparation script that converts Open English WordNet into a
ReadAway-specific dictionary pack.

Suggested folder:

```text
scripts/dictionary/
```

Suggested commands:

```text
npm run dictionary:build
npm run dictionary:verify
```

The script should:

1. Download or read the Open English WordNet JSON release.
2. Extract lemmas, parts of speech, definitions, examples, and synonyms.
3. Remove data not needed in the first UI.
4. Generate an inflected-form map for common lookup misses.
5. Write a compact dictionary pack.
6. Write a manifest with source, version, license, attribution, checksum, and
   generated timestamp.

The generated pack should be committed only if its size is acceptable. If it is
too large for the repo, document a separate release-asset process before
implementation.

---

# Pack Format

Use a simple ReadAway-owned ZIP format using the existing `fflate` dependency.

Extension:

```text
.rawaydict
```

Structure:

```text
manifest.json
entries.json
forms.json
```

`manifest.json`:

```json
{
  "formatVersion": 1,
  "dictionaryId": "en-oewn-2025",
  "language": "en",
  "title": "English Dictionary",
  "sourceName": "Open English WordNet",
  "sourceVersion": "2025",
  "license": "CC-BY 4.0",
  "attribution": "Open English WordNet contributors",
  "generatedAt": 1767139200000,
  "entryCount": 100000,
  "formCount": 150000,
  "sha256": "..."
}
```

`entries.json`:

```json
[
  {
    "lemma": "genuine",
    "entries": [
      {
        "pos": "adj",
        "definitions": ["not fake or counterfeit"],
        "examples": [],
        "synonyms": ["authentic", "real"]
      }
    ]
  }
]
```

`forms.json`:

```json
{
  "gentlemen": ["gentleman"],
  "walked": ["walk"],
  "children": ["child"]
}
```

If `entries.json` becomes too large to parse comfortably on low-memory mobile
devices, switch to prefix shards before implementation:

```text
entries/a.json
entries/b.json
...
forms/a.json
forms/b.json
...
```

---

# Browser Storage

Use Dexie for installed dictionary indexes.

Add database version 3 with new tables:

```text
dictionaries
dictionaryEntries
dictionaryForms
```

Suggested TypeScript types:

```ts
interface DictionaryRecord {
  id: string
  language: string
  title: string
  sourceName: string
  sourceVersion: string
  license: string
  attribution: string
  entryCount: number
  formCount: number
  installedAt: number
  sizeBytes: number
}

interface DictionaryEntryRecord {
  key: string
  dictionaryId: string
  lemma: string
  normalizedLemma: string
  entriesJson: string
}

interface DictionaryFormRecord {
  key: string
  dictionaryId: string
  normalizedForm: string
  lemmasJson: string
}
```

Dexie indexes:

```text
dictionaries: &id, language, installedAt
dictionaryEntries: &key, dictionaryId, normalizedLemma
dictionaryForms: &key, dictionaryId, normalizedForm
```

`key` should be:

```text
dictionaryId + ":" + normalized word
```

Do not store dictionary data in `.raway` backups. Dictionaries can be removed
and reinstalled independently from the user library.

---

# Download Strategy

Dictionary download should be explicit.

Dictionary packs must be hosted as static assets with the app:

```text
/dictionaries/en-oewn-2025.rawaydict
/dictionaries/manifest.json
```

This is still zero server infrastructure if deployed as static assets alongside
the PWA.

The PWA service worker should not precache dictionary packs by default. The
dictionary is downloaded only after user action, then imported into IndexedDB.

Manual dictionary import is intentionally out of scope. ReadAway should own the
dictionary pack format, version, checksum, install flow, and attribution copy.
Users should not need to manage dictionary files directly.

Download flow:

1. Fetch dictionary manifest.
2. Show size and source.
3. Fetch `.rawaydict`.
4. Verify checksum.
5. Unzip.
6. Validate manifest.
7. Bulk insert entries/forms into Dexie.
8. Mark dictionary installed.

If download fails:

```text
Dictionary download failed. Check your connection and try again.
```

The installed dictionary must continue working offline.

---

# Lemmatization

Lookup order:

1. Normalize selected text.
2. Exact dictionary entry lookup.
3. Form map lookup.
4. Runtime rule-based fallback.
5. No-definition result.

Normalization:

* Trim whitespace.
* Remove leading/trailing punctuation.
* Normalize curly apostrophes to straight apostrophes.
* Lowercase.
* Strip possessive suffixes:

```text
man's → man
dogs' → dog
```

Form map:

Generated at dictionary-pack build time. It should include common irregulars
and reliable inflections:

```text
children → child
men → man
women → woman
gentlemen → gentleman
was → be
were → be
went → go
better → good
```

Rule-based fallback:

Nouns:

```text
stories → story
classes → class
dogs → dog
```

Verbs:

```text
walking → walk
walked → walk
tries → try
```

Adjectives/adverbs:

```text
happier → happy
happiest → happy
```

Keep the runtime lemmatizer conservative. It should prefer returning no match
over producing silly definitions.

---

# Reader Integration

Reader word selection is the trickiest browser-facing part because EPUB content
is rendered inside epub.js-managed documents.

Implementation needs current epub.js/browser API review before coding.

Expected approach:

* Listen for epub.js selection events if available.
* Read selected text from the contents document/window.
* Ignore multi-paragraph selections.
* Collapse whitespace.
* Open dictionary lookup only for a single selected word.
* Ignore multi-word, full-line, or multi-paragraph selections.
* Open the Dictionary Panel from the right, matching Contents and Appearance.
* Keep the selected word visible in the panel header/content.

The dictionary panel should close when:

* User taps outside.
* User turns the page.
* User opens TOC or Appearance.
* User presses Escape.

---

# Services

Add `DictionaryService`.

Responsibilities:

* Download dictionary manifest.
* Download dictionary pack.
* Verify dictionary pack checksum.
* Install dictionary into IndexedDB.
* Remove installed dictionary.
* Report installed dictionary status.
* Normalize selected text.
* Lemmatize selected word.
* Lookup definitions.

Feature components should not query dictionary tables directly.

Suggested service API:

```ts
type DictionaryLookupResult =
  | {
      status: 'found'
      query: string
      lemma: string
      entries: DictionaryDefinitionGroup[]
    }
  | {
      status: 'not_found'
      query: string
    }
  | {
      status: 'not_installed'
      query: string
    }

async function getInstalledDictionary(): Promise<DictionaryRecord | null>
async function installDictionary(onProgress?: (pct: number) => void): Promise<void>
async function removeDictionary(dictionaryId: string): Promise<void>
async function lookupWord(word: string): Promise<DictionaryLookupResult>
```

---

# UI Changes

Documentation contract:

* `docs/PRD.md` defines dictionary scope and offline behavior.
* `docs/SCREEN_SPEC.md` defines Settings dictionary management and the Reader
  Dictionary Panel.
* `docs/ARCHITECTURE.md` defines dictionary tables, static asset rules, and
  `DictionaryService`.

Settings section:

```text
Dictionary

English Dictionary
Open English WordNet

[Download] or [Remove]
```

Reader panel:

```text
Dictionary

selected word
part of speech
definition
definition
definition
```

Keep the panel visually quiet and readable over all page colors.

---

# Testing Plan

Unit tests:

* Word normalization.
* Lemmatization rules.
* Form-map lookup.
* Lookup result ordering.
* Missing dictionary behavior.
* Pack manifest validation.

Integration tests:

* Install dictionary pack into Dexie.
* Lookup exact word after install.
* Lookup inflected word after install.
* Remove dictionary.

Reader tests:

* Selecting a word opens the dictionary panel.
* Page turn closes the dictionary panel.
* Missing dictionary shows install prompt.

Manual tests:

* Android tablet PWA.
* Desktop browser.
* Offline lookup after install.
* Low-memory behavior with first dictionary load.

---

# Implementation Plan

## Phase 0: Documentation Contract

Status:

```text
Complete
```

Updated:

* `docs/PRD.md`
* `docs/SCREEN_SPEC.md`
* `docs/ARCHITECTURE.md`

Exit criteria:

* Dictionary is in scope.
* Manual dictionary import is out of scope.
* Static `.rawaydict` download is the required install path.
* Storage, service boundaries, and UI surfaces are documented.

## Phase 1: Dictionary Pack Pipeline

Build the Open English WordNet conversion script.

Deliverables:

* `scripts/dictionary/build-oewn-dictionary.mjs`
* `scripts/dictionary/verify-oewn-dictionary.mjs`
* `public/dictionaries/manifest.json`
* `public/dictionaries/en-oewn-2025.rawaydict`
* Size report in script output

Exit criteria:

* Generated pack is valid ZIP.
* Generated pack contains `manifest.json`, `entries.json`, and `forms.json`.
* Generated pack checksum matches public dictionary manifest.
* Compressed size is at or below the soft limit unless explicitly accepted.
* Representative lookups are verified:

```text
genuine
gentlemen → gentleman
children → child
walked → walk
better → good
```

Implementation notes:

* Download the source zip from the Open English WordNet GitHub release by
  default.
* Cache the downloaded source at `.cache/dictionary/english-wordnet-2025-json.zip`.
* Accept an explicit local path or URL argument for rebuilding from another
  source.
* Keep the source zip out of runtime app assets and out of git.
* Use Node scripts and existing project dependencies where reasonable.
* Add scripts to `package.json` only when the script names are stable.

## Phase 2: Types, Storage, and Migration

Add dictionary types and Dexie version 3 tables.

Deliverables:

* Dictionary-related types in `src/types`.
* Dexie version 3 migration in `src/db`.
* Table definitions for `dictionaries`, `dictionaryEntries`, and
  `dictionaryForms`.

Exit criteria:

* Existing libraries migrate without data loss.
* Empty dictionary tables are available after app start.
* TypeScript build passes.

## Phase 3: DictionaryService

Add `DictionaryService`.

Deliverables:

* Manifest fetch.
* Pack download.
* Checksum verification.
* Pack validation.
* Chunked install into Dexie.
* Remove dictionary.
* Installed status lookup.
* Word normalization.
* Form-map lookup.
* Conservative rule-based lemmatization.
* Definition lookup.

Exit criteria:

* Dictionary installs.
* Dictionary removes.
* Exact and lemmatized lookup work from tests.
* Failed download and failed checksum are handled clearly.
* Lookup works after reload with no network connection.

## Phase 4: Settings UI

Add dictionary install/remove UI in Settings.

Deliverables:

* Dictionary section in Settings.
* Download progress state.
* Installed state.
* Remove action.
* Source, version, license, and attribution display.

Exit criteria:

* User can install/remove the English dictionary.
* UI shows installed state and attribution.
* In-progress install cannot be started twice.
* Removing dictionary does not affect books or progress.

## Phase 5: Reader Selection UI

Add word selection and dictionary panel.

Deliverables:

* Selection detection inside epub.js rendered content.
* Single-word extraction.
* Dictionary panel component inside reader feature.
* Not-installed state with download action.
* Found and not-found states.
* Close behavior on outside tap, page turn, panel open, and Escape.

Exit criteria:

* Selecting a word opens lookup.
* Lookup works offline.
* Panel closes predictably.
* Reader page turn and swipe still work.
* TOC and Appearance panels close or suppress the dictionary panel.

## Phase 6: Polish

Refine:

* Definition ordering.
* Mobile drawer behavior.
* Loading states.
* Error messages.
* Attribution copy.
* Storage usage display, if app storage estimates are implemented at the same
  time.

Exit criteria:

* Android tablet PWA manual test passes.
* Desktop browser manual test passes.
* Offline dictionary lookup manual test passes.
* Dictionary UI remains readable on Light, Dark, and Black page colors.

---

# Risks

## Dictionary Size

Even a compact English dictionary can be large for a PWA. The first pipeline
task must measure actual generated size before UI implementation.

## IndexedDB Install Time

Bulk inserting many entries may be slow on mobile devices. Use chunked bulk
inserts and progress reporting.

## Selection Inside epub.js

Selection events inside EPUB iframes can vary across browsers. This needs early
prototype validation on Android and desktop.

## Definition Quality

WordNet is reliable but not always reader-friendly. We may need definition
ordering and synonym filtering to make dictionary panels feel natural.

## Licensing

CC-BY 4.0 attribution must be visible in Settings/About and in the dictionary
metadata. If we transform the data, keep source/version/license metadata with
the generated pack.

---

# Recommended Decisions For Open Questions

These recommendations are based on the downloaded
`english-wordnet-2025-json.zip` reference file. The source zip is about 9.6 MB
compressed and about 72 MB expanded, with entries already split across multiple
JSON files.

## Download Source

Recommendation:

```text
Download the first dictionary pack from the same static deployment as ReadAway.
```

Use:

```text
/dictionaries/manifest.json
/dictionaries/en-oewn-2025.rawaydict
```

Rationale:

* The pack is not huge.
* Static hosting preserves zero server infrastructure.
* ReadAway controls checksum, version, and expected format.
* The user gets a one-tap install instead of a file-management workflow.

Manual import should not be implemented.

## Maximum Download Size

Recommendation:

```text
Target: 10-15 MB compressed
Soft limit: 25 MB compressed
Hard stop: 40 MB compressed
```

If the generated `.rawaydict` is above 25 MB, reconsider what is included.

Rationale:

* The source zip is already 9.6 MB.
* A trimmed ReadAway pack should ideally stay near or below that size.
* 10-15 MB is acceptable as an explicit user-initiated offline dictionary
  download.
* Above 25 MB starts to feel heavy for a PWA feature.

## Entry Point

Recommendation:

```text
Make dictionary install available from both Settings and first lookup.
```

Settings is the primary management surface:

```text
Settings → Dictionary → Download / Remove
```

Reader first-use prompt is the contextual surface:

```text
Select word → Dictionary not installed → Download?
```

Rationale:

* Settings is predictable.
* First lookup is discoverable at the moment the user needs it.
* The reader prompt should be dismissible and should not interrupt page turns or
  reading flow after dismissal.

## Examples

Recommendation:

```text
Include examples in storage, but show only definitions in the first panel UI.
```

Rationale:

* Open English WordNet includes useful examples.
* Keeping examples in the pack avoids a migration if the UI later expands.
* The first panel should stay compact.
* UI can show examples later behind "More" or in a full dictionary detail view.

If size becomes a problem, examples are the first data to remove.

## Definition Capping

Recommendation:

```text
Do not cap definitions in storage.
Cap display in UI.
```

Initial UI cap:

```text
3 definition groups or 5 total definitions, whichever comes first.
```

Rationale:

* Storage should preserve the source data we intentionally include.
* UI should avoid turning dictionary lookup into a scroll-heavy article.
* Capping only in UI lets us add "Full Definition" later without reinstalling
  dictionary data.

## Storage Usage

Recommendation:

```text
Include dictionary data in app storage usage estimates.
```

Settings should eventually show storage split by:

```text
Books
Dictionaries
Other app data
```

Rationale:

* Dictionaries can be one of the largest user-controlled storage items.
* Users should understand what removing the dictionary will free.
* This matches the ownership tone of ReadAway.
