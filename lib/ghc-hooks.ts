# Optimized Custom Hooks Library

This file consolidates frequently-used hook patterns to reduce duplication and improve performance.

## Usage
Import specific hooks as needed instead of spreading logic across components.

### Examples
\`\`\`tsx
import { useFilteredList, useDerivedState, usePaginatedList } from '@/lib/ghc-hooks'

// Use memoized filtered data
const filtered = useFilteredList(candidates, searchTerm, (c) => c.name.includes(searchTerm))

// Use derived state instead of separate useState
const [unreadCount, setUnreadCount] = useDerivedState(conversations, (c) => c.filter(x => !x.unread).length)

// Use pagination for large lists
const { items, page, hasMore, next } = usePaginatedList(posts, 20)
\`\`\`
