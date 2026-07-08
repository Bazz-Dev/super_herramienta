'use client'
import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button
      type="button"
      title="Cerrar sesión"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="interactive w-full cursor-pointer rounded-md border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      Salir
    </button>
  )
}
