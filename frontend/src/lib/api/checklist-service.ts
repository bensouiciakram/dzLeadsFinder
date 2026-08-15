import { HttpClient } from './http-client'

export type ChecklistStep = 'search' | 'reveal' | 'export'

export type ChecklistState = {
  step_search: boolean
  step_reveal: boolean
  step_export: boolean
  dismissed: boolean
}

const STEP_FIELDS: readonly [ChecklistStep, keyof ChecklistState][] = [
  ['search', 'step_search'],
  ['reveal', 'step_reveal'],
  ['export', 'step_export'],
]

// M6: content-keyed memo — a fresh filter/map array on every render would
// re-trigger ChecklistCard's announcement effect on every render even when
// nothing completed (its deps diff by reference). The memo returns the SAME
// reference until the completed-set actually changes.
const EMPTY_STEPS: ChecklistStep[] = []

let lastStepsSignature: string | null = null
let lastSteps: ChecklistStep[] = EMPTY_STEPS

export function completedSteps(state: ChecklistState | null): ChecklistStep[] {
  if (state === null) {
    if (lastStepsSignature !== null) {
      lastStepsSignature = null
      lastSteps = EMPTY_STEPS
    }
    return EMPTY_STEPS
  }
  const signature = `${state.step_search}|${state.step_reveal}|${state.step_export}`
  if (signature !== lastStepsSignature) {
    lastStepsSignature = signature
    lastSteps = STEP_FIELDS.filter(([, field]) => state[field]).map(([step]) => step)
  }
  return lastSteps
}

export class ChecklistService extends HttpClient {
  async get(): Promise<ChecklistState> {
    const { data } = await this.client.get<ChecklistState>('/search/checklist/')
    return data
  }

  async dismiss(): Promise<ChecklistState> {
    const { data } = await this.client.put<ChecklistState>('/search/checklist/', {
      dismissed: true,
    })
    return data
  }
}

export const checklistService = new ChecklistService()
