import {
  PROCESS_FLOW_LABELS, PROCESS_FLOW_COLORS,
  COMMERCIAL_STAGE_LABELS, COMMERCIAL_STAGE_COLORS,
  OPERATIONAL_STAGE_LABELS, OPERATIONAL_STAGE_COLORS,
  DOCUMENTATION_STAGE_LABELS, DOCUMENTATION_STAGE_COLORS,
  FINANCIAL_STAGE_LABELS, FINANCIAL_STAGE_COLORS,
} from '@/lib/cashflow/labels'

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

export function ProcessFlowChip({ value }: { value: string }) {
  return <Chip label={PROCESS_FLOW_LABELS[value] ?? value} cls={PROCESS_FLOW_COLORS[value] ?? 'bg-gray-100 text-gray-600 border-transparent'} />
}
export function CommercialStageChip({ value }: { value: string }) {
  return <Chip label={COMMERCIAL_STAGE_LABELS[value] ?? value} cls={`${COMMERCIAL_STAGE_COLORS[value] ?? 'bg-gray-100 text-gray-600'} border-transparent`} />
}
export function OperationalStageChip({ value }: { value: string }) {
  return <Chip label={OPERATIONAL_STAGE_LABELS[value] ?? value} cls={`${OPERATIONAL_STAGE_COLORS[value] ?? 'bg-gray-100 text-gray-600'} border-transparent`} />
}
export function DocumentationStageChip({ value }: { value: string }) {
  return <Chip label={DOCUMENTATION_STAGE_LABELS[value] ?? value} cls={`${DOCUMENTATION_STAGE_COLORS[value] ?? 'bg-gray-100 text-gray-600'} border-transparent`} />
}
export function FinancialStageChip({ value }: { value: string }) {
  return <Chip label={FINANCIAL_STAGE_LABELS[value] ?? value} cls={`${FINANCIAL_STAGE_COLORS[value] ?? 'bg-gray-100 text-gray-600'} border-transparent`} />
}
