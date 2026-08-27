"use client"

import { memo, useState } from "react"
import { Heart, MessageCircle, Share2, MoreVertical, Plus, Bookmark, Flag, Eye, ThumbsDown, Volume2, Slash, Video, FileText } from "lucide-react"
import type { Post, PostComment } from "@/lib/ghc-types"
import { timeAgo } from "@/lib/ghc-data"
import { PostMenu, CommentReactions, EnhancedComment, EnhancedPostContent, LinkPreview, QuoteRepost, ShareMenu } from "./feed-enhancements"
import { LazyImage } from "./lazy-image"
import { closeAllActionSheets } from "./action-sheet"

// Skeleton loader for posts
export function PostSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm animate-pulse">
      {/* Header skeleton */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gray-300"></div>
          <div className="space-y-1">
            <div className="h-3 w-24 bg-gray-300 rounded"></div>
            <div className="h-2 w-16 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="w-5 h-5 bg-gray-300 rounded"></div>
      </div>

      {/* Content skeleton */}
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-300 rounded w-full"></div>
        <div className="h-3 bg-gray-300 rounded w-5/6"></div>
        <div className="h-32 bg-gray-300 rounded mt-2"></div>
      </div>

      {/* Actions skeleton */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex justify-around">
        <div className="h-6 w-12 bg-gray-300 rounded"></div>
        <div className="h-6 w-12 bg-gray-300 rounded"></div>
        <div className="h-6 w-12 bg-gray-300 rounded"></div>
      </div>
    </div>
  )
}

// Individual post component with full enhancement features
interface PostCardProps {
  post: Post
  isLiked: boolean
  isBookmarked?: boolean
  isOwnPost?: boolean
  onLike: (postId: string) => void
  onComment: (postId: string) => void
  onShare?: (postId: string, platform: "twitter" | "facebook" | "linkedin" | "copy") => void
  onEdit?: (postId: string) => void
  onDelete?: (postId: string) => void
  onHidePost?: (postId: string) => void
  onNotInterested?: (postId: string) => void
  onReportPost?: (postId: string, reason: string) => void
  onMuteUser?: (userId: string) => void
  onBlockUser?: (userId: string) => void
  onBookmark?: (postId: string) => void
  onCopyLink?: (postId: string) => void
  onCommentReaction?: (postId: string, commentId: string, emoji: string) => void
  onRemoveCommentReaction?: (postId: string, commentId: string, emoji: string) => void
  onReplyComment?: (postId: string, commentId: string) => void
  onEditComment?: (postId: string, commentId: string) => void
  onDeleteComment?: (postId: string, commentId: string) => void
  onPinComment?: (postId: string, commentId: string) => void
  onFollowFromPost?: (userId: string) => void
  onUnfollowFromPost?: (userId: string) => void
  /** Open the public profile of the post author (feed only for other users) */
  onOpenProfile?: (userId: string) => void
  isCommentingPostId?: boolean
}

