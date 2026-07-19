'use client'
import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button
      type="button"
      title="Cerrar sesión"
      onClick={async () => {
        // signOut({ callbackUrl }) deja que el server calcule la URL absoluta de
        // redirect — en next-auth v5 beta esto a veces resuelve a un host distinto
        // del real (confirmado con trace de red: G33, redirige a localhost:3000 en
        // vez de 127.0.0.1:3000 en este entorno Windows/dual-stack). redirect:false
        // + navegación propia (siempre relativa al origin actual) evita depender de
        // ese cálculo. (Se probó además verificar/reintentar contra /api/auth/session
        // tras el signOut — empíricamente empeoraba el race, no mejoraba: revertido.)
        await signOut({ redirect: false })
        window.location.href = '/login'
      }}
      className="interactive w-full cursor-pointer rounded-md border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      Salir
    </button>
  )
}
