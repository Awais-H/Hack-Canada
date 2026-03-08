# iTrack Backend — Python → TypeScript Migration Plan

> Feed this file directly to Claude Code. Each phase is a self-contained prompt block.
> Run phases in order. Each phase ends with a working, runnable server.

---

## Context

Migrating a FastAPI/Python passive gaze commerce backend to Fastify/TypeScript.
The migration also upgrades the architecture from v1 (single pipeline) to v3 (two parallel pipelines).

**Source files to reference:**
- `main.py` → `src/main.ts`
- `config/settings.py` → `src/config/settings.ts`
- `models/schemas.py` → `src/models/schemas.ts`
- `routes/dwell.py` → `src/routes/dwell.ts`
- `routes/profile.py` → `src/routes/profile.ts`
- `routes/health.py` → `src/routes/health.ts`
- `services/gemini_service.py` → `src/services/geminiService.ts`
- `services/backboard_service.py` → `src/services/backboardService.ts`
- `services/sourcing_service.py` → `src/services/sourcingService.ts`
- `services/cloudinary_service.py` → `src/services/cloudinaryService.ts`

---

## Dependency Map

| Python | TypeScript equivalent | Notes |
|--------|----------------------|-------|
| FastAPI | `fastify@^4` | Similar decorator-less route DX |
| Pydantic models | `zod@^3` | Runtime validation + inferred TS types |
| pydantic-settings | `zod` + `dotenv` | Validate `.env` at startup |
| httpx | native `fetch` (Node 18+) | No extra dep needed |
| google-generativeai | `@google/generative-ai` | Official SDK, near-identical API |
| cloudinary | `cloudinary@^2` | Same SDK, Node version |
| uvicorn | `tsx --watch` (dev) | Fast TS execution, no compile step in dev |
| asyncio.gather | `Promise.all()` | Native JS |

---

## Phase 0 — Scaffold

**Prompt for Claude Code:**

```
Create a new TypeScript/Node.js project at the current directory with this exact structure:

src/
  main.ts
  config/
    settings.ts
  models/
    schemas.ts
  routes/
    dwell.ts
    profile.ts
    health.ts
  services/
    geminiService.ts
    backboardService.ts
    sourcingService.ts
    cloudinaryService.ts

Create package.json with these exact dependencies:
{
  "name": "itrack-backend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "fastify": "^4.27.0",
    "@fastify/cors": "^9.0.1",
    "zod": "^3.23.8",
    "@google/generative-ai": "^0.14.0",
    "cloudinary": "^2.2.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "tsx": "^4.11.0",
    "@types/node": "^20.12.0"
  }
}

Create tsconfig.json:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}

Create .env.example:
GEMINI_API_KEY=your_gemini_api_key_here
BACKBOARD_API_KEY=your_backboard_api_key_here
BACKBOARD_BASE_URL=https://api.backboard.io
PRODUCT_SOURCING_MODE=hardcoded
SERPAPI_KEY=your_serpapi_key_here
CLOUDINARY_ENABLED=false
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
DEBUG=true

Then run: npm install

Leave all .ts files empty for now. Confirm the install completes without errors.
```

---

## Phase 1 — Config + Schemas

**Prompt for Claude Code:**

```
Implement src/config/settings.ts and src/models/schemas.ts.

--- src/config/settings.ts ---
Use zod and dotenv to validate environment variables at startup.
Import "dotenv/config" at the top.
Define a SettingsSchema with these fields:
  - GEMINI_API_KEY: string, min length 1
  - BACKBOARD_API_KEY: string, min length 1
  - BACKBOARD_BASE_URL: string URL, default "https://api.backboard.io"
  - SERPAPI_KEY: string, min length 1
  - CLOUDINARY_CLOUD_NAME: string, min length 1
  - CLOUDINARY_API_KEY: string, min length 1
  - CLOUDINARY_API_SECRET: string, min length 1
  - PRODUCT_SOURCING_MODE: enum ["serpapi", "hardcoded"], default "hardcoded"
  - CLOUDINARY_ENABLED: string transformed to boolean (true only if value === "true"), default false
  - HOST: string, default "0.0.0.0"
  - PORT: coerced number, default 8000
  - DEBUG: string transformed to boolean, default true

Export: const settings = SettingsSchema.parse(process.env)
Export: type Settings = z.infer<typeof SettingsSchema>

--- src/models/schemas.ts ---
Define these Zod schemas and export inferred TypeScript types for each:

1. DwellEventSchema — inbound from extension:
   user_id: string
   screenshot_b64: string
   page_url: string (url)
   page_title: string (optional)
   dwell_duration_ms: number (int, min 0)

2. TasteProfileSchema:
   preferred_styles: string array, default []
   preferred_colors: string array, default []
   price_range: string, default "unknown"
   preferred_brands: string array, default []
   recent_interests: string array, default []

3. ProductCandidateSchema:
   name: string
   price: string
   image_url: string
   buy_url: string
   source: enum ["serpapi_lens", "serpapi_shopping", "hardcoded"]

4. DwellResponseSchema — outbound to extension (v3 two-category shape):
   current_product: ProductCandidateSchema
   taste_picks: array of ProductCandidateSchema
   profile_snapshot: TasteProfileSchema extended with dwell_count (number int, default 0)

5. ProfileResponseSchema:
   user_id: string
   profile: TasteProfileSchema
   dwell_event_count: number int

Export inferred types: DwellEvent, TasteProfile, ProductCandidate, DwellResponse, ProfileResponse
```