export const PostCard = memo(function PostCard({
  post,
  isLiked,
  isBookmarked,
  isOwnPost = false,
  onLike,
  onComment,
  onShare,
  onEdit,
  onDelete,
  onHidePost,
  onNotInterested,
  onReportPost,
  onMuteUser,
  onBlockUser,
  onBookmark,
  onCopyLink,
  onCommentReaction,
  onRemoveCommentReaction,
  onReplyComment,
  onEditComment,
  onDeleteComment,
  onPinComment,
  onFollowFromPost,
  onUnfollowFromPost,
  onOpenProfile,
  isCommentingPostId,
}: PostCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  // PostMenu should only show edit/delete for own posts, hide/report for others
  const handleMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(true)
  }

  return (
    <article className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-[0_4px_18px_rgba(15,23,42,0.05)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow">
      {/* Post header — avatar + name open public profile when provided */}
      <header className="px-4 py-3 border-b border-gray-100/80 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onOpenProfile?.(post.authorId)}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            aria-label={`View ${post.authorName}'s profile`}
            disabled={!onOpenProfile}
          >
            <LazyImage
              src={post.authorPhoto || `/avatars/${post.authorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`}
              alt={post.authorName}
              className="h-9 w-9 cursor-pointer rounded-full object-cover transition-opacity hover:opacity-80"
            />
          </button>
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onOpenProfile?.(post.authorId)}
              className="block max-w-full truncate text-left font-bold text-sm text-gray-900 hover:text-purple-700 focus-visible:outline-none focus-visible:underline"
              disabled={!onOpenProfile}
            >
              {post.authorName}
            </button>
            <p className="text-xs text-gray-500">
              {timeAgo(post.createdAt)}
              {post.isEdited && <span className="text-gray-400 ml-1">(edited)</span>}
            </p>
          </div>
        </div>
        {(isOwnPost || onHidePost || onReportPost) && (
          <button
            onClick={handleMenuOpen}
            className="text-gray-500 hover:text-gray-700 active:scale-90 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded-full p-1"
          >
            <MoreVertical size={16} />
          </button>
        )}
      </header>

      {/* Quote repost indicator */}
      {post.quoteOf && (
        <QuoteRepost
          originalPost={post}
          quoteText={post.content}
          onViewOriginal={() => console.log("View original")}
        />
      )}

      {/* Post content with mentions and hashtags */}
      <div className="px-4 py-4 space-y-3">
        <div className="text-[15px] leading-7 text-gray-800 break-words">
        <EnhancedPostContent
          content={post.content}
          onMentionClick={(userId) => onFollowFromPost?.(userId)}
          onHashtagClick={(hashtag) => console.log("Hashtag:", hashtag)}
          onLinkClick={(url) => window.open(url, "_blank")}
        />
        </div>

        {/* Link preview */}
        {post.linkPreview && (
          <LinkPreview
            title={post.linkPreview.title}
            description={post.linkPreview.description}
            image={post.linkPreview.image}
            domain={post.linkPreview.domain}
            url={post.linkPreview.url}
            onClick={() => window.open(post.linkPreview!.url, "_blank")}
          />
        )}

        {/* Images gallery */}
        {post.images.length > 0 && (
          <div className={`grid gap-1.5 rounded-xl overflow-hidden bg-gray-100 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {post.images.slice(0, 4).map((image, idx) => (
              <div
                key={idx}
                className={`relative bg-gray-200 cursor-pointer hover:opacity-90 transition-opacity ${post.images.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}
              >
                <LazyImage
                  src={image || `/avatars/post-${idx + 1}.svg`}
                  alt={`Post image ${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                {post.images.length > 4 && idx === 3 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold">+{post.images.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Video/PDF indicators */}
      {post.video && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <Video size={15} aria-hidden="true" />
          <span>Video attached</span>
        </div>
      )}
      {post.pdf && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <FileText size={15} aria-hidden="true" />
          <span>{post.pdfName || "Attached document"}</span>
        </div>
      )}
      </div>

      {/* Post stats */}
      {post.engagement && (
        <div className="px-4 py-2.5 bg-gray-50/70 border-t border-b border-gray-100 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>{post.likes} {post.likes === 1 ? "like" : "likes"}</span>
            <span>{post.comments.length} {post.comments.length === 1 ? "comment" : "comments"}</span>
            {post.engagement.shares && <span>{post.engagement.shares} shares</span>}
          </div>
        </div>
      )}

      {/* Engagement buttons */}
      <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center justify-around text-xs">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1 py-2 px-3 rounded-lg font-semibold transition-all active:scale-95 ${
            isLiked
              ? "text-pink-500 bg-pink-50"
              : "text-gray-600 hover:bg-pink-50 hover:text-pink-500"
          }`}
        >
          <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
          Like
        </button>

        <button
          onClick={() => onComment(post.id)}
          className={`flex items-center gap-1 py-2 px-3 rounded-lg font-semibold transition-all active:scale-95 text-gray-600 ${
            isCommentingPostId ? "bg-blue-50 text-blue-500" : "hover:bg-blue-50 hover:text-blue-500"
          }`}
        >
          <MessageCircle size={14} />
          Comment
        </button>

        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-1 py-2 px-3 rounded-lg font-semibold text-gray-600 hover:bg-purple-50 hover:text-purple-500 transition-all active:scale-95"
          >
            <Share2 size={14} />
            Share
          </button>
          {showShareMenu && (
            <ShareMenu
              postId={post.id}
              isOpen={showShareMenu}
              onShare={onShare || (() => {})}
              onClose={() => setShowShareMenu(false)}
            />
          )}
        </div>

        <button
          onClick={() => onBookmark?.(post.id)}
          className={`flex items-center gap-1 py-2 px-3 rounded-lg font-semibold transition-all active:scale-95 ${
            isBookmarked
              ? "text-blue-600 bg-blue-50"
              : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
          }`}
        >
          <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Comments section */}
      {post.comments && post.comments.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/70 max-h-52 overflow-y-auto space-y-2.5">
          {post.comments.slice(0, 3).map((comment) => (
            <EnhancedComment
              key={comment.id}
              comment={comment}
              onReply={(commentId) => onReplyComment?.(post.id, commentId)}
              onEdit={(commentId) => onEditComment?.(post.id, commentId)}
              onDelete={(commentId) => onDeleteComment?.(post.id, commentId)}
              onPin={(commentId) => onPinComment?.(post.id, commentId)}
              onAddReaction={(commentId, emoji) => onCommentReaction?.(post.id, commentId, emoji)}
              onRemoveReaction={(commentId, emoji) => onRemoveCommentReaction?.(post.id, commentId, emoji)}
            />
          ))}
          {post.comments.length > 3 && (
            <button className="text-xs text-blue-600 hover:underline">
              View all {post.comments.length} comments
            </button>
          )}
        </div>
      )}

      {/* Post Menu - ownership-aware */}
      <PostMenu
        post={post}
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onEdit={isOwnPost ? () => {
          onEdit?.(post.id)
          setShowMenu(false)
        } : undefined}
        onDelete={isOwnPost ? () => {
          onDelete?.(post.id)
          setShowMenu(false)
        } : undefined}
        onHide={!isOwnPost ? () => {
          onHidePost?.(post.id)
          setShowMenu(false)
        } : undefined}
        onNotInterested={!isOwnPost ? () => {
          onNotInterested?.(post.id)
          setShowMenu(false)
        } : undefined}
        onReport={!isOwnPost ? (reason) => {
          onReportPost?.(post.id, reason)
          setShowMenu(false)
        } : undefined}
        onMute={!isOwnPost ? () => {
          onMuteUser?.(post.authorId)
          setShowMenu(false)
        } : undefined}
        onBlock={!isOwnPost ? () => {
          onBlockUser?.(post.authorId)
          setShowMenu(false)
        } : undefined}
        onBookmark={() => {
          onBookmark?.(post.id)
          setShowMenu(false)
        }}
        onCopyLink={() => {
          onCopyLink?.(post.id)
          setShowMenu(false)
        }}
        isBookmarked={isBookmarked}
      />
    </article>
  )
})

