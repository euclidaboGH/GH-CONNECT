# 0.149.1 — Build fix

Vercel compile error in `components/ghc/message-components.tsx`:

Broken line mashed `onChange` / `onFocus` / `onBlur` into invalid JSX.

Restored:

```tsx
onChange={(e) => onMessageChange(e.target.value)}
onFocus={() => emitTypingUi(true)}
onBlur={() => emitTypingUi(false)}
```

Carries all 0.149.0 mass media download + performance work.
