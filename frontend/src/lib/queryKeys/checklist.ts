export const checklistKeys = {
  all: ['checklist'] as const,
  idle: ['checklist', 'idle'] as const,
  state: (userKey: string) => ['checklist', 'state', userKey] as const,
}
