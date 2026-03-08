# Setup Guide (Live APIs + Dwell Pipeline)

This guide explains how to run the backend with live services and avoid the common case where `/dwell` returns hardcoded products even when `PRODUCT_SOURCING_MODE=serpapi`.

## 1. Prerequisites

- Node.js 18+
- npm
- A test image at repo root named `image.png` (or set `DWELL_TEST_IMAGE`)

## 2. Required API Accounts

You need valid keys for all of these:

- Gemini (`GEMINI_API_KEY`)
- Backboard (`BACKBOARD_API_KEY`, optional custom `BACKBOARD_BASE_URL`)
- SerpAPI (`SERPAPI_KEY`)
- Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)

Important: in this codebase, all env vars above are required at startup by `src/config/settings.ts`, even if a feature is disabled.

## 3. Configure `.env`

Create `.env` from `.env.example` and set real values:

```env
GEMINI_API_KEY=...
BACKBOARD_API_KEY=...
BACKBOARD_BASE_URL=https://api.backboard.io

PRODUCT_SOURCING_MODE=serpapi
SERPAPI_KEY=...

# keep false while debugging sourcing behavior
CLOUDINARY_ENABLED=false
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

HOST=0.0.0.0
PORT=8000
DEBUG=true
```

## 4. Install and Start

```bash
npm install
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected: `sourcing_mode` should be `serpapi`.

## 5. Run the Dwell Workflow Test

In a new terminal:

```bash
npm run test:dwell
```

This script:

- calls `/health`
- posts a screenshot to `/dwell`
- prints summary + full JSON
- tries to download one sample product image

## 6. Verify It Is Truly Using Live Sources

Look at the response `source` fields:

- `current_product.source` should be `serpapi_lens`
- `taste_picks[*].source` should be `serpapi_shopping`

If either shows `hardcoded`, fallback was triggered.

## 7. Why Hardcoded Still Appears in SerpAPI Mode

This is expected in a few situations:

1. Cat2 query is empty on first run.
- `sourceCat2` falls back when `!query`.
- Query is composed from profile fields (`preferred_styles`, `preferred_colors`, etc.).
- If profile is empty/unknown, Cat2 returns hardcoded picks.

2. Cat2 uses profile before Gemini finishes update.
- `/dwell` runs Cat1, Cat2, and Gemini concurrently.
- Cat2 starts with the current profile, not the newly inferred signals from this same request.
- Result: first dwell for a user can be hardcoded; next dwell is usually better.

3. Cat1 falls back when Lens call fails or has no usable top match.
- Network issues, API quota, invalid image payload, or no visual match can trigger fallback.

## 8. Correct Verification Flow (Important)

Use a fresh test user and run two dwells:

1. First dwell warms the profile (Gemini writes inferred signals).
2. Second dwell should produce stronger Cat2 live shopping picks.

You can force a clean user profile with:

```bash
curl -X DELETE http://127.0.0.1:8000/profile/dwell-test-user
```

Then run:

```bash
npm run test:dwell
npm run test:dwell
```

## 9. Common Issues and Fixes

`/health` shows `serpapi` but response still hardcoded
- Cause: fallback path triggered (`!query` or API failure).
- Fix: run a second dwell for same user, verify `SERPAPI_KEY`, inspect logs for Gemini/SerpAPI errors.

Profile snapshot remains mostly empty
- Cause: Gemini identify step failed and wrote fallback signals.
- Fix: confirm `GEMINI_API_KEY`, model availability, and that the screenshot is valid product imagery.

Image download errors in `test:dwell` (404/503)
- Cause: returned image URLs can be stale or blocked by source site.
- Fix: treat sample image download as best effort; verify source fields instead of image URL reliability.

Port 8000 already in use
- Cause: previous dev server process still running.
- Fix: stop old process, then restart `npm run dev`.

## 10. Optional Improvements (Recommended)

If you want this to feel more deterministic in `serpapi` mode, implement:

- Add fallback reason fields in `/dwell` response (for debugging).
- Re-rank or re-fetch Cat2 after Gemini updates signals in-request.
- Add structured logs around Cat1/Cat2 fallback causes.
- Replace stale hardcoded image URLs with stable CDN assets.

---

If you want, I can implement the debugging/fallback-reason patch next so every fallback is explicit in the API response and logs.
