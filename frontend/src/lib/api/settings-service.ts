import { HttpClient } from './http-client'

type DeletionSchedule = {
  deletion_scheduled_at: string
}

export type FrozenStatus = {
  deletion_scheduled_at: string | null
  days_left: number
}

class SettingsService extends HttpClient {
  async deleteAccount(): Promise<DeletionSchedule> {
    const { data } = await this.client.post<DeletionSchedule>('/settings/delete/')
    return data
  }

  async frozenStatus(): Promise<FrozenStatus> {
    const { data } = await this.client.get<FrozenStatus>('/settings/frozen-status/')
    return data
  }

  async undelete(): Promise<void> {
    await this.client.post('/settings/undelete/')
  }
}

export const settingsService = new SettingsService()
