// Input validation and sanitization utilities

export const validation = {
  // Email validation
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  },

  // Name validation (allow letters, spaces, hyphens, apostrophes)
  isValidName: (name: string): boolean => {
    const nameRegex = /^[a-zA-Z\s\-']{2,50}$/
    return nameRegex.test(name)
  },

  // Bio validation
  isValidBio: (bio: string): boolean => {
    return bio.length >= 10 && bio.length <= 500
  },

  // Phone validation (basic international format)
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^\+?[\d\s\-()]{7,20}$/
    return phoneRegex.test(phone)
  },

  // Age validation
  isValidAge: (age: number): boolean => {
    return age >= 18 && age <= 120
  },

  // URL validation
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  },

  // Base64 image validation
  isValidBase64Image: (data: string): boolean => {
    return /^data:image\/(jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(data)
  },

  // Sanitize text input (remove dangerous characters)
  sanitizeText: (text: string): string => {
    return text
      .replace(/[<>\"'&]/g, (match) => {
        const escaped = {
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "&": "&amp;",
        }
        return escaped[match as keyof typeof escaped] || match
      })
      .trim()
  },

  // Clean display name
  cleanDisplayName: (name: string): string => {
    return validation.sanitizeText(name).slice(0, 50)
  },

  // Clean bio
  cleanBio: (bio: string): string => {
    return validation.sanitizeText(bio).slice(0, 500)
  },

  // Validate password strength
  isStrongPassword: (password: string): boolean => {
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*]/.test(password)
    )
  },

  // Get password strength score
  getPasswordStrength: (password: string): "weak" | "medium" | "strong" => {
    if (password.length < 6) return "weak"
    if (password.length < 8) return "medium"
    if (validation.isStrongPassword(password)) return "strong"
    return "medium"
  },
}
