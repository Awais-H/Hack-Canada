# iTrack Backend

Fastify + TypeScript API for the iTrack dwell pipeline.

It receives screenshot payloads from the extension, runs product sourcing and profile updates, and returns:
- `current_product` (Cat1 visual match)
- `taste_picks` (Cat2 profile-based recommendations)
- `profile_snapshot`

## Stack

- Node.js + TypeScript (`tsx` for dev)
- Fastify (`fastify@4`)
- Gemini (`@google/generative-ai`)
- SerpApi (`google_lens` + `google_shopping`)
- Cloudinary (optional for image transforms and screenshot URL handling)
- Backboard memory API (with in-memory fallback)

## Repository Layout

```text
itrack-backend/
src/
  config/settings.ts
  models/schemas.ts
  routes/
    health.ts
    dwell.ts
    profile.ts
    runtime.ts
  services/
    sourcingService.ts
    geminiService.ts
    cloudinaryService.ts
    backboardService.ts
scripts/
  test-dwell-workflow.mjs
  test-local.ps1
```

## Prerequisites

- Node.js 18+ (Node 20+ recommended)
- npm

No Python virtual environment is required.

## Environment Variables

Create `.env` from `.env.example`.

Important: `src/config/settings.ts` currently requires non-empty values for:
- `GEMINI_API_KEY`
- `BACKBOARD_API_KEY`
- `SERPAPI_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

So even in local fallback mode, use placeholder values if needed.

Recommended baseline:

```env
GEMINI_API_KEY=your_gemini_key_or_placeholder
BACKBOARD_API_KEY=your_backboard_key_or_placeholder
BACKBOARD_BASE_URL=https://api.backboard.io

SERPAPI_KEY=your_serpapi_key_or_placeholder
PRODUCT_SOURCING_MODE=hardcoded

CLOUDINARY_ENABLED=false
CLOUDINARY_CLOUD_NAME=your_cloud_name_or_placeholder
CLOUDINARY_API_KEY=your_cloudinary_key_or_placeholder
CLOUDINARY_API_SECRET=your_cloudinary_secret_or_placeholder
CLOUDINARY_UPLOAD_PRESET=

HOST=127.0.0.1
PORT=8000
DEBUG=true
```

## Setup (Windows - PowerShell)

```powershell
cd D:\Repositories\Hackathons\itrack-backend
npm install
Copy-Item .env.example .env
# edit .env
npm run dev
```

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## Setup (macOS - zsh/bash)

```bash
cd ~/Repositories/Hackathons/itrack-backend
npm install
cp .env.example .env
# edit .env
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

## Run Modes

### 1) Local fallback mode (no live sourcing)

Use:
- `PRODUCT_SOURCING_MODE=hardcoded`
- `CLOUDINARY_ENABLED=false`

Behavior:
- Cat1 + Cat2 return hardcoded catalog picks.
- Gemini failures are logged but do not break `/dwell`.
- Cloudinary transform is bypassed (`raw URL` pass-through).

### 2) Live mode (SerpApi + Gemini)

Use:
- `PRODUCT_SOURCING_MODE=serpapi`
- valid `SERPAPI_KEY`
- valid `GEMINI_API_KEY`

Optional:
- `CLOUDINARY_ENABLED=true` to enable backend Cloudinary transformations.

## Extension Integration (Current Flow)

The frontend extension is in a separate repo (`Hack-Canada/itrack-extension`).

High-level flow:
1. Extension selects image (manual upload or auto-capture).
2. Extension resolves Cloudinary client config from:
   - local window config, or
   - `GET /runtime/client-config`
3. If direct Cloudinary upload is available:
   - browser uploads file to Cloudinary unsigned preset
   - extension fetches `secure_url`, converts to base64
4. If not available:
   - extension converts file to base64 directly
5. Extension sends `POST /dwell` with:
   - `screenshot_b64` always
   - optional `screenshot_url`, `screenshot_public_id`
6. Backend runs Cat1, Cat2, Gemini concurrently.
7. Backend returns final response with products and profile snapshot.

## Pipeline Details (`POST /dwell`)

On each request:
1. Validate payload via `DwellEventSchema`.
2. Fetch user profile for Cat2 query composition.
3. Run in parallel:
   - Cat1 (`sourceCat1`):
     - SerpApi Lens in live mode
     - hardcoded fallback on failure
   - Cat2 (`sourceCat2`):
     - SerpApi Shopping in live mode
     - hardcoded fallback on failure or empty query
   - Gemini (`identifyAndUpdate`):
     - extracts product/style/color signals
     - updates profile (non-blocking for main response)
4. Transform output product images through Cloudinary service (if enabled).
5. Re-fetch profile and return response.

## API Endpoints

- `GET /health`
- `POST /dwell`
- `GET /profile/:userId`
- `DELETE /profile/:userId`
- `GET /runtime/client-config`

Example `/dwell` payload:

```json
{
  "user_id": "frontend-test-user",
  "screenshot_b64": "<base64-image>",
  "screenshot_url": "https://res.cloudinary.com/.../image/upload/...",
  "screenshot_public_id": "itrack/lens-inputs/abc123",
  "page_url": "https://www.instagram.com/",
  "page_title": "Instagram",
  "dwell_duration_ms": 2400
}
```

## Local Testing

### Windows scripted smoke test

```powershell
npm run test:local
```

Or with explicit parameters:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-local.ps1 `
  -BaseUrl "http://127.0.0.1:8000" `
  -ImagePath "D:\Repositories\Hackathons\Hack-Canada\test\test_sweater.jpg" `
  -UserId "dwell-test-user" `
  -DwellMs 2400
```

### macOS/Linux smoke test

`test:local` is PowerShell-based. Use `test:dwell`:

```bash
DWELL_BASE_URL=http://127.0.0.1:8000 \
DWELL_TEST_IMAGE=./image.png \
DWELL_TEST_USER=dwell-test-user \
DWELL_TEST_DURATION_MS=2400 \
node scripts/test-dwell-workflow.mjs
```

## Troubleshooting

- `ECONNREFUSED 127.0.0.1:8000`:
  - backend is not running, wrong host/port, or blocked by firewall.
- `API_KEY_INVALID` for Gemini:
  - `GEMINI_API_KEY` is missing/invalid.
- `Cloudinary runtime config ... cloudinary_direct_upload_enabled: false`:
  - direct browser upload is disabled or missing `CLOUDINARY_UPLOAD_PRESET`.
- No backend logs when clicking extension upload:
  - verify extension points to this backend base URL and request reaches `POST /dwell`.
- `fastify-plugin ... expected '4.x' fastify version, '5.x' is installed`:
  - caused by forced audit upgrade.
  - reinstall compatible versions:
    - `npm install fastify@4.27.0 @fastify/cors@9.0.1`

## Build and Production Run

```bash
npm run build
npm start
```
