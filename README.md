# Signal Garden

> *A visual source-health dashboard where live feeds grow as plants.*

---

## Concept

Signal Garden turns source monitoring data into a living garden. Each feed, scraper, or alert source is represented as a plant. Its appearance — posture, color, bloom state, decay, thorns — reflects the source's current health at a glance.

The interface is designed to be instantly legible: you know something is wrong before you read a single number.

---

## Screenshot / Demo

*Open `index.html` in a browser (or deploy to GitHub Pages) to see the populated garden.*

The garden loads immediately with 20 mock sources covering all visual states:

| State | Visual |
|-------|--------|
| Healthy | Upright green plant, flowers, gentle sway |
| Flowering | Bright blooms with glow pulse — recent high-priority incidents |
| Stale | Drooping yellowish leaves, no flowers |
| Failing | Bent stem, browning leaves, decay spots |
| Blocked | Dark thorned vine, hostile animation |
| Dead | Collapsed stem, dried husk, no motion |
| Recovering | Mixed old/new growth, fresh shoots |
| Quarantined | Plant enclosed in a glass bell jar |

---

## Visual Metaphor System

Each source metric maps to a visual property:

| Metric | Visual effect |
|--------|--------------|
| `freshnessScore` | Bloom fullness, flower count |
| `reliabilityScore` | Stem height and rigidity |
| `failureCount` | Leaf decay, browning, drooping |
| `status: blocked` | Black thorned vine, thorns on stem |
| `status: dead` | Collapsed stem, grey coloring |
| `status: recovering` | New shoots from base, two-tone coloring |
| `quarantined: true` | Glass bell jar overlay |
| `incidentCountRecent > 0` + high severity | Glowing flower pulse |

The mapping lives entirely in `modules/state-map.js` — one place to tune all visual rules.

---

## Data Model

Each source object (in `data/mock-sources.json`) supports:

```json
{
  "id": "src-001",
  "name": "Reuters Wire",
  "category": "news",
  "status": "healthy",
  "lastSuccessAt": "2026-04-17T19:40:00Z",
  "lastFailureAt": "2026-04-08T11:14:00Z",
  "failureCount": 3,
  "freshnessScore": 97,
  "reliabilityScore": 99,
  "blockedReason": null,
  "quarantined": false,
  "incidentCountRecent": 0,
  "incidentSeverity": null,
  "notes": "Primary wire feed."
}
```

**Status values:** `healthy` · `stale` · `failing` · `blocked` · `dead` · `recovering` · `quarantined`

**incidentSeverity values:** `low` · `medium` · `high` · `critical`

---

## File Structure

```
signal-garden/
├── index.html              # App shell
├── styles.css              # Dark gothic botanical stylesheet
├── app.js                  # Entry point — wires all modules
├── data/
│   └── mock-sources.json   # Fixture data (20 sources)
└── modules/
    ├── data.js             # Data loading and normalization
    ├── state-map.js        # Status → visual property mapping
    ├── render-plant.js     # SVG plant generator (parametric)
    ├── render-garden.js    # Garden grid and list view rendering
    ├── detail-panel.js     # Source detail side panel
    ├── filters.js          # Filter, sort, and search logic
    └── utils.js            # Shared helpers
```

---

## Local Run

No build step required. Serve the project root over HTTP:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .

# VS Code: use the "Live Server" extension
```

Then open `http://localhost:8080` in a browser.

> **Note:** Opening `index.html` directly as a `file://` URL will fail due to ES module CORS restrictions. Always use a local server.

---

## GitHub Pages Deployment

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Set Source to **Deploy from a branch**, select `main`, folder `/` (root).
4. Save. The site will be live at `https://<user>.github.io/<repo>/` within a minute.

No build process is required. All assets are static.

---

## Connecting Real Feed Data

To replace mock data with a live pipeline:

1. Generate a JSON array conforming to the data model above from your pipeline.
2. Either:
   - Replace `data/mock-sources.json` with your output file, **or**
   - Edit `modules/data.js` → `loadSources()` to fetch from your API endpoint.

The rest of the application will work without changes. The `normalizeSource()` function in `data.js` handles missing or partial fields gracefully.

---

## Roadmap

- [ ] Time slider — watch the garden degrade and recover across hours/days
- [ ] Storm mode — widespread failures affect the whole garden environment
- [ ] Garden beds — cluster plants by source category
- [ ] Ambient effects — drifting spores, fog, moonlight changes
- [ ] Trend sparklines in the detail panel
- [ ] Watchlist / pinned plants
- [ ] Source history timeline
- [ ] JSON snapshot export/import
- [ ] Full accessibility pass (contrast, reduced motion, keyboard nav)
- [ ] Live WebSocket feed adapter

---

*Made to be useful. Designed to be strange.*
