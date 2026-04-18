# Signal Garden API — Healthy Sources Feed

This directory provides a simple read-only endpoint for external consumers to fetch only the healthy sources from the garden.

## How It Works

Signal Garden pulls live source-health data from [AlbertAlert](https://github.com/potemkin666/AlbertAlert). The `api/index.html` page loads and transforms this data, filtering to only **healthy** sources (excluding quarantined), and displays the result as copyable/downloadable JSON.

## Upstream data

AlbertAlert publishes its hourly feed at:

```
https://raw.githubusercontent.com/potemkin666/AlbertAlert/main/live-alerts.json
```

Signal Garden extracts the `health.sources` block and derives per-source status, freshness, reliability, and failure counts.

## Fetching healthy sources

From any consuming repo, fetch the garden's processed sources and filter:

```js
const GARDEN_URL = 'https://potemkin666.github.io/garden/data/sources.json';

async function getHealthySources() {
  const res = await fetch(GARDEN_URL);
  const sources = await res.json();
  return sources.filter(s => s.status === 'healthy' && !s.quarantined);
}
```

> **Note:** The local `data/sources.json` is a fallback fixture. In production, the garden derives its data live from AlbertAlert on each page load.

## Using the API page

Visit `https://potemkin666.github.io/garden/api/` in a browser to:
- View the filtered healthy sources as JSON
- Copy to clipboard
- Download as `healthy-sources.json`

## Source Data Model

Each source object contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique source identifier |
| `name` | string | Human-readable source name |
| `category` | string | Source category (news, finance, tech, etc.) |
| `status` | string | `healthy`, `stale`, `failing`, `blocked`, `dead`, `recovering`, `quarantined` |
| `lastSuccessAt` | ISO 8601 | Last successful fetch timestamp |
| `lastFailureAt` | ISO 8601 | Last failure timestamp |
| `failureCount` | number | Total failure count |
| `freshnessScore` | number | 0–100, how fresh the data is |
| `reliabilityScore` | number | 0–100, overall reliability |
| `blockedReason` | string? | Why the source is blocked (if applicable) |
| `quarantined` | boolean | Whether the source is quarantined |
| `incidentCountRecent` | number | Recent incident count |
| `incidentSeverity` | string? | `low`, `medium`, `high`, `critical` |
| `notes` | string | Operational notes |

## Filtering Logic

A source is considered **healthy for the news feed** if:

```js
source.status === 'healthy' && !source.quarantined
```

Sources with `status: 'healthy'` that also have active high-severity incidents will appear as "flowering" in the garden UI, but their raw status is still `'healthy'` in the data file — so they will be included in the healthy feed.
