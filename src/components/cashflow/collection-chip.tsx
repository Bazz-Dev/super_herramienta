import { COLLECTION_LABELS, COLLECTION_COLORS } from '@/lib/cashflow/labels'

export function CollectionChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLLECTION_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {COLLECTION_LABELS[status] ?? status}
    </span>
  )
}
