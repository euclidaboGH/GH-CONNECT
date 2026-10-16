# Build fix — startConversation arity

## Error
`profile-story-section.tsx`: Expected 3 arguments, but got 2.

## Cause
`GHCContextType.startConversation` is `(userId, userName, userPhoto) => Promise<string | null>`.
Moment reply only passed ownerId + name.

## Fix
Pass `viewing.photo || ""` as the third argument (StoryItem.photo is optional).
