export type SettingsSearchItem = {
  title: string
  subtitle?: string
  keywords?: string
}

/** Rank settings by meaningful query matches; never changes the underlying setting or permission. */
export function matchSettingsSearch(query: string, item: SettingsSearchItem): number {
  const tokens = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return 1
  const title = item.title.toLocaleLowerCase()
  const subtitle = (item.subtitle ?? "").toLocaleLowerCase()
  const keywords = (item.keywords ?? "").toLocaleLowerCase()
  const haystack = `${title} ${subtitle} ${keywords}`
  if (!tokens.every((token) => haystack.includes(token))) return 0
  return tokens.reduce((score, token) => score + (title.includes(token) ? 5 : subtitle.includes(token) ? 3 : 1), 0)
}
