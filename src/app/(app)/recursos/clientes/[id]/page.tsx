import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClientForm } from '@/components/resources/client-form'
import { requireActor } from '@/lib/resources/actor'
import { getClient } from '@/lib/resources/clients'
import { updateClient } from '../actions'

export default async function EditClientePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const client = await getClient(actor, id)
  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/clientes" className="text-xs text-gray-400 hover:text-gray-600">← Clientes</Link>
      <h1 className="mb-6 text-2xl font-bold">Editar cliente</h1>
      <ClientForm action={updateClient.bind(null, client.id)} initial={client} submitLabel="Guardar cambios" />
    </div>
  )
}
