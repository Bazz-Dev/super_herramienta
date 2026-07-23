import { redirect } from 'next/navigation'

// Técnicos/Clientes/Vehículos pasaron a ser ítems propios del sidebar (ya no
// necesitan esta landing intermedia); Activos ("Herramientas") es lo único
// que queda bajo /recursos, así que un bookmark viejo a esta URL aterriza ahí.
export default function RecursosPage() {
  redirect('/recursos/activos')
}
