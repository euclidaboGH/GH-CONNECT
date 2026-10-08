"use client"

import { useState } from "react"
import { Search, X, Sliders } from "lucide-react"

export function SearchBar({
  onSearch,
  onSearchCommit,
  onFiltersClick,
  recentSearches = [],
  suggestionTerms = [],
}: {
  onSearch: (query: string) => void
  onSearchCommit?: (query: string) => void
  onFiltersClick: () => void
  recentSearches?: string[]
  suggestionTerms?: string[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const suggestions = (suggestionTerms.length
    ? suggestionTerms
    : ["Travel", "Photography", "Tech", "Gaming", "Music"]
  ).filter(
    (suggestion) =>
      !searchQuery ||
      suggestion.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const normalizedRecent = recentSearches.filter(
    (search, index, items) =>
      items.findIndex((item) => item.toLowerCase() === search.toLowerCase()) ===
      index
  )

  const visibleSearches = [
    ...normalizedRecent,
    ...suggestions.filter(
      (item) =>
        !normalizedRecent.some(
          (recent) => recent.toLowerCase() === item.toLowerCase()
        )
    ),
  ].slice(0, 6)

  const submitSearch = (value: string) => {
    const nextValue = value.trim()
    setSearchQuery(nextValue)
    onSearch(nextValue)
    onSearchCommit?.(nextValue)
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <div
          className={`relative min-w-0 flex-1 rounded-[1.25rem] border bg-muted/40 transition-colors ${
            isFocused
              ? "border-primary/40 bg-card ring-2 ring-primary/20"
              : "border-border/70"
          }`}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Try: Lagos · Tech · Mentorship"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              onSearch(event.target.value)
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => window.setTimeout(() => setIsFocused(false), 180)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.nativeEvent.isComposing &&
                event.keyCode !== 229
              ) {
                submitSearch(searchQuery)
              }
            }}
            className="h-11 w-full bg-transparent pl-10 pr-9 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Search people, interests, or cities"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => submitSearch("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground/90"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onFiltersClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--gh-green)] text-white shadow-sm transition hover:brightness-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Open filters"
        >
          <Sliders className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {!searchQuery && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground">Try:</span>
          {["Lagos", "Tech", "Mentorship"].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => submitSearch(term)}
              className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary"
            >
              {term}
            </button>
          ))}
        </div>
      )}
      {isFocused && visibleSearches.length > 0 && (
        <div
          className="rounded-2xl border border-border/50 bg-white p-2 shadow-lg"
          role="listbox"
          aria-label="Search suggestions"
        >
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {normalizedRecent.length
              ? "Recent searches & suggestions"
              : "Suggested searches"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleSearches.map((search) => (
              <button
                key={search}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => submitSearch(search)}
                className="rounded-full bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground/90 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
