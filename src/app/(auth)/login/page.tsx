import { Logo } from '@/components/ui/logo'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Logo className="text-2xl" />
          <p className="mt-2 text-sm text-gray-500">Herramienta interna de gestión</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
