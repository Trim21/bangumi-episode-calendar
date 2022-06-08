export function isNotNull<T> (s: T | null): s is T {
  return s !== null
}
