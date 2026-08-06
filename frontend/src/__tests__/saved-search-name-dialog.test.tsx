import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SavedSearchNameDialog } from '@/components/search/SavedSearchNameDialog'

function renderDialog(overrides: Partial<Parameters<typeof SavedSearchNameDialog>[0]> = {}) {
  const onClose = vi.fn()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const utils = render(
    <SavedSearchNameDialog
      open
      mode="create"
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onClose, onSubmit, ...utils }
}

describe('SavedSearchNameDialog', () => {
  it('renders the name field with the placeholder', () => {
    renderDialog()
    expect(screen.getByText('search.saved.save')).toBeInTheDocument()
    expect(screen.getByLabelText('search.saved.name_label')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('search.saved.name_placeholder')).toBeInTheDocument()
  })

  it('uses the rename title in rename mode', () => {
    renderDialog({ mode: 'rename' })
    expect(screen.getByText('search.saved.rename_title')).toBeInTheDocument()
  })

  it('submits the trimmed name on confirm', async () => {
    const { onSubmit } = renderDialog()
    fireEvent.change(screen.getByLabelText('search.saved.name_label'), {
      target: { value: '  Importers Oran  ' },
    })
    fireEvent.click(screen.getByText('common.actions.save'))
    expect(await screen.findByText('search.saved.save')).toBeInTheDocument()
    expect(onSubmit).toHaveBeenCalledWith('Importers Oran')
  })

  it('rejects an empty name inline', async () => {
    const { onSubmit } = renderDialog()
    fireEvent.change(screen.getByLabelText('search.saved.name_label'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByText('common.actions.save'))
    expect(await screen.findByText('common.errors.required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a name longer than 100 characters', async () => {
    const { onSubmit } = renderDialog()
    fireEvent.change(screen.getByLabelText('search.saved.name_label'), {
      target: { value: 'n'.repeat(101) },
    })
    fireEvent.click(screen.getByText('common.actions.save'))
    expect(await screen.findByText('search.saved.name_too_long')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('surfaces the server cap error as the root message', async () => {
    const serverError = new Error('limit') as Error & {
      response: { status: 400; data: { code: string } }
    }
    serverError.response = { status: 400, data: { code: 'saved_search_limit_exceeded' } }
    const onSubmit = vi.fn().mockRejectedValue(serverError)
    renderDialog({ onSubmit })
    fireEvent.change(screen.getByLabelText('search.saved.name_label'), {
      target: { value: 'x' },
    })
    fireEvent.click(screen.getByText('common.actions.save'))
    expect(await screen.findByText('search.saved.max_capacity')).toBeInTheDocument()
  })

  it('closes without submitting on cancel', () => {
    const { onSubmit, onClose } = renderDialog()
    fireEvent.click(screen.getByText('common.actions.cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('wires aria-invalid and aria-describedby on validation errors', async () => {
    renderDialog()
    fireEvent.click(screen.getByText('common.actions.save'))
    const input = screen.getByLabelText('search.saved.name_label')
    expect(await screen.findByText('common.errors.required')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'saved-search-name-error')
  })

  it('prefills the current name in rename mode', () => {
    renderDialog({ mode: 'rename', initialName: 'Current name' })
    expect(screen.getByLabelText('search.saved.name_label')).toHaveValue('Current name')
  })
})
