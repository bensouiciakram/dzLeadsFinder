export const savedSearchesKeys = {
  all: ['saved-searches'] as const,
  list: ['saved-searches', 'list'] as const,
  detail: (id: string) => ['saved-searches', id] as const,
}