---

## Phase 2 — Server + Routes Skeleton

**Prompt for Claude Code:**

```
Implement src/main.ts and the three route files. The server must start and return 200 on /health before we wire any services.

--- src/main.ts ---
- Import Fastify and @fastify/cors
- Register cors with origin: "*"
- Register healthRoutes at prefix "/health"
- Register dwellRoutes at prefix "/dwell"
- Register profileRoutes at prefix "/profile"
- Start listening on settings.HOST and settings.PORT
- Log sourcing mode on startup: `iTrack backend running — sourcing: ${settings.PRODUCT_SOURCING_MODE}`
- On listen error, log and process.exit(1)

--- src/routes/health.ts ---
FastifyPluginAsync that registers GET "/" returning:
{ status: "ok", sourcing_mode: settings.PRODUCT_SOURCING_MODE, timestamp: new Date().toISOString() }

--- src/routes/profile.ts ---
FastifyPluginAsync with two routes:
  GET "/:userId" — stub that returns { user_id: params.userId, profile: {}, dwell_event_count: 0 }
  DELETE "/:userId" — stub that returns { deleted: true, user_id: params.userId }

--- src/routes/dwell.ts ---
FastifyPluginAsync with one route:
  POST "/" — parse body with DwellEventSchema.parse(), log the user_id and dwell_duration_ms, return a hardcoded DwellResponse stub:
  {
    current_product: { name: "Stub Product", price: "$99", image_url: "https://placeholder.com/400", buy_url: "https://placeholder.com", source: "hardcoded" },
    taste_picks: [],
    profile_snapshot: { preferred_styles: [], preferred_colors: [], price_range: "unknown", preferred_brands: [], recent_interests: [], dwell_count: 0 }
  }

After implementing, run: npm run dev
Confirm /health returns 200 and POST /dwell returns the stub card.
```

---

## Phase 3 — Backboard Service

**Prompt for Claude Code:**

```
Implement src/services/backboardService.ts. Port the logic from backboard_service.py exactly, with these TypeScript-specific changes:

- Use native fetch instead of httpx (Node 18+ built-in)
- Use Map<string, TasteProfile> for _profileCache instead of a dict
- Use Map<string, number> for _dwellCounts

Export these functions (all async unless noted):

1. getProfile(userId: string): Promise<TasteProfile>
   - Check cache first, return if found
   - Fetch from ${settings.BACKBOARD_BASE_URL}/memory/itrack:profile:${userId}
   - Auth header: Bearer ${settings.BACKBOARD_API_KEY}
   - On 200: parse response JSON, validate with TasteProfileSchema.parse(), cache and return
   - On any error or non-200: return TasteProfileSchema.parse({}) — empty default profile
   - Timeout: use AbortController with 5000ms

2. updateProfile(userId: string, signals: GeminiSignals): Promise<TasteProfile>
   - Fetch current profile via getProfile()
   - Merge signals using the same merge logic as Python (keep 10 unique, filter "unknown"):
     - style_signals → preferred_styles
     - color_signals → preferred_colors
     - brand_guess → prepend to preferred_brands if not "unknown"
     - estimated_price_range → price_range if not "unknown"
     - product_category → prepend to recent_interests (limit 5)
   - POST merged profile back to Backboard (non-fatal if it fails — log and continue)
   - Update cache, increment _dwellCounts[userId]
   - Return updated profile

3. getDwellCount(userId: string): number (sync)
   - Return _dwellCounts.get(userId) ?? 0

4. clearProfile(userId: string): void (sync)
   - Delete from both _profileCache and _dwellCounts

Define and export GeminiSignals interface:
{
  product_name: string
  product_category: string
  style_signals: string[]
  color_signals: string[]
  estimated_price_range: string
  brand_guess: string
}
```

---

## Phase 4 — Gemini Service

**Prompt for Claude Code:**

