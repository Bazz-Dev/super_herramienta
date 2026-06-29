import Link from 'next/link'
import { ClientForm } from '@/components/resources/client-form'
import { requireActor } from '@/lib/tenant'
import { createClient } from '../actions'

export default async function NewClientePage() {
  await requireActor()
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/clientes" className="text-xs text-gray-400 hover:text-gray-600">← Clientes</Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo cliente</h1>
      <ClientForm action={createClient} submitLabel="Crear cliente" />
    </div>
  )
}
