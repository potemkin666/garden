# Signal Garden

> *A visual source-health dashboard where live feeds grow as plants.*

---

## Concept

Signal Garden turns source monitoring data into a living garden. Each feed, scraper, or alert source is represented as a plant. Its appearance — posture, color, bloom state, decay, thorns — reflects the source's current health at a glance.

The interface is designed to be instantly legible: you know something is wrong before you read a single number.

---

## Data Source — AlbertAlert

Signal Garden pulls live source-health data from [AlbertAlert](https://github.com/potemkin666/AlbertAlert), a terrorism monitoring web app with a curated catalog of 550+ sources. AlbertAlert's hourly feed builder tracks per-source health metrics (health score, failure counts, quarantine status, error categories) which Signal Garden transforms into its visual model.

On each page load, the garden fetches `live-alerts.json` from AlbertAlert and maps every tracked source to a plant. If the fetch fails, it falls back to a local `data/sources.json` fixture.

---

## Screenshot / Demo

*Open `index.html` in a browser (or deploy to GitHub Pages) to see the populated garden.*

Source states are derived from AlbertAlert health metrics:

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

## Adding Sources

### Via the UI

Click **+ Add Source** in the header to open the source form. Fill in:
- **Name** (required)
- **Category** (e.g. news, finance, tech)
- **Status** (healthy, stale, failing, blocked, dead, recovering, quarantined)
- **Freshness / Reliability scores** (0–100)
- **Failure count, incident details, notes**

User-added sources are stored in the browser's `localStorage` and merged with the base `data/sources.json` on every load. They persist across page reloads.

To remove a user-added source, click it → open the detail panel → click **Remove from garden**.

### Via JSON

Edit `data/sources.json` directly. Each source object follows the data model below.

### Exporting

- **↓ Export** — downloads all sources (base + user-added) as `sources.json`
- **↓ Healthy** — downloads only healthy sources as `healthy-sources.json`

---

## AlbertAlert Integration

Signal Garden consumes source-health data from [AlbertAlert](https://github.com/potemkin666/AlbertAlert). The data flow:

1. AlbertAlert's hourly feed builder checks 550+ sources and writes health metrics into `live-alerts.json`.
2. Signal Garden fetches `live-alerts.json` and extracts the `health.sources` block.
3. Each source's health score, failure count, quarantine status, and error history are mapped to the garden's visual model.

### API page

Visit `https://potemkin666.github.io/garden/api/` for a filtered view of healthy sources with copy/download buttons. See [`api/README.md`](api/README.md) for full details.

### Status derivation

| AlbertAlert condition | Garden status |
|----------------------|---------------|
| `quarantined: true` | quarantined |
| Dead URL failures | dead |
| Blocked/auth/anti-bot errors | blocked |
| Consecutive failures > 2 or health score < 20 | failing |
| Health score < 50 | stale |
| Health score 50–80 with mixed success/failure | recovering |
| Health score ≥ 80 | healthy |

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

Each source object (in `data/sources.json`) supports:

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
garden/
├── index.html              # App shell
├── 404.html                # Custom 404 page for GitHub Pages
├── styles.css              # Dark gothic botanical stylesheet
├── app.js                  # Entry point — wires all modules
├── .nojekyll               # Disables Jekyll on GitHub Pages
├── .github/
│   └── workflows/
│       └── pages.yml       # GitHub Actions deploy workflow
├── data/
│   └── sources.json        # Local fallback data (used when AlbertAlert is unreachable)
├── api/
│   ├── index.html          # Healthy sources viewer for external consumers
│   └── README.md           # AlbertAlert integration docs
└── modules/
    ├── data.js             # Data loading (AlbertAlert fetch + localStorage merge)
    ├── state-map.js        # Status → visual property mapping
    ├── render-plant.js     # SVG plant generator (parametric)
    ├── render-garden.js    # Garden grid and list view rendering
    ├── detail-panel.js     # Source detail side panel
    ├── add-source.js       # Add/edit source modal form
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

A GitHub Actions workflow (`.github/workflows/pages.yml`) is included and will deploy automatically on every push to `main`.

**One-time setup:**

1. Push the repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, select **GitHub Actions**.
4. That's it — the next push to `main` triggers a deploy.

The site will be live at `https://potemkin666.github.io/garden/` within a minute.

No build process is required. All assets are static. A `.nojekyll` file is included to prevent GitHub Pages from running Jekyll processing.

---

## Connecting a Different Feed

To swap the data source:

1. Edit `modules/data.js` → change `ALBERTALERT_LIVE_URL` to your feed's URL.
2. Adjust `transformAlbertAlertSource()` (or add a new transform) to map your payload to the garden's data model.
3. Alternatively, replace `data/sources.json` with a JSON array conforming to the data model above — it is used as a local fallback.

The `normalizeSource()` function in `data.js` handles missing or partial fields gracefully.

---

## Roadmap

- [x] Add Source UI with localStorage persistence
- [x] Export all / export healthy sources as JSON
- [x] AlbertAlert integration — live source-health data from 550+ sources
- [x] Ambient particle effects and atmospheric background
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