```
Implement src/services/geminiService.ts. Port from gemini_service.py with these changes:

Import GoogleGenerativeAI from "@google/generative-ai".
Initialize model with "gemini-1.5-flash".

IMPORTANT ARCHITECTURE CHANGE vs the Python version:
- There is only ONE exported function: identifyAndUpdate()
- The select_best_match() function is REMOVED — it is not used in v3
- Gemini never blocks the recommendation pipeline — it fires and updates Backboard asynchronously

Export one function:

identifyAndUpdate(
  screenshotB64: string,
  userId: string,
  pageUrl: string,
  pageTitle?: string
): Promise<void>

Implementation:
1. Build the image part: { inlineData: { mimeType: "image/jpeg", data: screenshotB64 } }
2. Build the prompt (same as Python IDENTIFY_PROMPT):
   "You are analyzing a screenshot from a social media feed (Instagram or TikTok).
   Identify the primary product visible and extract taste signals.
   Respond ONLY with valid JSON — no markdown, no explanation.
   {
     product_name, product_category, style_signals, color_signals,
     estimated_price_range, brand_guess
   }
   Page URL: {pageUrl}
   Page title: {pageTitle}"
3. Call model.generateContent([imagePart, prompt])
4. Strip markdown fences from response.text if present (same logic as Python)
5. JSON.parse the result into GeminiSignals
6. Call backboardService.updateProfile(userId, signals)
7. On any error: console.warn and return — never throw (Gemini failure must not crash the pipeline)
```

---

## Phase 5 — Sourcing Service

**Prompt for Claude Code:**

```
Implement src/services/sourcingService.ts. This is the biggest change from the Python version — v3 adds a second SerpApi mode for Category 2.

Import ProductCandidate type and settings.

--- Hardcoded Catalog ---
Copy the HARDCODED_CATALOG array exactly from the Python sourcing_service.py.
Each item has: name, price, image_url, buy_url, tags (string[]).

--- Helper: composeQueryFromProfile(profile: TasteProfile): string ---
Build a natural language search query from Backboard profile fields.
Join: profile.preferred_styles[0], profile.preferred_colors[0], profile.recent_interests[0], profile.preferred_brands[0], profile.price_range
Filter out undefined/empty/"unknown" values.
Example output: "minimalist black sneakers Nike $50-$150"

--- Helper: scoreCandidate(candidate, signals) ---
Port _score_candidate() from Python exactly.

--- Export these four functions ---

1. sourceCat1(screenshotB64: string): Promise<ProductCandidate>
   PRIMARY: SerpApi Google Lens reverse image search
   - POST to https://serpapi.com/search with params: engine="google_lens", api_key, and the screenshot as a data URL
   - Return the top visual_match as ProductCandidate with source "serpapi_lens"
   FALLBACK (if PRODUCT_SOURCING_MODE is "hardcoded" OR SerpApi throws):
   - Return first item from HARDCODED_CATALOG as ProductCandidate with source "hardcoded"
   Never throw — always return something.

2. sourceCat2(profile: TasteProfile): Promise<ProductCandidate[]>
   PRIMARY: SerpApi Google Shopping keyword search
   - Build query with composeQueryFromProfile(profile)
   - If query is empty (profile not yet built), fall back to hardcoded immediately
   - GET https://serpapi.com/search with params: engine="google_shopping", q=query, api_key
   - Return top 3-5 shopping_results as ProductCandidate[] with source "serpapi_shopping"
   FALLBACK (if PRODUCT_SOURCING_MODE is "hardcoded" OR query empty OR SerpApi throws):
   - Score HARDCODED_CATALOG against profile using scoreCandidate()
   - Return top 3 as ProductCandidate[] with source "hardcoded"
   Never throw — always return array (may be empty only if catalog is empty).

3. sourceViaHardcoded(signals?: Partial<GeminiSignals>): Promise<ProductCandidate[]>
   Internal helper used by fallback paths — score and return top 5 from catalog.

Note: Use native fetch with AbortController (10s timeout) for all SerpApi calls.
```

---

## Phase 6 — Cloudinary Service

**Prompt for Claude Code:**

```
Implement src/services/cloudinaryService.ts. Direct port of cloudinary_service.py.

Import cloudinary v2 from "cloudinary".
Call cloudinary.config() with settings values on module load.

Export one function:

transformProductImage(imageUrl: string): Promise<string>

Implementation:
1. If settings.CLOUDINARY_ENABLED is false: log "[Cloudinary] Disabled — returning raw URL" and return imageUrl unchanged.
2. Try PRIMARY path:
   - cloudinary.uploader.upload(imageUrl, { folder: "itrack/products", overwrite: false })
   - Build animated URL with transformations: zoompan effect (zoom 1.2, duration 3), loop, background_removal, fill crop 600x800 gravity auto, quality auto, fetch_format auto
   - resource_type: "video"
   - Return animated URL
3. On failure, try FALLBACK path:
   - Build URL with background_removal + fill crop only (no animation)
   - Return fallback URL
4. On second failure: log error, return original imageUrl

Note: cloudinary SDK methods are synchronous URL builders but upload is async.
Wrap in try/catch at each level.
```

