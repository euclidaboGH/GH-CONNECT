/**
 * Phase 1 — first-run seller checklist. Pure; derived from fields the seller
 * has actually entered. No state is stored here.
 */
export interface SellerChecklistInput {
  title?: string | null
  description?: string | null
  category?: string | null
  mediaCount?: number
  price?: number | null
  availability?: number | null
  deliveryMode?: string | null
  kind?: string | null
}

export interface ChecklistItem { id: string; label: string; done: boolean; required: boolean }

export function sellerChecklist(input: SellerChecklistInput): ChecklistItem[] {
  const isProduct = (input.kind || "product") === "product"
  const len = (v?: string | null) => String(v ?? "").trim().length
  return [
    { id: "title", label: "Clear title (at least 5 characters)", done: len(input.title) >= 5, required: true },
    { id: "price", label: "Price greater than zero", done: Number(input.price) > 0, required: true },
    { id: "photo", label: "At least one photo", done: (input.mediaCount ?? 0) >= 1, required: isProduct },
    { id: "description", label: "Description (at least 30 characters)", done: len(input.description) >= 30, required: false },
    { id: "category", label: "Category chosen", done: len(input.category) > 0, required: false },
    { id: "stock", label: "Stock quantity set", done: !isProduct || Number(input.availability) > 0, required: isProduct },
    { id: "delivery", label: "Delivery method chosen", done: len(input.deliveryMode) > 0, required: false },
  ]
}

export function checklistProgress(items: readonly ChecklistItem[]): { done: number; total: number; requiredMet: boolean; percent: number } {
  const done = items.filter((i) => i.done).length
  const total = items.length
  return { done, total, requiredMet: items.filter((i) => i.required).every((i) => i.done), percent: total ? Math.round((done / total) * 100) : 0 }
}
