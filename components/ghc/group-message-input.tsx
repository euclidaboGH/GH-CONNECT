"use client"

import { useState, useRef, useCallback } from "react"
import { Send, Paperclip, Smile, Mic, X } from "lucide-react"
import type { Message } from "@/lib/ghc-types"

interface GroupMessageInputProps {
  onSendMessage: (text: string, replyToId?: string) => void
  onSendFile?: (file: File, replyToId?: string) => void
  onSendVoice?: (audioBlob: Blob, replyToId?: string) => void
  replyingTo?: Message & { senderName: string }
  onCancelReply?: () => void
  isLoading?: boolean
  isRecording?: boolean
  maxLength?: number
}

const VOICE_RECORD_TIMEOUT = 120000 // 2 minutes max

export function GroupMessageInput({
  onSendMessage,
  onSendFile,
  onSendVoice,
  replyingTo,
  onCancelReply,
  isLoading = false,
  isRecording: externalIsRecording = false,
  maxLength = 5000,
}: GroupMessageInputProps) {
  const [text, setText] = useState("")
  const [isRecording, setIsRecording] = useState(externalIsRecording)
  const [recordingTime, setRecordingTime] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout>()
  const recordingTimeoutRef = useRef<NodeJS.Timeout>()

  // Send message handler with Enter key support
  const handleSendMessage = useCallback(() => {
    if (!text.trim() || isLoading) return

    onSendMessage(text, replyingTo?.id)
    setText("")
  }, [text, isLoading, onSendMessage, replyingTo?.id])

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Check for CJK composition to avoid sending while composing
      if (e.nativeEvent.isComposing || e.keyCode === 229) return

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    },
    [handleSendMessage]
  )

  // Start voice recording
  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Timer for recording time
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Auto-stop after 2 minutes
      recordingTimeoutRef.current = setTimeout(() => {
        handleStopRecording()
      }, VOICE_RECORD_TIMEOUT)
    } catch (err) {
      console.error("[v0] Failed to start recording:", err)
    }
  }, [])

  // Stop voice recording
  const handleStopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return

    mediaRecorderRef.current.stop()
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
      onSendVoice?.(audioBlob, replyingTo?.id)
    }

    setIsRecording(false)
    setRecordingTime(0)

    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
  }, [onSendVoice, replyingTo?.id])

  // Cancel recording
  const handleCancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop())
      mediaRecorderRef.current = null
    }

    audioChunksRef.current = []
    setIsRecording(false)
    setRecordingTime(0)

    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current)
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current)
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files
      if (files && files[0]) {
        onSendFile?.(files[0], replyingTo?.id)
        e.currentTarget.value = "" // Reset input
      }
    },
    [onSendFile, replyingTo?.id]
  )

  // Format recording time as MM:SS
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="border-t border-border bg-background p-4">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground">
              Replying to <span className="font-semibold">{replyingTo.senderName}</span>
            </div>
            <div className="text-sm text-foreground truncate">{replyingTo.text}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 hover:bg-background rounded transition-colors flex-shrink-0"
            title="Cancel reply"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Recording state */}
      {isRecording && (
        <div className="mb-3 flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-medium">
              Recording {formatRecordingTime(recordingTime)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStopRecording}
              className="px-3 py-1 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
            <button
              onClick={handleCancelRecording}
              className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-lg hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-3">
        {/* File attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
          title="Attach file"
          disabled={isLoading || isRecording}
        >
          <Paperclip size={20} />
        </button>

        {/* Voice recording button */}
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
            isRecording
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title={isRecording ? "Stop recording" : "Start voice recording"}
          disabled={isLoading}
        >
          <Mic size={20} />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.substring(0, maxLength))}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            disabled={isLoading || isRecording}
            className="w-full max-h-24 px-3 py-2 rounded-lg bg-muted text-foreground placeholder-muted-foreground border border-border focus:border-primary focus:outline-none resize-none transition-colors disabled:opacity-50"
            style={{ minHeight: "40px" }}
          />
          {text.length > 0 && (
            <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
              {text.length}/{maxLength}
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSendMessage}
          disabled={!text.trim() || isLoading || isRecording}
          className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="Send message"
        >
          <Send size={20} />
        </button>

        {/* Emoji button */}
        <button
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
          title="Add emoji"
          disabled={isLoading || isRecording}
        >
          <Smile size={20} />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
      />

      {/* Character count info */}
      {text.length > maxLength * 0.8 && (
        <div className="text-xs text-muted-foreground mt-2">
          {Math.ceil((maxLength - text.length) / 10) * 10} characters remaining
        </div>
      )}
    </div>
  )
}
