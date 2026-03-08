import { z } from "zod";

export const DwellEventSchema = z.object({
  user_id: z.string(),
  screenshot_b64: z.string(),
  screenshot_url: z.string().url().optional(),
  screenshot_public_id: z.string().optional(),
  page_url: z.string().url(),
  page_title: z.string().optional(),
  dwell_duration_ms: z.number().int().min(0),
});

export const TasteProfileSchema = z.object({
  preferred_styles: z.array(z.string()).default([]),
  preferred_colors: z.array(z.string()).default([]),
  price_range: z.string().default("unknown"),
  preferred_brands: z.array(z.string()).default([]),
  recent_interests: z.array(z.string()).default([]),
});

export const ProductCandidateSchema = z.object({
  name: z.string(),
  price: z.string(),
  image_url: z.string(),
  buy_url: z.string(),
  source: z.enum(["serpapi_lens", "serpapi_shopping", "hardcoded"]),
});

const ProfileSnapshotSchema = TasteProfileSchema.extend({
  dwell_count: z.number().int().default(0),
});

export const DwellResponseSchema = z.object({
  current_product: ProductCandidateSchema,
  taste_picks: z.array(ProductCandidateSchema),
  profile_snapshot: ProfileSnapshotSchema,
});

export const ProfileResponseSchema = z.object({
  user_id: z.string(),
  profile: TasteProfileSchema,
  dwell_event_count: z.number().int(),
});

export type DwellEvent = z.infer<typeof DwellEventSchema>;
export type TasteProfile = z.infer<typeof TasteProfileSchema>;
export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;
export type DwellResponse = z.infer<typeof DwellResponseSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
