import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TeamCarousel } from '@/components/marketing/TeamCarousel'

const SLIDES = [
  { name: 'Akram', role: 'Co-founder', alt: 'Portrait of Akram', imageSrc: '/images/team/akram.png' },
  { name: 'Sofiane', role: 'Co-founder', alt: 'Portrait of Sofiane', initials: 'SM' },
]

function renderCarousel() {
  return render(
    <TeamCarousel label="Team photos" prevLabel="Previous" nextLabel="Next" slides={SLIDES} />,
  )
}

describe('TeamCarousel', () => {
  it('shows the first slide with its image and badges initially', () => {
    renderCarousel()

    expect(screen.getByRole('img', { name: 'Portrait of Akram' })).toBeInTheDocument()
    expect(screen.getByText('Akram')).toBeInTheDocument()
    expect(screen.getByText('Co-founder')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Portrait of Sofiane' })).not.toBeInTheDocument()
  })

  it('advances to the next slide and wraps around', () => {
    renderCarousel()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('img', { name: 'Portrait of Sofiane' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Portrait of Akram' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('img', { name: 'Portrait of Akram' })).toBeInTheDocument()
  })

  it('moves back to the previous slide', () => {
    renderCarousel()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(screen.getByRole('img', { name: 'Portrait of Akram' })).toBeInTheDocument()
  })

  it('renders a placeholder tile instead of an image when imageSrc is absent', () => {
    renderCarousel()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('img', { name: 'Portrait of Sofiane' })).toBeInTheDocument()
    expect(screen.getByText('SM')).toBeInTheDocument()
  })

  it('jumps directly to a slide via its dot indicator', () => {
    renderCarousel()

    fireEvent.click(screen.getByRole('button', { name: 'Sofiane' }))
    expect(screen.getByRole('img', { name: 'Portrait of Sofiane' })).toBeInTheDocument()
  })

  it('marks the active dot with aria-current', () => {
    renderCarousel()

    expect(screen.getByRole('button', { name: 'Akram' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Sofiane' })).not.toHaveAttribute('aria-current')

    fireEvent.click(screen.getByRole('button', { name: 'Sofiane' }))
    expect(screen.getByRole('button', { name: 'Sofiane' })).toHaveAttribute('aria-current', 'true')
  })
})
