import { settings } from "../config/settings.js";
import { TasteProfileSchema } from "../models/schemas.js";
import type { TasteProfile } from "../models/schemas.js";

const profileCache = new Map<string, TasteProfile>();
const dwellCounts = new Map<string, number>();

export interface GeminiSignals {
  product_name: string;
  product_category: string;
  style_signals: string[];
  color_signals: string[];
  estimated_price_range: string;
  brand_guess: string;
}

const mergeList = (existing: string[], incoming: string[], limit: number = 10): string[] => {
  const combined = [...incoming, ...existing];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of combined) {
    if (!item) {
      continue;
    }
    if (item.toLowerCase() === "unknown") {
      continue;
    }
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
    if (result.length >= limit) {
      break;
    }
  }

  return result;
};

const authHeaders = (): HeadersInit => ({
  Authorization: `Bearer ${settings.BACKBOARD_API_KEY}`,
  "Content-Type": "application/json",
});

export const getProfile = async (userId: string): Promise<TasteProfile> => {
  const cached = profileCache.get(userId);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `${settings.BACKBOARD_BASE_URL}/memory/itrack:profile:${userId}`,
      {
        method: "GET",
        headers: authHeaders(),
        signal: controller.signal,
      },
    );

    if (response.status === 200) {
      const data: unknown = await response.json();
      const value =
        typeof data === "object" && data !== null && "value" in data
          ? (data as { value: unknown }).value
          : data;
      const parsed = TasteProfileSchema.parse(value);
      profileCache.set(userId, parsed);
      return parsed;
    }
  } catch {
    // Fall back to empty profile below.
  } finally {
    clearTimeout(timeout);
  }

  const empty = TasteProfileSchema.parse({
    preferred_styles: ["minimalist", "streetwear"],
    preferred_colors: ["black", "white"],
    recent_interests: ["sneakers", "outerwear"],
    preferred_brands: [],
    price_range: "$50-$200",
  });
  profileCache.set(userId, empty);
  return empty;
};

export const updateProfile = async (
  userId: string,
  signals: GeminiSignals,
): Promise<TasteProfile> => {
  const current = await getProfile(userId);

  const merged: TasteProfile = {
    ...current,
    preferred_styles: mergeList(current.preferred_styles, signals.style_signals, 10),
    preferred_colors: mergeList(current.preferred_colors, signals.color_signals, 10),
    preferred_brands: current.preferred_brands,
    recent_interests: current.recent_interests,
  };

  const brand = signals.brand_guess;
  if (brand && brand.toLowerCase() !== "unknown" && !merged.preferred_brands.includes(brand)) {
    merged.preferred_brands = [brand, ...merged.preferred_brands].slice(0, 10);
  }

  const priceRange = signals.estimated_price_range;
  if (priceRange && priceRange.toLowerCase() !== "unknown") {
    merged.price_range = priceRange;
  }

  const category = signals.product_category;
  if (category) {
    merged.recent_interests = mergeList(merged.recent_interests, [category], 5);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(`${settings.BACKBOARD_BASE_URL}/memory/itrack:profile:${userId}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(merged),
      signal: controller.signal,
    });
  } catch (error) {
    const isNetworkError =
      error instanceof TypeError &&
      typeof (error as { cause?: { code?: unknown } }).cause?.code === "string" &&
      ["ENOTFOUND", "ECONNREFUSED", "ECONNRESET"].includes(
        (error as { cause: { code: string } }).cause.code,
      );
    if (isNetworkError) {
      const code = (error as { cause: { code: string } }).cause.code;
      console.warn(
        `[Backboard] Cannot reach ${settings.BACKBOARD_BASE_URL} (${code}) — profile saved in-memory only. Check BACKBOARD_BASE_URL in your .env.`,
      );
    } else {
      console.warn("[Backboard] updateProfile write failed", error);
    }
  } finally {
    clearTimeout(timeout);
  }

  profileCache.set(userId, merged);
  dwellCounts.set(userId, (dwellCounts.get(userId) ?? 0) + 1);

  return merged;
};

export const getDwellCount = (userId: string): number => {
  return dwellCounts.get(userId) ?? 0;
};

export const clearProfile = (userId: string): void => {
  profileCache.delete(userId);
  dwellCounts.delete(userId);
};
