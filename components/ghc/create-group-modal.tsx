"use client"

import { onCloseTransientUI } from "@/lib/transient-ui"

import { useState, useRef, useEffect } from "react"
import { X, Upload, Users, AlertCircle, Loader } from "lucide-react"
import { sanitizeText, sanitizeDisplayName } from "@/lib/sanitizer"
import { compressImageFile } from "@/lib/media/compress-image"
import { RULE_TEMPLATES } from "@/lib/domains/community-registry"

export interface CreateGroupFormData {
  name: string
  description: string
  category: string
  privacy: "public" | "private" | "invite-only"
  coverImage?: string
  welcomeMessage: string
  rules: string[]
  invitedMembers: string[]
}

interface CreateGroupModalProps {
  /** When false, modal is hidden. Defaults to true for conditional-render parents. */
  isOpen?: boolean
  onClose: () => void
  onSubmit: (data: CreateGroupFormData) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

const CATEGORIES = ["General", "Sports", "Tech", "Music", "Art", "Business", "Education", "Gaming", "Other"]
const PRIVACY_OPTIONS = [
  { value: "public", label: "Public", desc: "Anyone can find & join" },
  { value: "private", label: "Private", desc: "Only invited members" },
  { value: "invite-only", label: "Invite Only", desc: "Admin approval required" },
]

export function CreateGroupModal({ isOpen = true, onClose, onSubmit, isLoading = false, error = null }: CreateGroupModalProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<CreateGroupFormData>({
    name: "",
    description: "",
    category: "General",
    privacy: "public",
    coverImage: undefined,
    welcomeMessage: "",
    rules: [],
    invitedMembers: [],
  })
  const [currentRule, setCurrentRule] = useState("")
  const [currentMember, setCurrentMember] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateStep = (stepNum: number): boolean => {
    const errors: Record<string, string> = {}

    if (stepNum === 1) {
      const nameTrimed = formData.name.trim()
      if (!nameTrimed) {
        errors.name = "Group name is required"
      } else if (nameTrimed.length < 3) {
        errors.name = "Name must be at least 3 characters"
      } else if (nameTrimed.length > 50) {
        errors.name = "Name must be less than 50 characters"
      } else if (!/^[a-zA-Z0-9\s\-&']+$/.test(nameTrimed)) {
        errors.name = "Name contains invalid characters"
      }

      const descTrimed = formData.description.trim()
      if (!descTrimed) {
        errors.description = "Description is required"
      } else if (descTrimed.length < 10) {
        errors.description = "Description must be at least 10 characters"
      } else if (descTrimed.length > 500) {
        errors.description = "Description must be less than 500 characters"
      }
    }

    if (stepNum === 2) {
      if (!formData.privacy) {
        errors.privacy = "Privacy setting is required"
      }
      if (formData.privacy === "public" && !formData.coverImage) {
        errors.coverImage = "Public communities need a cover image"
      }
    }

    if (stepNum === 3) {
      // Welcome message validation - optional field with loose requirements
      if (formData.welcomeMessage) {
        if (formData.welcomeMessage.length < 5) {
          errors.welcomeMessage = "Welcome message must be at least 5 characters"
        } else if (formData.welcomeMessage.length > 500) {
          errors.welcomeMessage = "Welcome message must be less than 500 characters"
        }
      }
    }

    if (stepNum === 4) {
      // Step 4 validation - invited members limit
      if (formData.invitedMembers.length > 10) {
        errors.invitedMembers = "Maximum 10 members can be invited"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1)
    }
  }

  const handlePrevious = () => {
    setStep(step - 1)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      // Prefer JPEG for Pi WebView compatibility (avoids dark/blank WebP decode issues)
      const compressedBase64 = await compressImageFile(file, {
        purpose: "cover",
        preferWebp: false,
        quality: 0.85,
      })
      setFormData((prev) => ({ ...prev, coverImage: compressedBase64 }))
      setValidationErrors((prev) => {
        const { coverImage: _c, ...rest } = prev
        return rest
      })
    } catch (err) {
      setValidationErrors((prev) => ({
        ...prev,
        coverImage: err instanceof Error ? err.message : "Failed to process image",
      }))
    }
  }

  const addRule = () => {
    if (currentRule.trim()) {
      if (formData.rules.length >= 5) {
        setValidationErrors((prev) => ({ ...prev, rules: "Maximum 5 rules allowed" }))
        return
      }
      setFormData((prev) => ({
        ...prev,
        rules: [...prev.rules, sanitizeText(currentRule)],
      }))
      setCurrentRule("")
      setValidationErrors((prev) => {
        const { rules, ...rest } = prev
        return rest
      })
    }
  }

  const removeRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }))
  }

  const addMember = () => {
    const memberTrimed = currentMember.trim()
    if (!memberTrimed) return
    
    if (formData.invitedMembers.length >= 10) {
      setValidationErrors((prev) => ({ ...prev, invitedMembers: "Maximum 10 members can be invited" }))
      return
    }
    
    // Validate member name format
    if (memberTrimed.length < 2) {
      setValidationErrors((prev) => ({ ...prev, invitedMembers: "Member name must be at least 2 characters" }))
      return
    }
    
    const sanitized = sanitizeDisplayName(memberTrimed)
    
    // Check for duplicates
    if (formData.invitedMembers.includes(sanitized)) {
      setValidationErrors((prev) => ({ ...prev, invitedMembers: "This member is already invited" }))
      return
    }
    
    setFormData((prev) => ({
      ...prev,
      invitedMembers: [...prev.invitedMembers, sanitized],
    }))
    setCurrentMember("")
    setValidationErrors((prev) => {
      const { invitedMembers, ...rest } = prev
      return rest
    })
  }

  const removeMember = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      invitedMembers: prev.invitedMembers.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async () => {
    if (validateStep(4)) {
      try {
        await onSubmit(formData)
        // Reset form on success
        setStep(1)
        setFormData({
          name: "",
          description: "",
          category: "General",
          privacy: "public",
          coverImage: undefined,
          welcomeMessage: "",
          rules: [],
          invitedMembers: [],
        })
      } catch (err) {
        // Error is handled by parent component
        console.error("[Create Group Error]", err)
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return
    return onCloseTransientUI(() => onClose())
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
      <div className="w-full bg-white rounded-t-lg max-h-screen overflow-hidden flex flex-col">
        {/* Header — always has a clear Back / Close control (Step 1 closes, later steps go previous) */}
        <div className="sticky top-0 flex items-center justify-between gap-2 px-3 py-3 border-b border-gray-200 bg-white z-10">
          <button
            type="button"
            onClick={() => {
              if (step > 1) {
                handlePrevious()
              } else {
                onClose()
              }
            }}
            className="flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition active:scale-95 disabled:opacity-50"
            aria-label={step > 1 ? "Go back to previous step" : "Close create group"}
            disabled={isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="hidden sm:inline">{step > 1 ? "Back" : "Close"}</span>
          </button>
          <h2 id="create-group-title" className="flex-1 text-center font-bold text-gray-900 truncate">
            {step === 1 ? "Create community" : `Create community · ${step}/4`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg p-1 hover:bg-gray-100 transition"
            aria-label="Close modal"
            disabled={isLoading}
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition ${s <= step ? "bg-emerald-600" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Step Guidance */}
        <div className="mx-4 mb-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-xs font-semibold text-gray-700">
            {step === 1 && "Basic Info - Name, category, and description help members discover your group"}
            {step === 2 && "Visual & Privacy - Add a cover image and choose who can join"}
            {step === 3 && "Welcome & Culture - Set the tone for your group community"}
            {step === 4 && "Launch - Review everything and create your group"}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* Step 1: Basic Info - Compact and fast to complete */}
          {step === 1 && (
            <div className="space-y-3 pt-3">
              {/* Group Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Tech Enthusiasts"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value.slice(0, 50) }))
                  }
                  maxLength={50}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition ${
                    validationErrors.name ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-emerald-500"
                  }`}
                  autoFocus
                />
                {validationErrors.name && <p className="text-xs text-red-600 mt-1">{validationErrors.name}</p>}
                <p className="text-xs text-gray-500 mt-1">{formData.name.length}/50</p>
              </div>

              {/* Category - Quick selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="What is this group about? (min 10 chars)"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value.slice(0, 500) }))
                  }
                  maxLength={500}
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition resize-none ${
                    validationErrors.description ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-emerald-500"
                  }`}
                />
                {validationErrors.description && <p className="text-xs text-red-600 mt-1">{validationErrors.description}</p>}
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500</p>
              </div>

              {/* Quick info */}
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700">
                  <strong>Tip:</strong> These fields help members find and understand your group quickly. You can add a cover image and privacy settings in the next step.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Cover Image & Privacy - Quick visual setup */}
          {step === 2 && (
            <div className="space-y-4 pt-3">
              {/* Cover Image - Visual preview */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
                  Cover Image <span className="text-xs text-gray-500">(optional)</span>
                </label>
                {formData.coverImage ? (
                  <div className="relative overflow-hidden rounded-lg bg-zinc-100">
                    <img
                      src={formData.coverImage}
                      alt="Group cover"
                      className="h-48 w-full object-cover"
                      style={{ backgroundColor: "#f4f4f5" }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, coverImage: undefined }))}
                      className="absolute right-2 top-2 rounded-lg bg-red-500 p-1.5 text-white shadow-lg transition hover:bg-red-600"
                      aria-label="Remove cover image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50/30 transition flex flex-col items-center gap-2"
                  >
                    <Upload size={28} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-600">Click to upload image</span>
                    <span className="text-xs text-gray-500">Any size · auto-compressed for performance</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="Upload cover image"
                />
                {validationErrors.coverImage && <p className="text-xs text-red-600 mt-1">{validationErrors.coverImage}</p>}
              </div>

              {/* Privacy Settings */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2.5">Privacy Setting <span className="text-red-500">*</span></label>
                <div className="space-y-2">
                  {PRIVACY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData((prev) => ({ ...prev, privacy: option.value as any }))}
                      className={`w-full p-3 border rounded-lg text-left transition ${
                        formData.privacy === option.value
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          formData.privacy === option.value ? "border-emerald-500 bg-emerald-600" : "border-gray-300"
                        }`}>
                          {formData.privacy === option.value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900">{option.label}</p>
                          <p className="text-xs text-gray-600">{option.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Welcome Message & Rules - Set group culture */}
          {step === 3 && (
            <div className="space-y-4 pt-3">
              {/* Welcome Message - Optional but helpful */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1">
                  Welcome Message <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <textarea
                  placeholder="Welcome to our group! Share what you'd like members to know..."
                  value={formData.welcomeMessage}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, welcomeMessage: e.target.value.slice(0, 500) }))
                  }
                  maxLength={500}
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition resize-none ${
                    validationErrors.welcomeMessage ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-emerald-500"
                  }`}
                />
                {validationErrors.welcomeMessage && <p className="text-xs text-red-600 mt-1">{validationErrors.welcomeMessage}</p>}
                <p className="text-xs text-gray-500 mt-1">{formData.welcomeMessage.length}/500</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Group Rules (Max 5)</label>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {RULE_TEMPLATES.map((pack, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          rules: pack.slice(0, 5),
                        }))
                      }
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"
                    >
                      Template {i + 1}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {formData.rules.map((rule, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-semibold text-gray-600 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                      <p className="text-sm text-gray-700 flex-1">{rule}</p>
                      <button
                        onClick={() => removeRule(idx)}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                        aria-label={`Remove rule ${idx + 1}`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Add a custom rule…"
                    value={currentRule}
                    onChange={(e) => setCurrentRule(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addRule()
                      }
                    }}
                    maxLength={100}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={addRule}
                    disabled={!currentRule.trim() || formData.rules.length >= 5}
                    className="px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-muted disabled:cursor-not-allowed transition"
                  >
                    Add
                  </button>
                </div>
                {validationErrors.rules && <p className="text-xs text-red-600 mt-1">{validationErrors.rules}</p>}
              </div>
            </div>
          )}

          {/* Step 4: Invite Members - Finalize and launch */}
          {step === 4 && (
            <div className="space-y-4 pt-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900">Almost there! 🎉</p>
                <p className="text-xs text-green-800 mt-1">Your group is ready to launch. Optionally invite members to get started.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
                  <Users size={16} />
                  Invite Members <span className="text-xs text-gray-500">(max 10, optional)</span>
                </label>

                {formData.invitedMembers.length > 0 && (
                  <div className="mb-3 space-y-1 p-2 bg-blue-50 rounded-lg">
                    {formData.invitedMembers.map((member, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{member}</span>
                        <button
                          onClick={() => removeMember(idx)}
                          className="p-0.5 hover:bg-red-100 rounded text-red-600"
                          aria-label={`Remove ${member}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter member name..."
                    value={currentMember}
                    onChange={(e) => setCurrentMember(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addMember()
                      }
                    }}
                    maxLength={50}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={addMember}
                    disabled={!currentMember.trim() || formData.invitedMembers.length >= 10}
                    className="px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:bg-muted disabled:cursor-not-allowed transition"
                  >
                    Add
                  </button>
                </div>
                {validationErrors.invitedMembers && <p className="text-xs text-red-600 mt-1">{validationErrors.invitedMembers}</p>}

                <p className="text-xs text-gray-600 mt-2">
                  {formData.invitedMembers.length > 0
                    ? `${formData.invitedMembers.length} member${formData.invitedMembers.length > 1 ? "s" : ""} invited`
                    : "Invite members to your group (optional)"}
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">✓ Ready to create!</span> Review all details and click "Create Group" below.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer with progress indicator and navigation buttons */}
        <div className="sticky bottom-0 px-4 py-4 border-t border-gray-200 bg-white">
          {/* Progress indicator */}
          <div className="flex gap-1.5 mb-3">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition ${
                  s <= step ? "bg-emerald-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Step counter and buttons */}
          <div className="flex items-center gap-2 justify-between">
            <span className="text-xs font-semibold text-gray-600">Step {step} of 4</span>
            
            <div className="flex gap-2 flex-1 justify-end">
              {step > 1 && (
                <button
                  onClick={handlePrevious}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50 transition"
                  aria-label="Go to previous step"
                >
                  Back
                </button>
              )}

              {step < 4 ? (
                <button
                  onClick={handleNext}
                  disabled={isLoading}
                  className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  aria-label={`Go to step ${step + 1}`}
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  aria-label="Create group"
                >
                  {isLoading && <Loader size={16} className="animate-spin" />}
                  {isLoading ? "Creating…" : "Create community"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
