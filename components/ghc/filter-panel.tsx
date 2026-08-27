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
      <div className="max-h-[85vh] w-full overscroll-contain overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:mx-auto sm:max-w-lg sm:p-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Discovery Filters</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100"
            aria-label="Close filters"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showPresets && (
          <div className="mb-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">
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
                  className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-2 text-left text-xs font-semibold text-gray-800 transition hover:from-purple-100 hover:to-pink-100"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-gray-900">Looking for</label>
          <div className="flex flex-wrap gap-2">
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode.toLowerCase())}
                className={`rounded-full px-3 py-2 text-xs font-medium transition active:scale-95 ${
                  selectedMode.toLowerCase() === mode.toLowerCase()
                    ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
            <label className="text-sm font-bold text-gray-900">Age Range</label>
            <span className="text-sm font-bold text-purple-600">
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
              className="w-full accent-purple-600"
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
              className="w-full accent-purple-600"
            />
          </div>
        </div>

        {/* Location */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-gray-900">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="City or country"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
          />
        </div>

        {/* Distance */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-bold text-gray-900">Distance Radius</label>
            <span className="text-sm font-bold text-purple-600">{distance} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={distance}
            onChange={(e) => onDistanceChange(parseInt(e.target.value, 10))}
            className="w-full accent-purple-600"
          />
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>1 km</span>
            <span>100 km</span>
          </div>
        </div>

        {/* Activity */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-bold text-gray-900">Activity</label>
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
                    ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
            <label className="block text-sm font-bold text-gray-900">Interests</label>
            {selectedInterests.length > 0 && (
              <button
                type="button"
                onClick={() => onInterestsChange([])}
                className="text-xs font-medium text-purple-600 hover:text-purple-700"
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
                    ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
            className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-200 active:scale-95"
          >
            Reset All
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-purple-700 hover:to-pink-600 active:scale-95"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}
