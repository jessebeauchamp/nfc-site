# No Filter Creative — website

Plain static site: `index.html`, `styles.css`, `main.js`, and `media/`.
No build step. Any static host (Netlify, Vercel, Cloudflare Pages) serves this folder as-is.

- Phones (860 px wide and under) get the `-m` video files and the 4:5 hero cut (`reel-m.mp4`).
- Videos load only when scrolled near and pause off screen.
- To add or swap work: replace files in `media/` and update `index.html`.

## Design options (presentation only)
- `index.html` — Option 01 (heat-map Ø). `option-02.html` — LED-wall reel with a "no filter" lens. `option-03.html` — liquid-glass Ø.
- The OPTION 01/02/03 bar is for presenting only: delete the `<nav class="opt-bar">` block from each page and set `--bar-h: 0` in `styles.css` for launch.
