// The shared API-error classifiers: every service used to hand-roll the
// same "response.status === N && response.data.code === 'x'" duck-typing
// (four copies of isCodeError plus a status-only variant), each with its
// own local error-shape type. One home here; the per-service predicates
// stay exported from their services (call sites keep their imports).
type ApiErrorShape = {
  response?: { status?: number; data?: { code?: string } }
}

export function isApiCodeError(
  error: unknown,
  status: number,
  code: string,
): error is { response: { status: number; data: { code: string } } } {
  if (typeof error !== 'object' || error === null) return false
  const apiError = error as ApiErrorShape
  return (
    apiError.response?.status === status && apiError.response?.data?.code === code
  )
}

export function isApiStatusError<D = unknown>(
  error: unknown,
  status: number,
): error is { response: { status: number; data: D } } {
  if (typeof error !== 'object' || error === null) return false
  return (error as ApiErrorShape).response?.status === status
}
