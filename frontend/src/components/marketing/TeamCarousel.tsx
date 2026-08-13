'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type TeamCarouselSlide = {
  name: string
  role: string
  alt: string
  imageSrc?: string
  initials?: string
}

type TeamCarouselProps = {
  label: string
  prevLabel: string
  nextLabel: string
  slides: TeamCarouselSlide[]
}

// Client island on the /about server page (AD-10): a two-slide portrait
// carousel with wrap-around arrows and dots. No autoplay (reduced-motion
// friendly); arrows rotate for RTL like the rest of the app.
export function TeamCarousel({
  label,
  prevLabel,
  nextLabel,
  slides,
}: TeamCarouselProps) {
  const [index, setIndex] = useState(0)

  if (slides.length === 0) return null

  const slide = slides[index % slides.length]
  const prev = () => setIndex((current) => (current - 1 + slides.length) % slides.length)
  const next = () => setIndex((current) => (current + 1) % slides.length)

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="w-full"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg ring-1 ring-border">
        {slide.imageSrc !== undefined ? (
          <Image
            src={slide.imageSrc}
            alt={slide.alt}
            fill
            sizes="(max-width: 1023px) 100vw, 33vw"
            priority={index === 0}
            className="object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={slide.alt}
            className="flex h-full w-full items-center justify-center bg-muted"
          >
            <span className="text-display font-bold text-muted-foreground/40">
              {slide.initials ?? ''}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
          <span className="rounded-full bg-warm px-3 py-1 text-caption font-medium text-warm-foreground shadow-sm">
            {slide.name}
          </span>
          <span className="rounded-full bg-background/90 px-3 py-1 text-caption font-medium text-foreground shadow-sm">
            {slide.role}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={prev}
          aria-label={prevLabel}
          className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
        </button>
        <div role="group" aria-label={label} className="flex items-center gap-2">
          {slides.map((item, dotIndex) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setIndex(dotIndex)}
              aria-label={item.name}
              aria-current={dotIndex === index ? 'true' : undefined}
              className={`size-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                dotIndex === index ? 'bg-warm' : 'bg-border hover:bg-muted-foreground/40'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label={nextLabel}
          className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-8"
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
