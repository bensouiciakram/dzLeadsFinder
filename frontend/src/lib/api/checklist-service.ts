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

export function completedSteps(state: ChecklistState | null): ChecklistStep[] {
  if (state === null) return []
  return STEP_FIELDS.filter(([, field]) => state[field]).map(([step]) => step)
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
