export const savedSearchesKeys = {
  all: ['saved-searches'] as const,
  idle: ['saved-searches', 'idle'] as const,
  list: (userKey: string) => ['saved-searches', 'list', userKey] as const,
  detail: (id: string) => ['saved-searches', id] as const,
}
