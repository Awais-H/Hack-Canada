import { z } from "zod";

// ----- Dwell / Skip events -----

export const DwellEventSchema = z.object({
  user_id: z.string(),
  screenshot_b64: z.string(),
  screenshot_url: z.string().url().optional(),
  screenshot_public_id: z.string().optional(),
  page_url: z.string().url(),
  page_title: z.string().optional(),
  dwell_duration_ms: z.number().int().min(0),
});

export const SkipEventSchema = z.object({
  user_id: z.string(),
  product_name: z.string(),
  style_signals: z.array(z.string()).default([]),
  brand: z.string().optional(),
  viewport_time_ms: z.number().int().min(0),
  page_url: z.string().url(),
});

// ----- Persistent profile (written to / read from Backboard) -----

// confidence-scored label maps: label -> score in [0, 1]
const ConfidenceMapSchema = z.record(z.string(), z.number().min(0).max(1));

export const PersistentProfileSchema = z.object({
  preferred_styles: ConfidenceMapSchema.default({}),
  preferred_colors: ConfidenceMapSchema.default({}),
  preferred_brands: ConfidenceMapSchema.default({}),
  price_min: z.number().default(0),
  price_max: z.number().default(300),
  price_confidence: z.number().default(0),
  rejected_styles: ConfidenceMapSchema.default({}),
  rejected_brands: ConfidenceMapSchema.default({}),
});

// Per-label observation counts (for Bayesian running average)
export const ObservationCountsSchema = z.object({
  styles: z.record(z.string(), z.number().int()).default({}),
  colors: z.record(z.string(), z.number().int()).default({}),
  brands: z.record(z.string(), z.number().int()).default({}),
  rejected_styles: z.record(z.string(), z.number().int()).default({}),
  rejected_brands: z.record(z.string(), z.number().int()).default({}),
  price_count: z.number().int().default(0),
});

// StoredProfile = what is written to / read from Backboard
export const StoredProfileSchema = z.object({
  persistent: PersistentProfileSchema,
  observations: ObservationCountsSchema,
});

// ----- Product candidates -----

export const ProductCandidateSchema = z.object({
  name: z.string(),
  price: z.string(),
  image_url: z.string(),
  buy_url: z.string(),
  source: z.enum(["serpapi_lens", "serpapi_shopping", "hardcoded"]),
  // Enrichment fields returned to extension (optional)
  confidence: z.number().min(0).max(1).optional(),
  style_signals: z.array(z.string()).optional(),
  brand: z.string().optional(),
});

// ----- Response shapes -----

const ProfileSnapshotSchema = z.object({
  top_styles: z.array(z.object({ label: z.string(), score: z.number() })),
  top_colors: z.array(z.object({ label: z.string(), score: z.number() })),
  rejected_styles: z.array(z.string()),
  price_range: z.string(),
  dwell_count: z.number().int(),
  session_dwell_count: z.number().int(),
  profile_confidence: z.number(),
});

export const DwellResponseSchema = z.object({
  current_product: ProductCandidateSchema,
  taste_picks: z.array(ProductCandidateSchema),
  profile_snapshot: ProfileSnapshotSchema,
});

export const ProfileResponseSchema = z.object({
  user_id: z.string(),
  profile: StoredProfileSchema,
  dwell_event_count: z.number().int(),
  session_dwell_count: z.number().int(),
});

// ----- Legacy TasteProfile (kept for partial backward compatibility) -----
export const TasteProfileSchema = z.object({
  preferred_styles: z.array(z.string()).default([]),
  preferred_colors: z.array(z.string()).default([]),
  price_range: z.string().default("unknown"),
  preferred_brands: z.array(z.string()).default([]),
  recent_interests: z.array(z.string()).default([]),
});

// ----- Type exports -----
export type DwellEvent = z.infer<typeof DwellEventSchema>;
export type SkipEvent = z.infer<typeof SkipEventSchema>;
export type PersistentProfile = z.infer<typeof PersistentProfileSchema>;
export type ObservationCounts = z.infer<typeof ObservationCountsSchema>;
export type StoredProfile = z.infer<typeof StoredProfileSchema>;
export type TasteProfile = z.infer<typeof TasteProfileSchema>;
export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;
export type DwellResponse = z.infer<typeof DwellResponseSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