---

## Phase 7 — Wire the Full Pipeline

**Prompt for Claude Code:**

```
Now replace the stub in src/routes/dwell.ts with the full v3 two-pipeline implementation.

The pipeline must:
1. Parse and validate the request body with DwellEventSchema.parse()
2. Read the current Backboard profile BEFORE firing pipelines (this is Cat 2's input)
3. Run three tasks concurrently with Promise.all():
   a. sourcingService.sourceCat1(event.screenshot_b64)
   b. sourcingService.sourceCat2(currentProfile)
   c. geminiService.identifyAndUpdate(...) — wrapped in .catch() so it never rejects Promise.all
4. Run Cloudinary transforms concurrently across ALL returned products (cat1 + all cat2 picks):
   const allProducts = [cat1Product, ...cat2Picks]
   const urls = await Promise.all(allProducts.map(p => cloudinaryService.transformProductImage(p.image_url)))
   allProducts.forEach((p, i) => p.image_url = urls[i])
5. Re-read the profile after Gemini has had a chance to update it
6. Build and return DwellResponse:
   {
     current_product: cat1Product,
     taste_picks: cat2Picks,
     profile_snapshot: { ...updatedProfile, dwell_count: backboardService.getDwellCount(event.user_id) }
   }

Error handling:
- If sourceCat1 throws: return 502 with message "Cat1 sourcing failed"
- If sourceCat2 throws: use empty array for taste_picks, do not 502
- Gemini failure is already non-fatal (caught in identifyAndUpdate)
- Log each pipeline step with [Pipeline] prefix for debuggability
```

---

## Phase 8 — Profile Routes + Demo Reset

**Prompt for Claude Code:**

```
Replace the stubs in src/routes/profile.ts with real implementations.

GET "/:userId"
- Call backboardService.getProfile(userId)
- Call backboardService.getDwellCount(userId)
- Return ProfileResponse: { user_id, profile, dwell_event_count }

DELETE "/:userId"
- Call backboardService.clearProfile(userId)
- Return { deleted: true, user_id }
- This is the demo reset endpoint — it must work reliably

Also update src/routes/health.ts to include dwell_count for "anon-debug" user if present (useful for live demo to show the system is accumulating state).
```

---

## Phase 9 — Final Checks

**Prompt for Claude Code:**

```
Run through this final checklist:

1. Run: npm run build
   Fix any TypeScript compilation errors. Common issues:
   - Missing return types on async functions
   - fetch not typed (add @types/node if needed)
   - Strict null checks on optional fields from Zod schemas

2. Run: npm run dev
   Then make these test requests:
   - GET /health → should return 200 with status "ok"
   - POST /dwell with body: { "user_id": "test-123", "screenshot_b64": "aGVsbG8=", "page_url": "https://www.instagram.com/", "dwell_duration_ms": 2500 }
     Should return DwellResponse with current_product and taste_picks (hardcoded in dev mode)
   - GET /profile/test-123 → should show profile with dwell_event_count > 0
   - DELETE /profile/test-123 → should return deleted: true
   - GET /profile/test-123 again → dwell_event_count should be 0

3. Confirm these .env flags work correctly:
   - PRODUCT_SOURCING_MODE=hardcoded → sourcing logs show "hardcoded"
   - CLOUDINARY_ENABLED=false → Cloudinary logs show "Disabled — returning raw URL"

4. Update README.md to reflect the TypeScript setup:
   - Change setup commands (npm install, npm run dev instead of pip + uvicorn)
   - Update file structure to show src/ layout
   - Keep the pipeline diagram and feature flags table
   - Note Node 18+ requirement for native fetch
```

---

## Notes for Claude Code

- **Always use `import type`** for type-only imports to keep compilation clean with `"module": "NodeNext"`
- **All service files** should be stateless except for the in-memory cache Maps in `backboardService.ts`
- **Never use `any`** — if Gemini or SerpApi return untyped JSON, parse it through a Zod schema or an explicit type assertion with a comment
- **File extensions in imports** — with `"moduleResolution": "NodeNext"`, all relative imports need `.js` extension even though the source files are `.ts` (e.g. `import { settings } from "../config/settings.js"`)
- **Fetch timeout pattern** to use throughout:
  ```typescript
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  ```
