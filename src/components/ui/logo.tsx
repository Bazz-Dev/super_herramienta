export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight text-ink ${className}`}>
      INGEGAR <span className="text-brand font-black">ONE</span>
    </span>
  )
}
