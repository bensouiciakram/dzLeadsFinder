import { Check, MapPin, Building2, Phone, Mail } from 'lucide-react'

type LeadPreviewCardProps = {
  resultsCount: string
  verifiedLabel: string
  creditHint: string
  revealLabel: string
  filter1: string
  filter2: string
  filter3: string
  companyName: string
  industry: string
  location: string
  phone: string
  email: string
}

export function LeadPreviewCard({
  resultsCount,
  verifiedLabel,
  creditHint,
  revealLabel,
  filter1,
  filter2,
  filter3,
  companyName,
  industry,
  location,
  phone,
  email,
}: LeadPreviewCardProps) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span className="font-medium text-foreground">{filter1}</span>
          <span className="text-border">·</span>
          <span>{filter2}</span>
          <span className="text-border">·</span>
          <span>{filter3}</span>
        </div>
        <span className="rounded-full bg-info-container px-2 py-0.5 text-caption font-medium text-info-on-container">
          {resultsCount}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-title font-semibold">{companyName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-container px-2 py-0.5 text-caption font-medium text-success-on-container">
                <Check className="size-3" />
                {verifiedLabel}
              </span>
            </div>
            <p className="mt-1 text-small text-muted-foreground">{industry}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-small text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" />
                {phone}
              </span>
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" />
                {email}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-caption text-muted-foreground">{creditHint}</span>
          <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-caption font-medium text-primary-foreground">
            {revealLabel}
          </span>
        </div>
      </div>

      <div className="border-t border-dashed border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3 opacity-60">
          <div className="size-8 rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-2 w-3/4 rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
