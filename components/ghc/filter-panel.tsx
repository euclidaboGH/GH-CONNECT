"use client"

import { useState } from "react"
import { X } from "lucide-react"

const FILTER_PRESETS = [
  { name: "Nearby Friends", distance: 25, mode: "friendship" },
  { name: "Tech Lovers", interests: ["Tech", "Gaming"], mode: "dating" },
  { name: "Adventure Seekers", interests: ["Travel", "Sports"], mode: "friendship" },
  { name: "Creative Minds", interests: ["Arts", "Photography", "Music"], mode: "networking" },
]

export type FilterPanelProps = {
  isOpen: boolean
  onClose: () => void
  ageRange: [number, number]
  onAgeRangeChange: (range: [number, number]) => void
  selectedMode: string
  onModeChange: (mode: string) => void
  selectedInterests: string[]
  onInterestsChange: (interests: string[]) => void
  distance: number
  onDistanceChange: (distance: number) => void
  location: string
  onLocationChange: (location: string) => void
  activityLevel: "active" | "recent" | "all"
  onActivityLevelChange: (level: "active" | "recent" | "all") => void
}

export function FilterPanel({
  isOpen,
  onClose,
  ageRange,
  onAgeRangeChange,
  selectedMode,
  onModeChange,
  selectedInterests,
  onInterestsChange,
  distance,
  onDistanceChange,
  location,
  onLocationChange,
  activityLevel,
  onActivityLevelChange,
}: FilterPanelProps) {
  const [showPresets, setShowPresets] = useState(true)

  if (!isOpen) return null

  const modes = ["Dating", "Friendship", "Networking"]
  const interests = [
    "Gaming",
    "Photography",
    "Arts",
    "Tech",
    "Travel",
    "Sports",
    "Music",
    "Food",
    "Fitness",
    "Cooking",
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full overscroll-contain overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:mx-auto sm:max-w-lg sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Discovery Filters</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-muted"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showPresets && (
          <div className="mb-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Presets
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    onModeChange(preset.mode)
                    if (preset.distance) onDistanceChange(preset.distance)
                    if (preset.interests) onInterestsChange(preset.interests)
                    setShowPresets(false)
                  }}
                  className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-2 text-left text-xs font-semibold text-foreground transition hover:from-emerald-100 hover:to-teal-100"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-foreground">Looking for</label>
          <div className="flex flex-wrap gap-2">
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode.toLowerCase())}
                className={`rounded-full px-3 py-2 text-xs font-medium transition active:scale-95 ${
                  selectedMode.toLowerCase() === mode.toLowerCase()
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                    : "bg-muted text-foreground/90 hover:bg-muted/80"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Age range */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-bold text-foreground">Age Range</label>
            <span className="text-sm font-bold text-emerald-700">
              {ageRange[0]} – {ageRange[1]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={18}
              max={65}
              value={ageRange[0]}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10)
                onAgeRangeChange([Math.min(next, ageRange[1]), ageRange[1]])
              }}
              className="w-full accent-emerald-600"
            />
            <input
              type="range"
              min={18}
              max={65}
              value={ageRange[1]}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10)
                onAgeRangeChange([ageRange[0], Math.max(next, ageRange[0])])
              }}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>

        {/* Location */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-foreground">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="City or country"
            className="w-full rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-300 focus:bg-card focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Distance */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-bold text-foreground">Distance Radius</label>
            <span className="text-sm font-bold text-emerald-700">{distance} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={distance}
            onChange={(e) => onDistanceChange(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-600"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>1 km</span>
            <span>100 km</span>
          </div>
        </div>

        {/* Activity */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-foreground">Activity</label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["active", "Active now"],
                ["recent", "Recently active"],
                ["all", "Anyone"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onActivityLevelChange(value)}
                className={`rounded-full px-3 py-2 text-xs font-medium transition active:scale-95 ${
                  activityLevel === value
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                    : "bg-muted text-foreground/90 hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-bold text-foreground">Interests</label>
            {selectedInterests.length > 0 && (
              <button
                type="button"
                onClick={() => onInterestsChange([])}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-700"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => {
                  if (selectedInterests.includes(interest)) {
                    onInterestsChange(selectedInterests.filter((i) => i !== interest))
                  } else {
                    onInterestsChange([...selectedInterests, interest])
                  }
                }}
                className={`rounded-full px-3 py-2 text-xs font-medium transition active:scale-95 ${
                  selectedInterests.includes(interest)
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                    : "bg-muted text-foreground/90 hover:bg-muted/80"
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              onAgeRangeChange([18, 65])
              onModeChange("dating")
              onInterestsChange([])
              onDistanceChange(50)
              onLocationChange("")
              onActivityLevelChange("all")
            }}
            className="flex-1 rounded-lg bg-muted py-2.5 text-sm font-bold text-foreground/90 transition hover:bg-muted/80 active:scale-95"
          >
            Reset All
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-105 active:scale-95"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}
