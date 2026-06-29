/** Merge class names, filtering falsy values. Avoids clsx/cn dependency. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
