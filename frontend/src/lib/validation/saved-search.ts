import { z } from 'zod'

export const savedSearchNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'common.errors.required')
    .max(100, 'search.saved.name_too_long'),
})

export type SavedSearchNameForm = z.infer<typeof savedSearchNameSchema>
