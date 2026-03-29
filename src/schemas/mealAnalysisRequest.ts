import { z } from "zod";

export const MealAnalysisRequestSchema = z
  .object({
    image_url: z.string().url(),
    user_note: z.string().trim().min(1).max(1_000).optional(),
    request_id: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type MealAnalysisRequestInput = z.infer<
  typeof MealAnalysisRequestSchema
>;
