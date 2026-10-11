# Luma Guardian Wiki

A fandom-style wiki for the Luma Guardian story: Guardian profiles, lore, an interactive map and the branch tree. It runs on GitHub Pages with no build step.

Everything lives in [`wiki/`](wiki/). The `index.html` at the top level only sends visitors of the site root to `wiki/`.

```
index.html            redirect to wiki/
wiki/
  index.html          Home
  characters.html     All Guardians, with search and filters
  character.html      One Guardian (character.html?name=Blossom)
  lore.html           Story bible articles and search
  map.html            Interactive map
  tree.html           Branch tree diagrams
  assets/             Styles and scripts, one .js per page plus shared wiki.css / wiki.js
  data/               branches.json, story.md, lore.json, locations.json, wiki.json
  tools/              update-story.ps1, serve.ps1
```

See [wiki/README.md](wiki/README.md) for how to edit content, refresh the story, and run it locally.
