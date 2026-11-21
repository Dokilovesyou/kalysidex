# Kalysidex

A searchable Pokédex for the Kalysian Pokémon. It is a plain website (HTML, CSS and JavaScript): no server, no database, nothing to install.

**Try it right now:** double-click `index.html`. It opens in your browser and works offline.

## What it can do

- **Search** by Pokémon name. Suggestions also pop up for moves and abilities. Press `/` to jump to the search box.
- **Filter** by type (pick two for dual types), ability, egg group, habitat, diet, size class and capability.
- **Search by move:** type a move into "Learns move" and the table shows every Pokémon that learns it, with how (level, egg, TM, tutor). "Learned by" narrows it to one method.
- **Sort** by name, any stat, base stat total, height, weight, or the level a move is learned. Click a column header or use the Sort menu.
- **Move and ability pages** list every move or ability, with how many Pokémon have it. Click one to see who has it. You can still filter and sort from there.
- **Colour themes:** each Pokémon's page takes on its primary type's colour (pink for Fairy, orange for Fire, and so on). Filtering by one type, or opening a move, does the same, and it follows light/dark mode.
- **Custom moves and abilities** from your doc show their full details (frequency, damage base, range, effect…) on their pages. Hover an ability on a Pokémon's page to see its effect.
- **Six dexes in one place:** the Kalysian Pokédex, Okeanos, Paradox, Poképark, Event and Expanded Hisuian. Use the **Dex** buttons above the filters to look at one, or leave it on *All* to search across everything. Each Pokémon's page shows which dex it's from and its previous/next buttons stay inside that dex.
- Every filter is saved in the web address, so you can copy and share a link to a search.

## Adding another Pokédex later (Gym Type Shifts, Paldea, Divergent…)

1. Download that Google Doc as **Web Page (.html, zipped)** and unzip it.
2. Open `tools/import-dex.html`, pick the folder, type a short id (for example `paldea`), the full name and a tab label. Leave "Also create the data file" **ticked**.
3. Press **Process**, then **Download zip**, and unzip it into your Kalysidex folder.
4. Open the `WHAT-TO-DO` note in the zip. It gives you two lines to paste: one into `index.html`, one into `data/collections.js`. The new dex then gets its own tab.

Anything the tool is unsure about (a name it had to guess, say) is flagged in the page after you press Process, and every entry should be double-checked against your doc.

## Adding or fixing Pokémon by hand

**One at a time:**

1. Double-click `tools/add-pokemon.html`.
2. Copy one Pokémon's entry from your doc and paste it into the box. Look at `tools/example-entry.txt` to see the layout it expects.
3. Check the preview, then click **Add to list**. Repeat for the rest.
4. Click **Download pokemon.js** and use that file to replace `data/pokemon.js` in the project (this tool only knows the main Kalysian dex).
5. Save each sprite as `img/pokemon/<id>.png` (and, optionally, a small `img/thumbs/<id>.png`). The id is the lowercase name, for example `grytle.png`. Pokémon without an image show a "?" placeholder.

You can also edit the data files in `data/` by hand: they're plain text, one block per Pokémon.

Tips for consistent data:
- Capitals, spaces and hyphens don't matter ("Solar Beam", "Solarbeam" and "solar-beam" count as one move), but real spelling differences do ("Solarbeam" vs "Solarbean" would be two moves).
- A Pokémon's dex number is optional. Without one, the Pokédex keeps them in the order they are in the data file.
- Different forms of one Pokémon (like Chamelust's three formes) can be linked as tabs over the picture: give each form entry the same `"formGroup"` (the species name) and its own `"formLabel"` (the tab text) in the data file.
- Pokémon listed in an evolution line but not yet in the dex appear greyed out, and become clickable once you add them.

## Files

| File | What it is |
|---|---|
| `index.html` | the page |
| `css/style.css` | colours and layout |
| `js/app.js` | search, filters, sorting and pages |
| `js/parser.js` | reads pasted entries |
| `data/pokemon.js` | the main Kalysian Pokédex data (you can edit this by hand) |
| `data/pokemon-<dex>.js` | one file per extra dex (Okeanos, Paradox, Poképark, Event, Hisuian) |
| `data/collections.js` | the list of dexes shown as tabs |
| `data/moves.js`, `data/abilities.js` | details for the custom moves and abilities |
| `tools/image-names.txt` | the file name each Pokémon's picture should have |
| `img/pokemon/`, `img/thumbs/` | Pokémon pictures (full size and small list thumbnails) |
| `tools/add-pokemon.html` | paste-in tool for adding Pokémon one at a time |
| `tools/import-dex.html` | imports a whole Google Doc dex with its pictures |

## Coming later

Items, the remaining dexes (Gym Type Shifts, Dojo Type Shifts, Paldea, Divergent) and details for the official moves can each get their own data file, loaded the same way.
