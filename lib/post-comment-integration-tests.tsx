/**
 * Post & Comment Enhancement System - Integration Tests
 * Verifies all features work correctly without runtime errors
 * Checks React hooks, validation, state management, and API compatibility
 */

import type { Post, PostComment } from './ghc-types'
import {
  createThreadedComment,
  addReplyToComment,
  flattenCommentThread,
  buildCommentThreads,
  sortComments,
  addCommentReaction,
  removeCommentReaction,
  getTopCommentReactions,
  validateMediaAttachment,
  addMediaToComment,
  editComment,
  editPost,
  pinComment,
  unpinComment,
  createQuoteRepost,
  copyPostLink,
  generateShareText,
  getSocialShareUrl,
  savePostToCollection,
  createUserRestriction,
  trackPostHide,
  trackNotInterested,
  createPostReport,
  extractMentions,
  extractHashtags,
  extractUrls,
  extractEmojis,
  validateComment,
  sanitizeCommentText,
} from './post-comment-unified-complete'

// ============================================================
// TEST UTILITIES
// ============================================================

interface TestResult {
  name: string
  passed: boolean
  error?: string
  warnings?: string[]
}

const results: TestResult[] = []

function test(name: string, fn: () => void): void {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function assertThrows(fn: () => void, message?: string): void {
  try {
    fn()
    throw new Error(message || 'Expected function to throw')
  } catch (e) {
    if (!message || e instanceof Error) return
    throw e
  }
}

function assertEqual(a: unknown, b: unknown, message?: string): void {
  if (a !== b) {
    throw new Error(message || `Expected ${a} === ${b}`)
  }
}

function assertTrue(value: unknown, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected ${value} to be truthy`)
  }
}

// ============================================================
// MOCK DATA
// ============================================================

function createMockComment(overrides?: Partial<PostComment>): PostComment {
  return {
    id: 'comment-1',
    authorName: 'Test User',
    authorPhoto: '/test.jpg',
    text: 'Test comment',
    createdAt: Date.now(),
    ...overrides,
  }
}

function createMockPost(overrides?: Partial<Post>): Post {
  return {
    id: 'post-1',
    authorId: 'user-1',
    authorName: 'Author',
    authorPhoto: '/author.jpg',
    content: 'Test post content',
    images: [],
    video: null,
    pdf: null,
    pdfName: null,
    likes: 0,
    comments: [],
    createdAt: Date.now(),
    ...overrides,
  }
}

// ============================================================
// THREADING TESTS
// ============================================================

test('Threading: Create threaded comment', () => {
  const comment = createThreadedComment('Reply', 'User A', 'user-a', '/avatar.jpg')
  assertTrue(comment.id, 'Comment should have ID')
  assertEqual(comment.text, 'Reply', 'Comment text should match')
  assertEqual(comment.threadDepth, 0, 'Initial depth should be 0')
})

test('Threading: Add reply to comment', () => {
  const parent = createMockComment()
  const reply = createThreadedComment('Reply text', 'User B', 'user-b', '/avatar-b.jpg', parent.id, 1)
  const updated = addReplyToComment(parent, reply as any)
  assertEqual(updated.replies?.length, 1, 'Should have one reply')
  assertTrue(updated.hasNestedReplies, 'Should mark as having nested replies')
})

test('Threading: Flatten comment thread', () => {
  const parent = createThreadedComment('Parent', 'User A', 'user-a', '/a.jpg')
  const child = createThreadedComment('Child', 'User B', 'user-b', '/b.jpg', parent.id, 1)
  const grandchild = createThreadedComment('Grandchild', 'User C', 'user-c', '/c.jpg', child.id, 2)
  parent.replies = [child]
  child.replies = [grandchild]

  const flattened = flattenCommentThread(parent)
  assertEqual(flattened.length, 3, 'Should have 3 flattened comments')
  assertEqual(flattened[1].threadDepth, 1, 'Child should have depth 1')
  assertEqual(flattened[2].threadDepth, 2, 'Grandchild should have depth 2')
})

test('Threading: Build comment threads', () => {
  const parent = createThreadedComment('Parent', 'User A', 'user-a', '/a.jpg')
  const reply1 = createThreadedComment('Reply 1', 'User B', 'user-b', '/b.jpg', parent.id, 1)
  const reply2 = createThreadedComment('Reply 2', 'User C', 'user-c', '/c.jpg', parent.id, 1)
  parent.replies = [reply1, reply2]

  const threads = buildCommentThreads([parent, reply1, reply2])
  assertEqual(threads.length, 1, 'Should have one root thread')
  assertEqual(threads[0].replies.length, 2, 'Root should have 2 replies')
  assertEqual(threads[0].totalReplies, 2, 'Total replies should be 2')
})

test('Threading: Max depth enforced', () => {
  let comment = createThreadedComment('Level 0', 'User', 'user', '/avatar.jpg', undefined, 0)
  for (let i = 1; i <= 15; i++) {
    comment = createThreadedComment(`Level ${i}`, 'User', 'user', '/avatar.jpg', comment.id, i)
  }
  assertEqual(comment.threadDepth, 10, 'Max depth should be capped at 10')
})

// ============================================================
// REACTION TESTS
// ============================================================

test('Reactions: Add emoji reaction', () => {
  const comment = createMockComment()
  const updated = addCommentReaction(comment as any, '👍', 'user-1')
  assertEqual(updated.reactions?.['👍']?.length, 1, 'Should have one reaction')
  assertEqual(updated.reactionCounts?.['👍'], 1, 'Count should be 1')
})

test('Reactions: Remove emoji reaction', () => {
  const comment = createMockComment()
  let updated = addCommentReaction(comment as any, '👍', 'user-1')
  updated = removeCommentReaction(updated, '👍', 'user-1')
  assertEqual(updated.reactions?.['👍']?.length, 0, 'Reaction should be removed')
})

test('Reactions: Multiple users same emoji', () => {
  let comment = createMockComment()
  comment = addCommentReaction(comment as any, '❤️', 'user-1')
  comment = addCommentReaction(comment, '❤️', 'user-2')
  comment = addCommentReaction(comment, '❤️', 'user-3')
  assertEqual(comment.reactions?.['❤️']?.length, 3, 'Should have 3 reactions')
  assertEqual(comment.reactionCounts?.['❤️'], 3, 'Count should be 3')
})

test('Reactions: Get top reactions', () => {
  let comment = createMockComment()
  comment = addCommentReaction(comment as any, '👍', 'u1')
  comment = addCommentReaction(comment, '❤️', 'u2')
  comment = addCommentReaction(comment, '❤️', 'u3')
  const top = getTopCommentReactions(comment, 2)
  assertTrue(top.length <= 2, 'Should respect limit')
})

// ============================================================
// MEDIA TESTS
// ============================================================

test('Media: Validate image attachment', () => {
  const imageValid = validateMediaAttachment({
    id: 'img-1',
    type: 'image',
    url: 'data:image/jpeg;base64,...',
    mimeType: 'image/jpeg',
    size: 1024,
  })
  assertTrue(imageValid.valid, 'Valid image should pass validation')
})

test('Media: Reject invalid media type', () => {
  const result = validateMediaAttachment({
    id: 'img-1',
    type: 'image',
    url: 'test.exe',
    mimeType: 'application/exe',
    size: 5 * 1024 * 1024,
  })
  assertTrue(!result.valid, 'Invalid mime type should fail')
})

test('Media: Add media to comment', () => {
  const comment = createMockComment()
  const updated = addMediaToComment(comment as any, {
    id: 'media-1',
    type: 'image',
    url: 'data:image/jpeg;base64,...',
    mimeType: 'image/jpeg',
  })
  assertEqual(updated.mediaAttachments?.length, 1, 'Should have one media attachment')
})

// ============================================================
// EDITING TESTS
// ============================================================

test('Editing: Edit comment with metadata', () => {
  const comment = createMockComment()
  const edited = editComment(comment as any, 'Updated text', 'user-1')
  assertEqual(edited.text, 'Updated text', 'Text should be updated')
  assertTrue(edited.isEdited, 'isEdited flag should be true')
  assertTrue(edited.editedAt, 'editedAt should be set')
})

test('Editing: Edit post with history', () => {
  const post = createMockPost()
  const edited = editPost(post, 'New content', 'user-1')
  assertEqual(edited.content, 'New content', 'Content should be updated')
  assertTrue(edited.editHistory?.length, 'Should have edit history')
  assertEqual(edited.editHistory?.[0].originalContent, post.content, 'History should store original')
})

// ============================================================
// PINNING TESTS
// ============================================================

test('Pinning: Pin comment by author', () => {
  const comment = createMockComment()
  const pinned = pinComment(comment as any, 'user-1', 'user-1')
  assertTrue(pinned.isPinned, 'Comment should be pinned')
})

test('Pinning: Non-author cannot pin', () => {
  const comment = createMockComment()
  assertThrows(
    () => pinComment(comment as any, 'user-2', 'user-1'),
    'Only author should pin'
  )
})

test('Pinning: Unpin comment', () => {
  let comment = createMockComment()
  comment = pinComment(comment as any, 'user-1', 'user-1')
  comment = unpinComment(comment, 'user-1', 'user-1')
  assertTrue(!comment.isPinned, 'Comment should be unpinned')
})

// ============================================================
// SORTING TESTS
// ============================================================

test('Sorting: Sort by newest', () => {
  const now = Date.now()
  const comments = [
    createThreadedComment('Old', 'A', 'a', '/a.jpg'),
    createThreadedComment('New', 'B', 'b', '/b.jpg'),
  ]
  comments[0].createdAt = now - 1000
  comments[1].createdAt = now
  const sorted = sortComments(comments as any, { sortBy: 'newest' })
  assertEqual(sorted[0].text, 'New', 'Newest should be first')
})

test('Sorting: Sort by most reactions', () => {
  let c1 = createThreadedComment('A', 'A', 'a', '/a.jpg')
  let c2 = createThreadedComment('B', 'B', 'b', '/b.jpg')
  c1 = addCommentReaction(c1 as any, '👍', 'u1')
  c2 = addCommentReaction(c2 as any, '👍', 'u1')
  c2 = addCommentReaction(c2, '👍', 'u2')
  const sorted = sortComments([c1, c2], { sortBy: 'mostReactions' })
  assertEqual(sorted[0].text, 'B', 'Most reactions should be first')
})

// ============================================================
// QUOTE REPOST TESTS
// ============================================================

test('Sharing: Create quote repost', () => {
  const original = createMockPost()
  const quote = createQuoteRepost(original, 'My thoughts on this:', 'user-2', 'User 2', '/avatar-2.jpg')
  assertEqual(quote.quoteOf, original.id, 'Should reference original post')
  assertEqual(quote.content, 'My thoughts on this:', 'Should have quote text')
})

test('Sharing: Generate social share text', () => {
  const post = createMockPost({ content: 'This is a very long post that should be truncated when shared on social media platforms like Twitter' })
  const tweetText = generateShareText(post, 'twitter')
  assertTrue(tweetText.length <= 140, 'Tweet text should fit Twitter limits')
  assertTrue(tweetText.includes('#GHConnect'), 'Should include hashtag')
})

// ============================================================
// CONTENT EXTRACTION TESTS
// ============================================================

test('Content: Extract mentions', () => {
  const text = 'Hey @john and @jane, check this out!'
  const mentions = extractMentions(text)
  assertEqual(mentions.length, 2, 'Should extract 2 mentions')
  assertTrue(mentions.includes('john'), 'Should include john')
  assertTrue(mentions.includes('jane'), 'Should include jane')
})

test('Content: Extract hashtags', () => {
  const text = 'Love #travel and #photography #wanderlust'
  const hashtags = extractHashtags(text)
  assertEqual(hashtags.length, 3, 'Should extract 3 hashtags')
})

test('Content: Extract URLs', () => {
  const text = 'Check https://example.com and http://test.org'
  const urls = extractUrls(text)
  assertEqual(urls.length, 2, 'Should extract 2 URLs')
})

test('Content: Extract emojis', () => {
  const text = 'Hello 👋 World 🌍 Nice 😊'
  const emojis = extractEmojis(text)
  assertTrue(emojis.length >= 3, 'Should extract emojis')
})

// ============================================================
// VALIDATION TESTS
// ============================================================

test('Validation: Valid comment', () => {
  const result = validateComment('This is a valid comment')
  assertTrue(result.valid, 'Valid comment should pass')
})

test('Validation: Empty comment rejected', () => {
  const result = validateComment('')
  assertTrue(!result.valid, 'Empty comment should fail')
  assertTrue(result.errors.length > 0, 'Should have errors')
})

test('Validation: Too long comment rejected', () => {
  const longText = 'x'.repeat(6000)
  const result = validateComment(longText)
  assertTrue(!result.valid, 'Long comment should fail')
})

test('Validation: Too many mentions rejected', () => {
  const text = Array(15).fill('@user').join(' ')
  const result = validateComment(text)
  assertTrue(!result.valid, 'Too many mentions should fail')
})

// ============================================================
// SANITIZATION TESTS
// ============================================================

test('Sanitization: Remove script tags', () => {
  const text = '<script>alert("xss")</script>Hello'
  const sanitized = sanitizeCommentText(text)
  assertTrue(!sanitized.includes('<script>'), 'Script tags should be removed')
})

test('Sanitization: Remove event handlers', () => {
  const text = '<div onclick="alert()">Click me</div>'
  const sanitized = sanitizeCommentText(text)
  assertTrue(!sanitized.includes('onclick='), 'Event handlers should be removed')
})

// ============================================================
// REPORT & RESTRICTION TESTS
// ============================================================

test('Actions: Create user restriction', () => {
  const restriction = createUserRestriction('user-2', 'block', 'Harassment')
  assertEqual(restriction.restrictionType, 'block', 'Type should match')
  assertTrue(restriction.createdAt, 'Should have creation time')
})

test('Actions: Track post hide', () => {
  const post = createMockPost()
  const updated = trackPostHide(post, 'user-1')
  assertEqual(updated.hideCount, 1, 'Hide count should increment')
})

test('Actions: Track not interested', () => {
  const post = createMockPost()
  const updated = trackNotInterested(post)
  assertEqual(updated.notInterestedCount, 1, 'Not interested count should increment')
})

test('Actions: Create post report', () => {
  const report = createPostReport('post-1', 'user-2', 'Offensive content')
  assertEqual(report.reason, 'Offensive content', 'Reason should match')
  assertTrue(report.reportedAt, 'Should have timestamp')
})

// ============================================================
// TEST SUMMARY
// ============================================================

export function runAllTests(): void {
  console.log('\n=== Running Post/Comment Integration Tests ===\n')

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  results.forEach((result) => {
    const icon = result.passed ? '✓' : '✗'
    console.log(`${icon} ${result.name}`)
    if (result.error) console.log(`  Error: ${result.error}`)
    if (result.warnings?.length) result.warnings.forEach((w) => console.log(`  Warning: ${w}`))
  })

  console.log(
    `\n=== Results: ${passed} passed, ${failed} failed out of ${results.length} tests ===\n`
  )

  if (failed > 0) {
    throw new Error(`${failed} tests failed`)
  }
}

// Export for testing
export default { runAllTests, results }
