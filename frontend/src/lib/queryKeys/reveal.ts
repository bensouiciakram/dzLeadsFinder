export const revealKeys = {
  all: ['reveal'] as const,
  contact: (userKey: string, recordType: 'people' | 'company', recordId: string) =>
    ['reveal', 'contact', userKey, recordType, recordId] as const,
  inFlight: ['reveal', 'in-flight'] as const,
}
