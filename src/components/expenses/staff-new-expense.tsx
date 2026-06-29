'use client'

import { useState } from 'react'
import { ExpenseForm } from './expense-form'

interface Props {
  technicians: { id: string; name: string }[]
}

export function StaffNewExpense({ technicians }: Props) {
  const [selectedTechId, setSelectedTechId] = useState(technicians[0]?.id ?? '')

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="staff-tech-select">
          Técnico
        </label>
        <select
          id="staff-tech-select"
          value={selectedTechId}
          onChange={(e) => setSelectedTechId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
        >
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      {selectedTechId && (
        <ExpenseForm technicianId={selectedTechId} />
      )}
    </div>
  )
}
