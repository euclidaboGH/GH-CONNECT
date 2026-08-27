'use client'

import { useCallback } from 'react'
import { validation } from '@/lib/validation'
import { messageLimiter, postLimiter, swipeLimiter, reportLimiter, spamDetection } from '@/lib/rate-limiter'
import { analytics } from '@/lib/analytics'
import { notificationSystem } from '@/lib/notifications'
import { offlineSupport } from '@/lib/offline'
import { searchUtils, applyFilters, type FilterCriteria } from '@/lib/search-utils'
import { a11y } from '@/lib/accessibility'
import type { Candidate, Post } from '@/lib/ghc-types'

export function useImprovements() {
  // Validation utilities
  const validateEmail = useCallback((email: string) => validation.isValidEmail(email), [])
  const validateName = useCallback((name: string) => validation.isValidName(name), [])
  const validateBio = useCallback((bio: string) => validation.isValidBio(bio), [])
  const validatePhone = useCallback((phone: string) => validation.isValidPhone(phone), [])
  const validateAge = useCallback((age: number) => validation.isValidAge(age), [])
  const validateUrl = useCallback((url: string) => validation.isValidUrl(url), [])
  const validateImage = useCallback((data: string) => validation.isValidBase64Image(data), [])
  const validatePassword = useCallback((password: string) => validation.isStrongPassword(password), [])
  
  const sanitizeText = useCallback((text: string) => validation.sanitizeText(text), [])
  const cleanDisplayName = useCallback((name: string) => validation.cleanDisplayName(name), [])
  const cleanBio = useCallback((bio: string) => validation.cleanBio(bio), [])
  const getPasswordStrength = useCallback((password: string) => validation.getPasswordStrength(password), [])

  // Rate limiting utilities
  const checkMessageLimit = useCallback((conversationId: string) => messageLimiter.isAllowed(`msg_${conversationId}`), [])
  const checkPostLimit = useCallback((userId: string) => postLimiter.isAllowed(`post_${userId}`), [])
  const checkSwipeLimit = useCallback((userId: string) => swipeLimiter.isAllowed(`swipe_${userId}`), [])
  const checkReportLimit = useCallback((userId: string) => reportLimiter.isAllowed(`report_${userId}`), [])
  const getMessageRateLimitTime = useCallback((conversationId: string) => messageLimiter.getRemainingTime(`msg_${conversationId}`), [])

  // Spam detection utilities
  const detectSpam = useCallback((text: string) => spamDetection.detectSpamText(text), [])
  const isSpammyProfile = useCallback((bio: string, name: string) => spamDetection.isSpammyProfile(bio, name), [])

  // Analytics utilities
  const trackEvent = useCallback((type: any, data?: Record<string, any>, userId?: string) => {
    analytics.trackEvent(type, data, userId)
  }, [])
  const getAnalyticsEvents = useCallback(() => analytics.getEvents(), [])
  const getSessionAnalytics = useCallback(() => analytics.getSessionEvents(), [])
  const getAnalyticsStats = useCallback(() => analytics.getEventStats(), [])

  // Notification utilities
  const createNotification = useCallback((type: any, title: string, message: string, icon: string, data?: Record<string, any>) => {
    return notificationSystem.addNotification(type, title, message, icon, data)
  }, [])
  const getNotifications = useCallback(() => notificationSystem.getNotifications(), [])
  const getUnreadNotifications = useCallback(() => notificationSystem.getUnreadNotifications(), [])
  const getUnreadCount = useCallback(() => notificationSystem.getUnreadCount(), [])
  const markNotificationRead = useCallback((notifId: string) => notificationSystem.markAsRead(notifId), [])
  const markAllNotificationsRead = useCallback(() => notificationSystem.markAllAsRead(), [])
  const deleteNotification = useCallback((notifId: string) => notificationSystem.deleteNotification(notifId), [])
  const requestNotificationPermission = useCallback(() => notificationSystem.requestPermission(), [])

  // Offline support utilities
  const isOnline = useCallback(() => offlineSupport.isOnline(), [])
  const queueAction = useCallback((action: string, data: any) => offlineSupport.queueAction(action, data), [])
  const getPendingActions = useCallback(() => offlineSupport.getPendingActions(), [])
  const markActionSynced = useCallback((actionId: string) => offlineSupport.markSynced(actionId), [])
  const clearOfflineQueue = useCallback(() => offlineSupport.clearQueue(), [])
  const getCachedData = useCallback((key: string) => offlineSupport.getCachedData(key), [])
  const setCachedData = useCallback((key: string, data: any) => offlineSupport.setCachedData(key, data), [])
  const setupOfflineListeners = useCallback((onOnline: () => void, onOffline: () => void) => {
    return offlineSupport.setupListeners(onOnline, onOffline)
  }, [])

  // Search utilities
  const searchCandidates = useCallback((candidates: Candidate[], query: string) => {
    return searchUtils.searchCandidates(candidates, query)
  }, [])
  const filterCandidatesByAge = useCallback((candidates: Candidate[], minAge: number, maxAge: number) => {
    return searchUtils.filterByAge(candidates, minAge, maxAge)
  }, [])
  const filterCandidatesByInterests = useCallback((candidates: Candidate[], userInterests: string[]) => {
    return searchUtils.filterByInterests(candidates, userInterests)
  }, [])
  const rankCandidatesByInterests = useCallback((candidates: Candidate[], userInterests: string[]) => {
    return searchUtils.rankByInterestMatch(candidates, userInterests)
  }, [])
  const searchPosts = useCallback((posts: Post[], query: string) => {
    return searchUtils.searchPosts(posts, query)
  }, [])
  const sortPostsByDate = useCallback((posts: Post[], order: 'asc' | 'desc' = 'desc') => {
    return searchUtils.sortPostsByDate(posts, order)
  }, [])
  const sortPostsByPopularity = useCallback((posts: Post[]) => {
    return searchUtils.sortPostsByPopularity(posts)
  }, [])
  const getTrendingPosts = useCallback((posts: Post[], days: number = 7) => {
    return searchUtils.getTrendingPosts(posts, days)
  }, [])
  const applyFiltersToCandidate = useCallback((candidates: Candidate[], criteria: FilterCriteria) => {
    return applyFilters(candidates, criteria)
  }, [])

  // Accessibility utilities
  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    a11y.announce(message, politeness)
  }, [])
  const checkContrast = useCallback((color1: string, color2: string) => {
    return a11y.checkContrast(color1, color2)
  }, [])
  const createFocusTrap = useCallback((container: HTMLElement) => {
    return a11y.createFocusTrap(container)
  }, [])
  const prefersReducedMotion = useCallback(() => a11y.prefersReducedMotion(), [])
  const getPrefersColorScheme = useCallback(() => a11y.getPrefersColorScheme(), [])
  const setupKeyboardShortcut = useCallback((key: string, callback: () => void) => {
    return a11y.setupKeyboardShortcut(key, callback)
  }, [])

  return {
    // Validation
    validateEmail,
    validateName,
    validateBio,
    validatePhone,
    validateAge,
    validateUrl,
    validateImage,
    validatePassword,
    sanitizeText,
    cleanDisplayName,
    cleanBio,
    getPasswordStrength,

    // Rate limiting
    checkMessageLimit,
    checkPostLimit,
    checkSwipeLimit,
    checkReportLimit,
    getMessageRateLimitTime,

    // Spam detection
    detectSpam,
    isSpammyProfile,

    // Analytics
    trackEvent,
    getAnalyticsEvents,
    getSessionAnalytics,
    getAnalyticsStats,

    // Notifications
    createNotification,
    getNotifications,
    getUnreadNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    requestNotificationPermission,

    // Offline support
    isOnline,
    queueAction,
    getPendingActions,
    markActionSynced,
    clearOfflineQueue,
    getCachedData,
    setCachedData,
    setupOfflineListeners,

    // Search & filter
    searchCandidates,
    filterCandidatesByAge,
    filterCandidatesByInterests,
    rankCandidatesByInterests,
    searchPosts,
    sortPostsByDate,
    sortPostsByPopularity,
    getTrendingPosts,
    applyFiltersToCandidate,

    // Accessibility
    announce,
    checkContrast,
    createFocusTrap,
    prefersReducedMotion,
    getPrefersColorScheme,
    setupKeyboardShortcut,
  }
}
