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
          className={`relative min-w-0 flex-1 rounded-2xl border bg-gray-50 transition-colors ${
            isFocused
              ? "border-emerald-300 bg-white ring-2 ring-emerald-100"
              : "border-gray-200"
          }`}
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
            className="h-11 w-full bg-transparent pl-10 pr-9 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            aria-label="Search people, interests, or cities"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => submitSearch("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onFiltersClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-sm transition hover:shadow-md active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
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
          className="rounded-2xl border border-gray-100 bg-white p-2 shadow-lg"
          role="listbox"
          aria-label="Search suggestions"
        >
          <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
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
                className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-purple-50 hover:text-purple-700"
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
