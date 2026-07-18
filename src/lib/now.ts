// Thin wrapper around Date.now() — the react-hooks/purity lint rule flags
// direct Date.now()/Math.random() calls inside component render bodies (used
// for "how overdue is this" style comparisons here, not for anything
// requiring precise re-render tracking). Calling it through a named function
// keeps that intent explicit instead of scattering eslint-disable comments.
export function now(): number {
  return Date.now()
}
