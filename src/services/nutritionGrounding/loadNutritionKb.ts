import { readFileSync } from "fs";
import { join } from "path";

import { z } from "zod";

import type { NutritionKbEntry } from "./types";

const NutritionKbEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    canonical_name: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)),
    serving_unit: z.string().trim().min(1),
    calories_per_serving: z.number().nonnegative(),
    protein_g_per_serving: z.number().nonnegative(),
    carbs_g_per_serving: z.number().nonnegative(),
    fat_g_per_serving: z.number().nonnegative(),
    tags: z.array(z.string().trim().min(1)),
  })
  .strict();

const NutritionKbSchema = z.array(NutritionKbEntrySchema).min(1);

let cachedNutritionKb: NutritionKbEntry[] | null = null;

export function loadNutritionKb(): NutritionKbEntry[] {
  if (cachedNutritionKb !== null) {
    return cachedNutritionKb;
  }

  const filePath = join(process.cwd(), "src", "data", "nutritionKb.json");
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  cachedNutritionKb = NutritionKbSchema.parse(parsed);
  return cachedNutritionKb;
}

export function resetNutritionKbCache(): void {
  cachedNutritionKb = null;
}
