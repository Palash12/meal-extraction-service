import { z } from "zod";

export const MealExtractionRequestSchema = z
  .object({
    image_url: z.string().url(),
    user_note: z.string().trim().min(1).max(1000).optional(),
    request_id: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type MealExtractionRequestInput = z.infer<typeof MealExtractionRequestSchema>;
