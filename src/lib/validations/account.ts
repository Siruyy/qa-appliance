import { z } from "zod";

export const updateAccountNotesSchema = z.object({
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or less")
    .optional()
    .or(z.literal("")),
});

export type UpdateAccountNotesValues = z.infer<typeof updateAccountNotesSchema>;
