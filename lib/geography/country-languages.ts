/**
 * GreenHaven country-to-language recommendation matrix.
 *
 * This is a recommendation catalog, not a complete inventory of each country's
 * languages and not evidence that translations are available. Every row remains
 * reviewStatus="pending" until reviewed by a native-language reviewer.
 * Language subtags follow ISO 639 / BCP 47 conventions; localeTag retains script
 * and regional distinctions where needed.
 */
export type LanguageCategory = "official" | "recognized" | "indigenous" | "regional" | "community" | "widely-used" | "script-variant"
export type LanguageReviewStatus = "pending" | "reviewed" | "approved"

export interface CountryLanguageRecommendation {
  countryId: string
  /** ISO 639 language subtag (2 or 3 letters). */
  languageCode: string
  /** BCP 47 locale/language tag; may include script and region subtags. */
  localeTag: string
  /** Initial writing direction for interface layout; verify against the selected script. */
  direction: "ltr" | "rtl"
  /** English label for the language or variety. */
  name: string
  /** Native-language display name when confidently established. */
  nativeName: string | null
  category: LanguageCategory
  reviewStatus: LanguageReviewStatus
  note: string
}

export const COUNTRY_LANGUAGE_RECOMMENDATIONS: readonly CountryLanguageRecommendation[] = [
  { countryId: "ng", languageCode: "ha", localeTag: "ha", direction: "ltr", name: "Hausa", nativeName: "Harshen Hausa", category: "indigenous", reviewStatus: "pending", note: "Major indigenous language; not a national official-language designation." },
  { countryId: "ng", languageCode: "ig", localeTag: "ig", direction: "ltr", name: "Igbo", nativeName: "Asụsụ Igbo", category: "indigenous", reviewStatus: "pending", note: "Major indigenous language; not a national official-language designation." },
  { countryId: "ng", languageCode: "yo", localeTag: "yo", direction: "ltr", name: "Yoruba", nativeName: "Èdè Yorùbá", category: "indigenous", reviewStatus: "pending", note: "Major indigenous language; not a national official-language designation." },
  { countryId: "ng", languageCode: "pcm", localeTag: "pcm", direction: "ltr", name: "Nigerian Pidgin", nativeName: "Naija", category: "widely-used", reviewStatus: "pending", note: "Widely used lingua franca; retain English as an additional fallback option." },
  { countryId: "eg", languageCode: "arz", localeTag: "arz", direction: "rtl", name: "Egyptian Arabic", nativeName: "مَصرِي", category: "widely-used", reviewStatus: "pending", note: "Egyptian Arabic is a distinct Arabic variety." },
  { countryId: "eg", languageCode: "aec", localeTag: "aec", direction: "rtl", name: "Saʽidi Arabic", nativeName: "صعيدي", category: "widely-used", reviewStatus: "pending", note: "Upper Egyptian Arabic variety; review local demand." },
  { countryId: "eg", languageCode: "fia", localeTag: "fia", direction: "ltr", name: "Nobiin", nativeName: "Nobiin", category: "widely-used", reviewStatus: "pending", note: "One specific Nubian language; do not label as all Nubian languages." },
  { countryId: "eg", languageCode: "ar", localeTag: "ar-EG", direction: "rtl", name: "Modern Standard Arabic", nativeName: "العربية", category: "widely-used", reviewStatus: "pending", note: "Use for formal Arabic interface terminology; Arabic locale and RTL." },
  { countryId: "za", languageCode: "zu", localeTag: "zu", direction: "ltr", name: "isiZulu", nativeName: "isiZulu", category: "official", reviewStatus: "pending", note: "One of South Africa’s 12 official languages." },
  { countryId: "za", languageCode: "xh", localeTag: "xh", direction: "ltr", name: "isiXhosa", nativeName: "isiXhosa", category: "official", reviewStatus: "pending", note: "One of South Africa’s 12 official languages." },
  { countryId: "za", languageCode: "af", localeTag: "af", direction: "ltr", name: "Afrikaans", nativeName: "Afrikaans", category: "official", reviewStatus: "pending", note: "One of South Africa’s 12 official languages." },
  { countryId: "za", languageCode: "en", localeTag: "en-ZA", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "One of South Africa’s 12 official languages." },
  { countryId: "ke", languageCode: "sw", localeTag: "sw", direction: "ltr", name: "Kiswahili", nativeName: "Kiswahili", category: "official", reviewStatus: "pending", note: "National and official language" },
  { countryId: "ke", languageCode: "en", localeTag: "en-KE", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "ke", languageCode: "ki", localeTag: "ki", direction: "ltr", name: "Kikuyu", nativeName: "Gĩkũyũ", category: "indigenous", reviewStatus: "pending", note: "Validate regional and audience priority" },
  { countryId: "ke", languageCode: "luo", localeTag: "luo", direction: "ltr", name: "Dholuo", nativeName: "Dholuo", category: "regional", reviewStatus: "pending", note: "Validate regional and audience priority" },
  { countryId: "gh", languageCode: "ak", localeTag: "ak", direction: "ltr", name: "Akan (Twi)", nativeName: "Akan", category: "indigenous", reviewStatus: "pending", note: "Akan varieties need careful terminology review" },
  { countryId: "gh", languageCode: "ee", localeTag: "ee", direction: "ltr", name: "Ewe", nativeName: "Eʋegbe", category: "indigenous", reviewStatus: "pending", note: "Regional language" },
  { countryId: "gh", languageCode: "dag", localeTag: "dag", direction: "ltr", name: "Dagbani", nativeName: "Dagbanli", category: "indigenous", reviewStatus: "pending", note: "Regional language" },
  { countryId: "gh", languageCode: "gaa", localeTag: "gaa", direction: "ltr", name: "Ga", nativeName: "Gã", category: "indigenous", reviewStatus: "pending", note: "Regional language" },
  { countryId: "ma", languageCode: "ary", localeTag: "ary", direction: "ltr", name: "Moroccan Arabic (Darija)", nativeName: "الدارجة المغربية", category: "widely-used", reviewStatus: "pending", note: "Distinct from Modern Standard Arabic" },
  { countryId: "ma", languageCode: "zgh", localeTag: "zgh", direction: "ltr", name: "Central Atlas Tamazight", nativeName: "ⵜⴰⵎⴰⵣⵉⵖⵜ", category: "widely-used", reviewStatus: "pending", note: "A standardized Amazigh variety; not a proxy for every Amazigh variety." },
  { countryId: "ma", languageCode: "fr", localeTag: "fr-MA", direction: "ltr", name: "French", nativeName: "Français", category: "widely-used", reviewStatus: "pending", note: "Validate user preference" },
  { countryId: "ma", languageCode: "es", localeTag: "es-MA", direction: "ltr", name: "Spanish", nativeName: "Español", category: "regional", reviewStatus: "pending", note: "More relevant in some northern areas" },
  { countryId: "et", languageCode: "am", localeTag: "am", direction: "ltr", name: "Amharic", nativeName: "አማርኛ", category: "recognized", reviewStatus: "pending", note: "More than 80 languages; regional needs vary" },
  { countryId: "et", languageCode: "om", localeTag: "om", direction: "ltr", name: "Oromo", nativeName: "Afaan Oromoo", category: "regional", reviewStatus: "pending", note: "Large speaker population" },
  { countryId: "et", languageCode: "so", localeTag: "so", direction: "ltr", name: "Somali", nativeName: "Soomaali", category: "regional", reviewStatus: "pending", note: "Regional priority" },
  { countryId: "et", languageCode: "ti", localeTag: "ti", direction: "ltr", name: "Tigrinya", nativeName: "ትግርኛ", category: "regional", reviewStatus: "pending", note: "Regional priority" },
  { countryId: "tz", languageCode: "sw", localeTag: "sw", direction: "ltr", name: "Kiswahili", nativeName: "Kiswahili", category: "widely-used", reviewStatus: "pending", note: "Official status varies by context" },
  { countryId: "tz", languageCode: "en", localeTag: "en-TZ", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Widely used in education and administration" },
  { countryId: "tz", languageCode: "suk", localeTag: "suk", direction: "ltr", name: "Sukuma", nativeName: "Kisukuma", category: "indigenous", reviewStatus: "pending", note: "Validate geographic distribution" },
  { countryId: "tz", languageCode: "jmc", localeTag: "jmc", direction: "ltr", name: "Chaga", nativeName: "Kimachame", category: "indigenous", reviewStatus: "pending", note: "Chaga is a group; choose specific variety before translation" },
  { countryId: "ug", languageCode: "en", localeTag: "en-UG", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "ug", languageCode: "sw", localeTag: "sw", direction: "ltr", name: "Swahili", nativeName: "Kiswahili", category: "official", reviewStatus: "pending", note: "Official language; usage differs by region" },
  { countryId: "ug", languageCode: "lg", localeTag: "lg", direction: "ltr", name: "Luganda", nativeName: "Luganda", category: "regional", reviewStatus: "pending", note: "Important in central Uganda" },
  { countryId: "ug", languageCode: "nyn", localeTag: "nyn", direction: "ltr", name: "Runyankole", nativeName: "Runyankore", category: "regional", reviewStatus: "pending", note: "Validate national user demand" },
  { countryId: "sn", languageCode: "fr", localeTag: "fr-SN", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "sn", languageCode: "wo", localeTag: "wo", direction: "ltr", name: "Wolof", nativeName: "Wolof", category: "widely-used", reviewStatus: "pending", note: "Widely used nationally" },
  { countryId: "sn", languageCode: "ff", localeTag: "ff", direction: "ltr", name: "Pulaar", nativeName: "Fulfulde", category: "regional", reviewStatus: "pending", note: "Fula varieties require locale/variety review" },
  { countryId: "sn", languageCode: "srr", localeTag: "srr", direction: "ltr", name: "Serer", nativeName: "Seereer", category: "indigenous", reviewStatus: "pending", note: "Validate translation resources" },
  { countryId: "cn", languageCode: "zh", localeTag: "zh-Hans-CN", direction: "ltr", name: "Mandarin Chinese (Simplified script)", nativeName: "中文", category: "widely-used", reviewStatus: "pending", note: "Simplified script is the mainland China default candidate." },
  { countryId: "cn", languageCode: "zh", localeTag: "zh-Hant", direction: "ltr", name: "Mandarin Chinese (Traditional script)", nativeName: "中文", category: "widely-used", reviewStatus: "pending", note: "Traditional script is a script choice, not a separate language." },
  { countryId: "cn", languageCode: "yue", localeTag: "yue", direction: "ltr", name: "Cantonese", nativeName: "粵語", category: "regional", reviewStatus: "pending", note: "Separate language support, not merely Mandarin voice" },
  { countryId: "cn", languageCode: "bo", localeTag: "bo", direction: "ltr", name: "Tibetan", nativeName: "བོད་སྐད་", category: "regional", reviewStatus: "pending", note: "Regional and script support required" },
  { countryId: "in", languageCode: "hi", localeTag: "hi-IN", direction: "ltr", name: "Hindi", nativeName: "हिन्दी", category: "widely-used", reviewStatus: "pending", note: "India has 22 scheduled languages; this four-language set is not exhaustive." },
  { countryId: "in", languageCode: "bn", localeTag: "bn-IN", direction: "ltr", name: "Bengali", nativeName: "বাংলা", category: "widely-used", reviewStatus: "pending", note: "Regional distribution matters." },
  { countryId: "in", languageCode: "ta", localeTag: "ta-IN", direction: "ltr", name: "Tamil", nativeName: "தமிழ்", category: "widely-used", reviewStatus: "pending", note: "Regional distribution matters." },
  { countryId: "in", languageCode: "te", localeTag: "te-IN", direction: "ltr", name: "Telugu", nativeName: "తెలుగు", category: "widely-used", reviewStatus: "pending", note: "Regional distribution matters." },
  { countryId: "jp", languageCode: "ja", localeTag: "ja", direction: "ltr", name: "Japanese", nativeName: "日本語", category: "widely-used", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "jp", languageCode: "en", localeTag: "en-JP", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Validate user preference and translation need" },
  { countryId: "jp", languageCode: "ain", localeTag: "ain", direction: "ltr", name: "Ainu", nativeName: "アイヌ・イタㇰ", category: "indigenous", reviewStatus: "pending", note: "Specialist community review required" },
  { countryId: "jp", languageCode: "ryu", localeTag: "ryu", direction: "ltr", name: "Okinawan", nativeName: "沖縄口", category: "regional", reviewStatus: "pending", note: "Ryukyuan varieties require careful scoping" },
  { countryId: "kr", languageCode: "ko", localeTag: "ko", direction: "ltr", name: "Korean", nativeName: "한국어", category: "widely-used", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "kr", languageCode: "en", localeTag: "en-KR", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary interface option" },
  { countryId: "kr", languageCode: "zh", localeTag: "zh", direction: "ltr", name: "Chinese", nativeName: "中文", category: "community", reviewStatus: "pending", note: "Validate dialect/script preference" },
  { countryId: "kr", languageCode: "ja", localeTag: "ja", direction: "ltr", name: "Japanese", nativeName: "日本語", category: "community", reviewStatus: "pending", note: "Supplementary option; validate demand" },
  { countryId: "id", languageCode: "id", localeTag: "id", direction: "ltr", name: "Indonesian", nativeName: "Bahasa Indonesia", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "id", languageCode: "jv", localeTag: "jv", direction: "ltr", name: "Javanese", nativeName: "Basa Jawa", category: "regional", reviewStatus: "pending", note: "Regional variation" },
  { countryId: "id", languageCode: "su", localeTag: "su", direction: "ltr", name: "Sundanese", nativeName: "Basa Sunda", category: "regional", reviewStatus: "pending", note: "Regional variation" },
  { countryId: "id", languageCode: "mad", localeTag: "mad", direction: "ltr", name: "Madurese", nativeName: "Madhurâ", category: "regional", reviewStatus: "pending", note: "Regional variation" },
  { countryId: "sa", languageCode: "ar", localeTag: "ar-SA", direction: "rtl", name: "Arabic", nativeName: "العربية", category: "official", reviewStatus: "pending", note: "Arabic locale and RTL support" },
  { countryId: "sa", languageCode: "en", localeTag: "en-SA", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary interface option" },
  { countryId: "sa", languageCode: "ur", localeTag: "ur", direction: "rtl", name: "Urdu", nativeName: "اردو", category: "community", reviewStatus: "pending", note: "RTL support" },
  { countryId: "sa", languageCode: "bn", localeTag: "bn", direction: "ltr", name: "Bengali", nativeName: "বাংলা", category: "community", reviewStatus: "pending", note: "Validate user demand" },
  { countryId: "pk", languageCode: "ur", localeTag: "ur-PK", direction: "rtl", name: "Urdu", nativeName: "اردو", category: "official", reviewStatus: "pending", note: "RTL support" },
  { countryId: "pk", languageCode: "pa", localeTag: "pa-Arab-PK", direction: "rtl", name: "Punjabi (Shahmukhi)", nativeName: "ਪੰਜਾਬੀ", category: "widely-used", reviewStatus: "pending", note: "Shahmukhi script is the intended Pakistan UI candidate." },
  { countryId: "pk", languageCode: "ps", localeTag: "ps", direction: "rtl", name: "Pashto", nativeName: "پښتو", category: "regional", reviewStatus: "pending", note: "RTL support" },
  { countryId: "pk", languageCode: "sd", localeTag: "sd", direction: "rtl", name: "Sindhi", nativeName: "سنڌي", category: "regional", reviewStatus: "pending", note: "RTL support and script review" },
  { countryId: "bd", languageCode: "bn", localeTag: "bn-BD", direction: "ltr", name: "Bangla", nativeName: "বাংলা", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "bd", languageCode: "syl", localeTag: "syl", direction: "ltr", name: "Sylheti", nativeName: "ꠍꠤꠟꠐꠤ", category: "regional", reviewStatus: "pending", note: "Orthography and language-code support need validation" },
  { countryId: "bd", languageCode: "ctg", localeTag: "ctg", direction: "ltr", name: "Chittagonian", nativeName: "চাটগাঁইয়া", category: "regional", reviewStatus: "pending", note: "Orthography and language-code support need validation" },
  { countryId: "bd", languageCode: "en", localeTag: "en-BD", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "th", languageCode: "th", localeTag: "th", direction: "ltr", name: "Thai", nativeName: "ภาษาไทย", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "th", languageCode: "tts", localeTag: "tts", direction: "ltr", name: "Isan", nativeName: "ภาษาอีสาน", category: "regional", reviewStatus: "pending", note: "Related to Lao; validate variety" },
  { countryId: "th", languageCode: "nod", localeTag: "nod", direction: "ltr", name: "Northern Thai", nativeName: "คำเมือง", category: "regional", reviewStatus: "pending", note: "Validate orthography and coverage" },
  { countryId: "th", languageCode: "mfa", localeTag: "mfa", direction: "ltr", name: "Malay (Patani)", nativeName: "بهاس ملايو ปัตตานี", category: "regional", reviewStatus: "pending", note: "Southern border communities" },
  { countryId: "vn", languageCode: "vi", localeTag: "vi", direction: "ltr", name: "Vietnamese", nativeName: "Tiếng Việt", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "vn", languageCode: "tyz", localeTag: "tyz", direction: "ltr", name: "Tày", nativeName: "Tày", category: "community", reviewStatus: "pending", note: "Validate availability of quality translation resources" },
  { countryId: "vn", languageCode: "hmn", localeTag: "hmn", direction: "ltr", name: "Hmong", nativeName: "Hmoob", category: "community", reviewStatus: "pending", note: "Group code; choose specific variety" },
  { countryId: "vn", languageCode: "en", localeTag: "en-VN", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary interface option" },
  { countryId: "gb", languageCode: "en", localeTag: "en-GB", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "gb", languageCode: "cy", localeTag: "cy", direction: "ltr", name: "Welsh", nativeName: "Cymraeg", category: "official", reviewStatus: "pending", note: "Regional official language" },
  { countryId: "gb", languageCode: "gd", localeTag: "gd", direction: "ltr", name: "Scottish Gaelic", nativeName: "Gàidhlig", category: "official", reviewStatus: "pending", note: "Regional language" },
  { countryId: "gb", languageCode: "pl", localeTag: "pl", direction: "ltr", name: "Polish", nativeName: "Polski", category: "community", reviewStatus: "pending", note: "Validate user demand" },
  { countryId: "fr", languageCode: "fr", localeTag: "fr-FR", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "fr", languageCode: "ar", localeTag: "ar", direction: "rtl", name: "Arabic", nativeName: "العربية", category: "community", reviewStatus: "pending", note: "Choose Modern Standard Arabic vs dialect strategy" },
  { countryId: "fr", languageCode: "oc", localeTag: "oc", direction: "ltr", name: "Occitan", nativeName: "Occitan", category: "regional", reviewStatus: "pending", note: "Regional varieties" },
  { countryId: "fr", languageCode: "br", localeTag: "br", direction: "ltr", name: "Breton", nativeName: "Brezhoneg", category: "regional", reviewStatus: "pending", note: "Regional language" },
  { countryId: "de", languageCode: "de", localeTag: "de-DE", direction: "ltr", name: "German", nativeName: "Deutsch", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "de", languageCode: "tr", localeTag: "tr", direction: "ltr", name: "Turkish", nativeName: "Türkçe", category: "community", reviewStatus: "pending", note: "Community language" },
  { countryId: "de", languageCode: "en", localeTag: "en-DE", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "de", languageCode: "ar", localeTag: "ar", direction: "rtl", name: "Arabic", nativeName: "العربية", category: "community", reviewStatus: "pending", note: "RTL support" },
  { countryId: "it", languageCode: "it", localeTag: "it", direction: "ltr", name: "Italian", nativeName: "Italiano", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "it", languageCode: "de", localeTag: "de", direction: "ltr", name: "German", nativeName: "Deutsch", category: "official", reviewStatus: "pending", note: "South Tyrol and other areas" },
  { countryId: "it", languageCode: "fr", localeTag: "fr", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Aosta Valley" },
  { countryId: "it", languageCode: "sc", localeTag: "sc", direction: "ltr", name: "Sardinian", nativeName: "Sardu", category: "regional", reviewStatus: "pending", note: "Variety and orthography review" },
  { countryId: "es", languageCode: "es", localeTag: "es-ES", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "es", languageCode: "ca", localeTag: "ca", direction: "ltr", name: "Catalan", nativeName: "Català", category: "official", reviewStatus: "pending", note: "Regional use" },
  { countryId: "es", languageCode: "gl", localeTag: "gl", direction: "ltr", name: "Galician", nativeName: "Galego", category: "official", reviewStatus: "pending", note: "Regional use" },
  { countryId: "es", languageCode: "eu", localeTag: "eu", direction: "ltr", name: "Basque", nativeName: "Euskara", category: "official", reviewStatus: "pending", note: "Regional use" },
  { countryId: "nl", languageCode: "nl", localeTag: "nl", direction: "ltr", name: "Dutch", nativeName: "Nederlands", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "nl", languageCode: "fy", localeTag: "fy", direction: "ltr", name: "Frisian", nativeName: "Frysk", category: "official", reviewStatus: "pending", note: "Regional language" },
  { countryId: "nl", languageCode: "en", localeTag: "en-NL", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "nl", languageCode: "tr", localeTag: "tr", direction: "ltr", name: "Turkish", nativeName: "Türkçe", category: "community", reviewStatus: "pending", note: "Validate user demand" },
  { countryId: "pt", languageCode: "pt", localeTag: "pt-PT", direction: "ltr", name: "Portuguese", nativeName: "Português", category: "widely-used", reviewStatus: "pending", note: "European Portuguese locale." },
  { countryId: "pt", languageCode: "mwl", localeTag: "mwl", direction: "ltr", name: "Mirandese", nativeName: "Mirandés", category: "recognized", reviewStatus: "pending", note: "Small speaker community; specialist review" },
  { countryId: "pt", languageCode: "en", localeTag: "en-PT", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "pt", languageCode: "kea", localeTag: "kea", direction: "ltr", name: "Cape Verdean Creole", nativeName: "Kriolu", category: "community", reviewStatus: "pending", note: "Validate national usage" },
  { countryId: "ch", languageCode: "de", localeTag: "de-CH", direction: "ltr", name: "German", nativeName: "Deutsch", category: "official", reviewStatus: "pending", note: "Swiss Standard German for written UI" },
  { countryId: "ch", languageCode: "fr", localeTag: "fr-CH", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Regional locale" },
  { countryId: "ch", languageCode: "it", localeTag: "it-CH", direction: "ltr", name: "Italian", nativeName: "Italiano", category: "official", reviewStatus: "pending", note: "Regional locale" },
  { countryId: "ch", languageCode: "rm", localeTag: "rm", direction: "ltr", name: "Romansh", nativeName: "Rumantsch", category: "official", reviewStatus: "pending", note: "Several written varieties; standardization review" },
  { countryId: "pl", languageCode: "pl", localeTag: "pl", direction: "ltr", name: "Polish", nativeName: "Polski", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "pl", languageCode: "en", localeTag: "en-PL", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "pl", languageCode: "uk", localeTag: "uk", direction: "ltr", name: "Ukrainian", nativeName: "Українська", category: "community", reviewStatus: "pending", note: "Community language" },
  { countryId: "pl", languageCode: "de", localeTag: "de", direction: "ltr", name: "German", nativeName: "Deutsch", category: "community", reviewStatus: "pending", note: "Validate user demand" },
  { countryId: "se", languageCode: "sv", localeTag: "sv", direction: "ltr", name: "Swedish", nativeName: "Svenska", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "se", languageCode: "fi", localeTag: "fi", direction: "ltr", name: "Finnish", nativeName: "Suomi", category: "recognized", reviewStatus: "pending", note: "Recognized minority language" },
  { countryId: "se", languageCode: "ar", localeTag: "ar", direction: "rtl", name: "Arabic", nativeName: "العربية", category: "community", reviewStatus: "pending", note: "RTL support" },
  { countryId: "se", languageCode: "en", localeTag: "en-SE", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "us", languageCode: "en", localeTag: "en-US", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Not a single federal official language" },
  { countryId: "us", languageCode: "es", localeTag: "es-US", direction: "ltr", name: "Spanish", nativeName: "Español", category: "community", reviewStatus: "pending", note: "High practical priority" },
  { countryId: "us", languageCode: "zh", localeTag: "zh", direction: "ltr", name: "Chinese", nativeName: "中文", category: "community", reviewStatus: "pending", note: "Need Mandarin/Cantonese and script distinction" },
  { countryId: "us", languageCode: "tl", localeTag: "tl", direction: "ltr", name: "Tagalog", nativeName: null, category: "community", reviewStatus: "pending", note: "Validate user demand" },
  { countryId: "ca", languageCode: "en", localeTag: "en-CA", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Federal official language" },
  { countryId: "ca", languageCode: "fr", localeTag: "fr-CA", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Canadian French locale" },
  { countryId: "ca", languageCode: "pa", localeTag: "pa-Guru-CA", direction: "ltr", name: "Punjabi (Gurmukhi)", nativeName: "ਪੰਜਾਬੀ", category: "widely-used", reviewStatus: "pending", note: "Gurmukhi script is the intended Canadian UI candidate." },
  { countryId: "ca", languageCode: "iu", localeTag: "iu", direction: "ltr", name: "Inuktitut", nativeName: "ᐃᓄᒃᑎᑐᑦ", category: "indigenous", reviewStatus: "pending", note: "Nunavut and other Inuit regions" },
  { countryId: "mx", languageCode: "es", localeTag: "es-MX", direction: "ltr", name: "Spanish", nativeName: "Español", category: "widely-used", reviewStatus: "pending", note: "Spanish is not the only recognized language" },
  { countryId: "mx", languageCode: "nah", localeTag: "nah", direction: "ltr", name: "Nahuatl", nativeName: "Nāhuatl", category: "indigenous", reviewStatus: "pending", note: "Multiple varieties" },
  { countryId: "mx", languageCode: "yua", localeTag: "yua", direction: "ltr", name: "Yucatec Maya", nativeName: "Màaya tʼàan", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "mx", languageCode: "mix", localeTag: "mix", direction: "ltr", name: "Mixtec", nativeName: "Tuʼun savi", category: "indigenous", reviewStatus: "pending", note: "Multiple varieties" },
  { countryId: "cu", languageCode: "es", localeTag: "es-CU", direction: "ltr", name: "Spanish", nativeName: "Español", category: "widely-used", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "cu", languageCode: "ht", localeTag: "ht", direction: "ltr", name: "Haitian Creole", nativeName: "Kreyòl ayisyen", category: "community", reviewStatus: "pending", note: "Community language" },
  { countryId: "cu", languageCode: "en", localeTag: "en-CU", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "cu", languageCode: "zh", localeTag: "zh", direction: "ltr", name: "Chinese", nativeName: "中文", category: "community", reviewStatus: "pending", note: "Community language" },
  { countryId: "jm", languageCode: "en", localeTag: "en-JM", direction: "ltr", name: "Jamaican English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Use standard written English for UI" },
  { countryId: "jm", languageCode: "jam", localeTag: "jam", direction: "ltr", name: "Jamaican Creole (Patwa)", nativeName: "Patwa", category: "widely-used", reviewStatus: "pending", note: "Treat as a language variety with its own reviewed orthography." },
  { countryId: "jm", languageCode: "es", localeTag: "es", direction: "ltr", name: "Spanish", nativeName: "Español", category: "regional", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "jm", languageCode: "zh", localeTag: "zh", direction: "ltr", name: "Chinese", nativeName: "中文", category: "community", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "cr", languageCode: "es", localeTag: "es-CR", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "cr", languageCode: "en", localeTag: "en-CR", direction: "ltr", name: "English", nativeName: "English", category: "community", reviewStatus: "pending", note: "Caribbean coast and tourism" },
  { countryId: "cr", languageCode: "bzd", localeTag: "bzd", direction: "ltr", name: "Bribri", nativeName: "Bribri", category: "indigenous", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "cr", languageCode: "cjp", localeTag: "cjp", direction: "ltr", name: "Cabécar", nativeName: "Cabécar", category: "indigenous", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "gt", languageCode: "es", localeTag: "es-GT", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "gt", languageCode: "quc", localeTag: "quc", direction: "ltr", name: "K'iche'", nativeName: "Kʼicheʼ", category: "indigenous", reviewStatus: "pending", note: "One of many Mayan languages" },
  { countryId: "gt", languageCode: "kek", localeTag: "kek", direction: "ltr", name: "Q'eqchi'", nativeName: "Qʼeqchiʼ", category: "indigenous", reviewStatus: "pending", note: "One of many Mayan languages" },
  { countryId: "gt", languageCode: "cak", localeTag: "cak", direction: "ltr", name: "Kaqchikel", nativeName: "Kaqchikel", category: "indigenous", reviewStatus: "pending", note: "One of many Mayan languages" },
  { countryId: "pa", languageCode: "es", localeTag: "es-PA", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "pa", languageCode: "en", localeTag: "en-PA", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "pa", languageCode: "gym", localeTag: "gym", direction: "ltr", name: "Ngäbere", nativeName: "Ngäbere", category: "indigenous", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "pa", languageCode: "cuk", localeTag: "cuk", direction: "ltr", name: "Guna", nativeName: "Dulegaya", category: "indigenous", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "do", languageCode: "es", localeTag: "es-DO", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "do", languageCode: "ht", localeTag: "ht", direction: "ltr", name: "Haitian Creole", nativeName: "Kreyòl ayisyen", category: "community", reviewStatus: "pending", note: "Large Haitian-origin community" },
  { countryId: "do", languageCode: "en", localeTag: "en-DO", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "do", languageCode: "fr", localeTag: "fr", direction: "ltr", name: "French", nativeName: "Français", category: "widely-used", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "ht", languageCode: "ht", localeTag: "ht", direction: "ltr", name: "Haitian Creole", nativeName: "Kreyòl ayisyen", category: "widely-used", reviewStatus: "pending", note: "Use Haitian Creole orthography and native-language review." },
  { countryId: "ht", languageCode: "fr", localeTag: "fr-HT", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "ht", languageCode: "es", localeTag: "es", direction: "ltr", name: "Spanish", nativeName: "Español", category: "regional", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "ht", languageCode: "en", localeTag: "en", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "br", languageCode: "pt", localeTag: "pt-BR", direction: "ltr", name: "Portuguese", nativeName: "Português", category: "widely-used", reviewStatus: "pending", note: "Brazilian Portuguese locale." },
  { countryId: "br", languageCode: "es", localeTag: "es", direction: "ltr", name: "Spanish", nativeName: "Español", category: "regional", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "br", languageCode: "de", localeTag: "de", direction: "ltr", name: "German", nativeName: "Deutsch", category: "community", reviewStatus: "pending", note: "Regional communities" },
  { countryId: "br", languageCode: "it", localeTag: "it", direction: "ltr", name: "Italian", nativeName: "Italiano", category: "community", reviewStatus: "pending", note: "Regional communities" },
  { countryId: "ar", languageCode: "es", localeTag: "es-AR", direction: "ltr", name: "Spanish", nativeName: "Español", category: "widely-used", reviewStatus: "pending", note: "Rioplatense locale may matter" },
  { countryId: "ar", languageCode: "gn", localeTag: "gn", direction: "ltr", name: "Guarani", nativeName: "Avañeʼẽ", category: "official", reviewStatus: "pending", note: "Corrientes and border regions" },
  { countryId: "ar", languageCode: "en", localeTag: "en", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Supplementary option" },
  { countryId: "ar", languageCode: "it", localeTag: "it", direction: "ltr", name: "Italian", nativeName: "Italiano", category: "community", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "co", languageCode: "es", localeTag: "es-CO", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "co", languageCode: "guc", localeTag: "guc", direction: "ltr", name: "Wayuunaiki", nativeName: "Wayuunaiki", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "co", languageCode: "pbb", localeTag: "pbb", direction: "ltr", name: "Nasa Yuwe", nativeName: "Nasa Yuwe", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "co", languageCode: "en", localeTag: "en", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "San Andrés and tourism; validate" },
  { countryId: "cl", languageCode: "es", localeTag: "es-CL", direction: "ltr", name: "Spanish", nativeName: "Español", category: "widely-used", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "cl", languageCode: "arn", localeTag: "arn", direction: "ltr", name: "Mapudungun", nativeName: "Mapudungun", category: "indigenous", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "cl", languageCode: "ay", localeTag: "ay", direction: "ltr", name: "Aymara", nativeName: "Aymar aru", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "cl", languageCode: "rap", localeTag: "rap", direction: "ltr", name: "Rapa Nui", nativeName: "Vananga rapa nui", category: "indigenous", reviewStatus: "pending", note: "Easter Island / Rapa Nui" },
  { countryId: "pe", languageCode: "es", localeTag: "es-PE", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "pe", languageCode: "qu", localeTag: "qu", direction: "ltr", name: "Quechua", nativeName: "Runasimi", category: "official", reviewStatus: "pending", note: "Language varieties differ" },
  { countryId: "pe", languageCode: "ay", localeTag: "ay", direction: "ltr", name: "Aymara", nativeName: "Aymar aru", category: "official", reviewStatus: "pending", note: "Regional" },
  { countryId: "pe", languageCode: "cni", localeTag: "cni", direction: "ltr", name: "Asháninka", nativeName: "Asháninka", category: "indigenous", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "ve", languageCode: "es", localeTag: "es-VE", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "ve", languageCode: "guc", localeTag: "guc", direction: "ltr", name: "Wayuunaiki", nativeName: "Wayuunaiki", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "ve", languageCode: "wba", localeTag: "wba", direction: "ltr", name: "Warao", nativeName: "Warao", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "ve", languageCode: "aoc", localeTag: "aoc", direction: "ltr", name: "Pemón", nativeName: "Pemon", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "ec", languageCode: "es", localeTag: "es-EC", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "ec", languageCode: "qu", localeTag: "qu", direction: "ltr", name: "Kichwa", nativeName: "Runasimi", category: "official", reviewStatus: "pending", note: "Varieties and orthography" },
  { countryId: "ec", languageCode: "jiv", localeTag: "jiv", direction: "ltr", name: "Shuar", nativeName: "Shuar chicham", category: "official", reviewStatus: "pending", note: "Specialist review" },
  { countryId: "ec", languageCode: "acu", localeTag: "acu", direction: "ltr", name: "Achuar", nativeName: "Achuar chicham", category: "indigenous", reviewStatus: "pending", note: "Regional" },
  { countryId: "bo", languageCode: "es", localeTag: "es-BO", direction: "ltr", name: "Spanish", nativeName: "Español", category: "widely-used", reviewStatus: "pending", note: "One of 37 official languages; four recommendations are not exhaustive." },
  { countryId: "bo", languageCode: "qu", localeTag: "qu", direction: "ltr", name: "Quechua", nativeName: "Runasimi", category: "official", reviewStatus: "pending", note: "Varieties" },
  { countryId: "bo", languageCode: "ay", localeTag: "ay", direction: "ltr", name: "Aymara", nativeName: "Aymar aru", category: "official", reviewStatus: "pending", note: "Regional" },
  { countryId: "bo", languageCode: "gn", localeTag: "gn", direction: "ltr", name: "Guarani", nativeName: "Avañeʼẽ", category: "official", reviewStatus: "pending", note: "Regional" },
  { countryId: "py", languageCode: "es", localeTag: "es-PY", direction: "ltr", name: "Spanish", nativeName: "Español", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "py", languageCode: "gn", localeTag: "gn", direction: "ltr", name: "Guarani", nativeName: "Avañeʼẽ", category: "widely-used", reviewStatus: "pending", note: "Co-official with Spanish." },
  { countryId: "py", languageCode: "pt", localeTag: "pt", direction: "ltr", name: "Portuguese", nativeName: "Português", category: "community", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "py", languageCode: "de", localeTag: "de", direction: "ltr", name: "German", nativeName: "Deutsch", category: "community", reviewStatus: "pending", note: "Menno / heritage communities; validate" },
  { countryId: "uy", languageCode: "es", localeTag: "es-UY", direction: "ltr", name: "Spanish", nativeName: "Español", category: "widely-used", reviewStatus: "pending", note: "Rioplatense locale may matter" },
  { countryId: "uy", languageCode: "pt", localeTag: "pt", direction: "ltr", name: "Uruguayan Portuguese (Fronterizo)", nativeName: "Português", category: "widely-used", reviewStatus: "pending", note: "Regional border variety; review language identity and orthography." },
  { countryId: "uy", languageCode: "it", localeTag: "it", direction: "ltr", name: "Italian", nativeName: "Italiano", category: "community", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "uy", languageCode: "en", localeTag: "en", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "au", languageCode: "en", localeTag: "en-AU", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "No federal official language; de facto" },
  { countryId: "au", languageCode: "zh", localeTag: "zh", direction: "ltr", name: "Mandarin Chinese", nativeName: "中文", category: "community", reviewStatus: "pending", note: "Choose script/variety" },
  { countryId: "au", languageCode: "ar", localeTag: "ar", direction: "rtl", name: "Arabic", nativeName: "العربية", category: "community", reviewStatus: "pending", note: "RTL support" },
  { countryId: "au", languageCode: "vi", localeTag: "vi", direction: "ltr", name: "Vietnamese", nativeName: "Tiếng Việt", category: "community", reviewStatus: "pending", note: "Validate user demand" },
  { countryId: "nz", languageCode: "en", localeTag: "en-NZ", direction: "ltr", name: "English", nativeName: "English", category: "widely-used", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "nz", languageCode: "mi", localeTag: "mi", direction: "ltr", name: "Māori", nativeName: "Te reo Māori", category: "official", reviewStatus: "pending", note: "Te Reo Māori" },
  { countryId: "nz", languageCode: "sm", localeTag: "sm", direction: "ltr", name: "Samoan", nativeName: "Gagana Sāmoa", category: "community", reviewStatus: "pending", note: "Major Pacific language community" },
  { countryId: "nz", languageCode: "to", localeTag: "to", direction: "ltr", name: "Tongan", nativeName: "Lea faka-Tonga", category: "widely-used", reviewStatus: "pending", note: "Written UI language candidate; sign-language accessibility is a separate workstream." },
  { countryId: "pg", languageCode: "tpi", localeTag: "tpi", direction: "ltr", name: "Tok Pisin", nativeName: "Tok Pisin", category: "widely-used", reviewStatus: "pending", note: "High-priority local language." },
  { countryId: "pg", languageCode: "en", localeTag: "en-PG", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "pg", languageCode: "ho", localeTag: "ho", direction: "ltr", name: "Hiri Motu", nativeName: "Hiri Motu", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "pg", languageCode: "enq", localeTag: "enq", direction: "ltr", name: "Enga", nativeName: "Enga", category: "regional", reviewStatus: "pending", note: "One of many local languages; validate demand" },
  { countryId: "fj", languageCode: "en", localeTag: "en-FJ", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "fj", languageCode: "fj", localeTag: "fj", direction: "ltr", name: "Fijian", nativeName: "Na Vosa Vakaviti", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "fj", languageCode: "hif", localeTag: "hif", direction: "ltr", name: "Fiji Hindi", nativeName: "Fiji Hindi", category: "community", reviewStatus: "pending", note: "Distinct from standard Hindi" },
  { countryId: "fj", languageCode: "rtm", localeTag: "rtm", direction: "ltr", name: "Rotuman", nativeName: "Rotuman", category: "regional", reviewStatus: "pending", note: "Rotuma community" },
  { countryId: "ws", languageCode: "sm", localeTag: "sm", direction: "ltr", name: "Samoan", nativeName: "Gagana Sāmoa", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "ws", languageCode: "en", localeTag: "en-WS", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "ws", languageCode: "tkl", localeTag: "tkl", direction: "ltr", name: "Tokelauan", nativeName: "Gagana Tokelau", category: "community", reviewStatus: "pending", note: "Validate national usage" },
  { countryId: "ws", languageCode: "to", localeTag: "to", direction: "ltr", name: "Tongan", nativeName: "Lea faka-Tonga", category: "community", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "to", languageCode: "to", localeTag: "to", direction: "ltr", name: "Tongan", nativeName: "Lea faka-Tonga", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "to", languageCode: "en", localeTag: "en-TO", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Primary recommendation" },
  { countryId: "to", languageCode: "sm", localeTag: "sm", direction: "ltr", name: "Samoan", nativeName: "Gagana Sāmoa", category: "regional", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "to", languageCode: "fj", localeTag: "fj", direction: "ltr", name: "Fijian", nativeName: "Na Vosa Vakaviti", category: "regional", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "sb", languageCode: "pis", localeTag: "pis", direction: "ltr", name: "Solomon Islands Pijin", nativeName: "Pijin", category: "widely-used", reviewStatus: "pending", note: "Distinct from Nigerian Pidgin and Tok Pisin." },
  { countryId: "sb", languageCode: "en", localeTag: "en-SB", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "sb", languageCode: "nlg", localeTag: "nlg", direction: "ltr", name: "Gela", nativeName: "Gela", category: "regional", reviewStatus: "pending", note: "Specialist validation needed" },
  { countryId: "sb", languageCode: "kwd", localeTag: "kwd", direction: "ltr", name: "Kwaio", nativeName: "Kwaio", category: "regional", reviewStatus: "pending", note: "Specialist validation needed" },
  { countryId: "vu", languageCode: "bi", localeTag: "bi", direction: "ltr", name: "Bislama", nativeName: "Bislama", category: "widely-used", reviewStatus: "pending", note: "National lingua franca." },
  { countryId: "vu", languageCode: "en", localeTag: "en-VU", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "vu", languageCode: "fr", localeTag: "fr-VU", direction: "ltr", name: "French", nativeName: "Français", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "vu", languageCode: "pbh", localeTag: "pbh", direction: "ltr", name: "Nakanamanga", nativeName: "Nakanamanga", category: "regional", reviewStatus: "pending", note: "Vanuatu has 100+ vernacular languages; choose local priorities" },
  { countryId: "ki", languageCode: "gil", localeTag: "gil", direction: "ltr", name: "Gilbertese (I-Kiribati)", nativeName: "Taetae ni Kiribati", category: "widely-used", reviewStatus: "pending", note: "Use the community endonym and reviewed orthography." },
  { countryId: "ki", languageCode: "en", localeTag: "en-KI", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Official language" },
  { countryId: "ki", languageCode: "tvl", localeTag: "tvl", direction: "ltr", name: "Tuvaluan", nativeName: "Te Ggana Tuuvalu", category: "regional", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "ki", languageCode: "mh", localeTag: "mh", direction: "ltr", name: "Marshallese", nativeName: "Kajin M̧ajeļ", category: "regional", reviewStatus: "pending", note: "Validate demand" },
  { countryId: "fm", languageCode: "en", localeTag: "en-FM", direction: "ltr", name: "English", nativeName: "English", category: "official", reviewStatus: "pending", note: "Federal official language" },
  { countryId: "fm", languageCode: "chk", localeTag: "chk", direction: "ltr", name: "Chuukese", nativeName: "Chuukese", category: "regional", reviewStatus: "pending", note: "One of the major local languages" },
  { countryId: "fm", languageCode: "pon", localeTag: "pon", direction: "ltr", name: "Pohnpeian", nativeName: "Pohnpeian", category: "regional", reviewStatus: "pending", note: "One of the major local languages" },
  { countryId: "fm", languageCode: "kos", localeTag: "kos", direction: "ltr", name: "Kosraean", nativeName: "Kosraean", category: "regional", reviewStatus: "pending", note: "Yapese also important; allow broader language search" },
] as const

const LANGUAGE_FALLBACKS: readonly { code: string; name: string; nativeName: string | null }[] = [
  { code: "en", name: "English", nativeName: "English" },
]

/** Returns the four curated recommendations for a country, preserving rank/order. */
export function listCountryLanguages(countryId: string): CountryLanguageRecommendation[] {
  const id = countryId.trim().toLowerCase()
  return COUNTRY_LANGUAGE_RECOMMENDATIONS.filter((entry) => entry.countryId === id)
}

/** Global deduplicated language list; locale variants remain available per country. */
export function listGlobalLanguages(): { code: string; name: string; nativeName: string | null }[] {
  const entries = new Map<string, { code: string; name: string; nativeName: string | null }>()
  for (const item of COUNTRY_LANGUAGE_RECOMMENDATIONS) {
    if (!entries.has(item.languageCode)) {
      entries.set(item.languageCode, {
        code: item.languageCode,
        name: item.name.replace(/\s*\([^)]*\)$/, ""),
        nativeName: item.nativeName,
      })
    }
  }
  for (const fallback of LANGUAGE_FALLBACKS) {
    if (!entries.has(fallback.code)) entries.set(fallback.code, fallback)
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** English remains available globally as a safe initial/fallback interface locale. */
export function listAvailableCountryLanguages(countryId: string) {
  const recommendations = listCountryLanguages(countryId)
  const english = recommendations.some((item) => item.languageCode === "en")
    ? []
    : [{ countryId: countryId.trim().toLowerCase(), languageCode: "en", localeTag: "en", direction: "ltr", name: "English", nativeName: "English", category: "widely-used" as const, reviewStatus: "approved" as const, note: "Global fallback interface language; not counted among the four local recommendations." }]
  return [...english, ...recommendations]
}
