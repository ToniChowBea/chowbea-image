/**
 * Make ZIP entry names unique, disambiguating collisions with -2, -3, …
 * Checks each candidate against ALL names already emitted (originals and
 * generated), so a generated name can't collide with a real one.
 * Mirrors the API's _dedupe_names function.
 */
export function dedupeNames(names: string[]): string[] {
  const used = new Set<string>()
  const deduped: string[] = []

  for (const name of names) {
    let candidate = name
    const lastDot = name.lastIndexOf(".")
    const stem = lastDot === -1 ? name : name.slice(0, lastDot)
    const ext = lastDot === -1 ? "" : name.slice(lastDot)

    let count = 1
    while (used.has(candidate)) {
      count += 1
      candidate = `${stem}-${count}${ext}`
    }

    used.add(candidate)
    deduped.push(candidate)
  }

  return deduped
}
