import { Skeleton } from '@/components/ui/skeleton'

export default function LoadingPage() {
  return (
    <div
      data-testid="page-loading"
      className="mx-auto w-full max-w-5xl space-y-4 p-gutter"
      aria-hidden="true"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
