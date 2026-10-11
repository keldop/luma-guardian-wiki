# Luma Guardian Wiki

A fandom-style wiki that runs on GitHub Pages with no build step. It lives at `https://<you>.github.io/<repo>/wiki/` (the site root redirects there).

## Pages

| Page | Address | What it shows |
| --- | --- | --- |
| Home | `index.html` | Stats, the four elements, featured Guardian, lore, teams |
| Guardians | `characters.html` | Every Guardian, with search and filters. Filters stay in the address (`?element=Fire&team=Eclipse`) so a list can be shared |
| Guardian profile | `character.html?id=blossom` or `?name=Blossom` | One page for every Guardian: infobox, overview, story profile, branch and lineage, disciples, relationships |
| Lore | `lore.html`, `?tab=crystal`, `?q=astral` | One article per tab of the story doc, plus search |
| Map | `map.html`, `?place=singapore` | Guardian bases, guilds, LumaSoft branches and crystal sites |
| Branch tree | `tree.html` | Element > Branch > Sub-branch diagrams. Click a box for a quick profile, View full info, or the Guardian's wiki page |

The moon/sun button switches dark and light mode on every page. The choice is remembered on that device. Every page works at phone width.

## Folder layout

Every page follows the same pattern: a short `.html` file, its script in `assets/<page>.js`, and shared styles and helpers in `assets/wiki.css` and `assets/wiki.js`.

| Folder | Holds |
| --- | --- |
| `assets/` | `wiki.css`, `wiki.js` (header, search, theme toggle, data loading), `story.js` (story doc reader), one script per page, plus `tree.css` and `tree-colors.css` for the branch tree |
| `data/` | All content: `branches.json`, `story.md`, `lore.json`, `locations.json`, `wiki.json` |
| `tools/` | `update-story.ps1` (refresh the story), `serve.ps1` (local preview) |
| `images/` | Create it for Guardian portraits, then reference them from `lore.json` |

## Editing content

| File | Holds | Edit it to |
| --- | --- | --- |
| `data/branches.json` | Guardians, branches, mentors, disciples, Zodiac roots | Add a Guardian and their wiki page and tree box appear |
| `data/story.md` | The story doc (Luma Guardian About), made by `tools/update-story.ps1` | Do not edit by hand. Edit the Google Doc, then refresh (below) |
| `data/lore.json` | Optional extras per Guardian: image, quote, trivia, extra sections | Add a portrait: `"Blossom": {"image": "images/blossom.png"}` |
| `data/locations.json` | Map places and layers | Add a place, move a pin, or swap to your own drawn map (`"mode": "image"`) |
| `data/wiki.json` | Title, featured Guardian, hidden fields, excluded doc tabs | Change the featured Guardian (currently Blossom; `""` rotates daily), hide more fields |
| `assets/tree-colors.css` | Every branch-tree box colour | Change colours |

A Guardian's **Story profile** section is their write-up from the doc, matched by the heading `Luma <Name>`. A character who is in the doc but not in `branches.json` (for example Luma Quell) still gets a page, marked "Story only".

### branches.json

- `branches`: one path per line, written as `Element-Branch-Subbranch`. Parents are created automatically. A path with no Guardian shows as a gray dashed box. The order of first-level branches sets their top-to-bottom order and shade.
- `guardians`: one profile per Guardian with `name`, `path` (for example `Fire-Lumen-Moon-Blossom`) and optional rank, mentor, role, team, guild, zodiac, base, disciples, status, plus `sameAs` and `form` (`original` or `evolved`) to mark two names as the same person, like Flora and EmberFlora. A Guardian with an empty `path` goes to the No branch yet tab.
- `zodiacRoots`: names that sit to the left of an element.
- `overrides`: `from-path => to-path`, for when the doc writes the same branch two ways.
- `hiddenFields`: fields never shown.

### Branch tree colours

- **Zodiac colours:** a Zodiac root and its first-generation disciples share one colour. Edit the `z-<zodiac>` rules in `assets/tree-colors.css`. Each later generation fades lighter (`gen-2` to `gen-5`).
- **Retired and deceased:** `st-retired` and `st-deceased`, with an R or dagger badge. Set them with `"status"` in `branches.json`.
- **Per branch:** `.node.b-lumen { ... }` and so on at the bottom of `tree-colors.css`.

## Refreshing the story from the Google Doc

Google's own download only saves the open tab, so the simplest refresh is to ask Claude (with Google Drive connected) to re-import the doc into `data/story.md`.

If you have a Markdown copy of the whole doc, where each tab starts with a `# Tab name` line ending in two spaces:

    powershell -ExecutionPolicy Bypass -File wiki\tools\update-story.ps1 -Source "path\to\Luma Guardian About.md"

## Privacy

GitHub Pages makes everything in the repo public, including everything in `data/`.

- The import script deletes every `Label: value` line whose label is in `hideFields` (`data/wiki.json`) or `hiddenFields` (`data/branches.json`): civilian name, date of birth, height, weight, blood type and the body measurements.
- Civilian names written inside normal sentences are **not** removed. For example, the LumaSoft tab mentions Lumina by name. Check `story.md` before you push if that matters.
- The `Tab 19` tab (removed concepts) is left out. Add tab names to `storyExcludeTabs` to leave out others.
- The wiki pages hide the same fields, but `branches.json` itself still contains some civilian names (`Civilian Name` in 24 profiles), and the branch tree's View full info shows them.

## Run locally

Double-clicking an HTML file will not work, because the browser blocks the JSON files. Start the small server instead (no Python needed), from the repo folder:

    powershell -ExecutionPolicy Bypass -File wiki\tools\serve.ps1

then open http://localhost:8000/ .

## Libraries

Loaded from cdnjs at fixed versions: Leaflet 1.9.4 (map), marked 12.0.2 and DOMPurify 3.1.6 (story text). Map tiles are © OpenStreetMap contributors.