// Mode filter chips
interface ModeFilterProps {
  currentMode: string
  selectedFilter: string
  onFilterChange: (filter: string) => void
}

export function ModeFilter({ currentMode, selectedFilter, onFilterChange }: ModeFilterProps) {
  const modes = [
    { id: "all", label: "All", emoji: "🌍" },
    { id: "dating", label: "Dating", emoji: "❤️", mode: "dating" },
    { id: "friendship", label: "Friendship", emoji: "👥", mode: "friendship" },
    { id: "networking", label: "Networking", emoji: "💼", mode: "networking" },
  ]

  // Get relevant filters based on current user mode
  const relevantModes = modes.filter((m) => m.id === "all" || m.mode === currentMode)

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide">
      {relevantModes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onFilterChange(mode.id)}
          className={`flex items-center gap-1 whitespace-nowrap py-1.5 px-3 rounded-full font-semibold text-xs transition-all active:scale-95 ${
            selectedFilter === mode.id
              ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-md"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <span>{mode.emoji}</span>
          {mode.label}
        </button>
      ))}
    </div>
  )
}

// Floating Create Post Button
interface FloatingCreateButtonProps {
  onClick: () => void
  isVisible: boolean
}

export function FloatingCreateButton({ onClick, isVisible }: FloatingCreateButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg hover:shadow-xl active:scale-90 transition-all flex items-center justify-center z-40 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
      }`}
      title="Create Post"
    >
      <Plus size={24} strokeWidth={3} />
    </button>
  )
}

// People recommendations widget
interface PeopleRecommendationProps {
  people: Array<{ id: string; name: string; photo: string }>
  onFollow: (userId: string) => void
}

export function PeopleRecommendation({ people, onFollow }: PeopleRecommendationProps) {
  if (people.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
      <p className="text-xs font-bold text-purple-900 mb-3 uppercase tracking-wide">
        People You May Know
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {people.map((person) => (
          <div key={person.id} className="flex-shrink-0 text-center">
            <div className="relative mb-2">
              <img
                src={person.photo || "/placeholder.svg"}
                alt={person.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-purple-300 mx-auto"
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src = "/placeholder.svg"
                }}
              />
            </div>
            <p className="text-xs font-bold text-gray-900 truncate w-14">{person.name}</p>
            <button
              onClick={() => onFollow(person.id)}
              className="text-xs text-pink-600 font-semibold mt-1 hover:text-pink-700 active:scale-90 transition-all"
            >
              Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
