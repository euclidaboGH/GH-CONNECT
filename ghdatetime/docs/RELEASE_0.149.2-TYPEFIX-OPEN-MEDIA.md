# 0.149.2 — Type fix onOpenMedia

`EnhancedPostCard` passed `urls: { url, kind }[]` but the prop typed `urls` as `string[]`.

Updated payload type to:

```ts
urls: Array<string | { url: string; kind?: "image" | "video"; alt?: string }>
```

Aligns with `MediaLightbox` gallery items. Video open uses `{ url, kind: "video" }`.

Carries 0.149.0 media tools + 0.149.1 message input fix.
