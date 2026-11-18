/** Minimal magic-byte checks. This is not malware scanning; it only rejects obvious MIME spoofing. */
export function evidenceSignatureMatches(mime, input) {
  const b = Buffer.from(input)
  if (mime === "image/jpeg") return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  if (mime === "image/png") return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  if (mime === "image/gif") return b.subarray(0, 3).toString() === "GIF"
  if (mime === "image/webp") return b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"
  if (mime === "image/avif") return b.length >= 12 && b.subarray(4, 8).toString() === "ftyp" && ["avif", "avis"].includes(b.subarray(8, 12).toString())
  if (["video/mp4", "video/quicktime", "audio/mp4"].includes(mime)) return b.length >= 12 && b.subarray(4, 8).toString() === "ftyp"
  if (mime === "video/webm" || mime === "audio/webm") return b.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
  if (mime === "application/pdf") return b.subarray(0, 5).toString() === "%PDF-"
  if (mime === "audio/wav") return b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WAVE"
  if (mime === "audio/ogg") return b.subarray(0, 4).toString() === "OggS"
  if (mime === "audio/flac") return b.subarray(0, 4).toString() === "fLaC"
  if (mime === "audio/mpeg") return b.subarray(0, 3).toString() === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  if (mime === "audio/aac") return b.length > 2 && b[0] === 0xff && (b[1] & 0xf6) === 0xf0
  return false
}
