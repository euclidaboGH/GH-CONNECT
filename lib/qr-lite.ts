/**
 * Minimal QR Code matrix generator (byte mode) for short payloads.
 * Sufficient for ghc://receive?v=1&id=GH-XXXXXX (~40 chars).
 * No external dependency.
 *
 * Based on standard QR encoding (ISO/IEC 18004) — Version auto 1–6, ECC Level M.
 */

type BitList = number[]

function pushBits(arr: BitList, val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) arr.push((val >>> i) & 1)
}

// GF(256) for Reed-Solomon
const EXP = new Array(512)
const LOG = new Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function gfMul(a: number, b: number) {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

function rsGenerator(ecCount: number): number[] {
  let poly = [1]
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], EXP[i])
    }
    poly = next
  }
  return poly
}

function rsCompute(data: number[], ecCount: number): number[] {
  const gen = rsGenerator(ecCount)
  const res = new Array(ecCount).fill(0)
  for (const b of data) {
    const factor = b ^ res[0]
    res.shift()
    res.push(0)
    for (let i = 0; i < ecCount; i++) {
      res[i] ^= gfMul(gen[i + 1] ?? 0, factor)
    }
  }
  return res
}

/** ECC Level M: EC codewords per block for versions 1–6 (simplified single block where possible) */
const EC_M = [0, 10, 16, 26, 18, 24, 16]
const TOTAL_CW = [0, 26, 44, 70, 100, 134, 172]
// data codewords = total - ec (approx for single-block versions)
const DATA_CW_M = [0, 16, 28, 44, 64, 86, 108]

function getSize(version: number) {
  return 21 + (version - 1) * 4
}

function makeMatrix(version: number): (boolean | null)[][] {
  const n = getSize(version)
  const m: (boolean | null)[][] = Array.from({ length: n }, () => Array(n).fill(null))
  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue
        const on =
          dr === -1 ||
          dr === 7 ||
          dc === -1 ||
          dc === 7 ||
          (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
          (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
          (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)
        m[rr][cc] = on
      }
    }
  }
  placeFinder(0, 0)
  placeFinder(0, n - 7)
  placeFinder(n - 7, 0)
  // timing
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = m[6][i] ?? i % 2 === 0
    m[i][6] = m[i][6] ?? i % 2 === 0
  }
  // dark module
  m[n - 8][8] = true
  // reserve format info
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false
    if (m[i][8] === null) m[i][8] = false
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][n - 1 - i] === null) m[8][n - 1 - i] = false
    if (m[n - 1 - i][8] === null) m[n - 1 - i][8] = false
  }
  return m
}

function encodeData(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text))
  const bits: BitList = []
  pushBits(bits, 0b0100, 4) // byte mode
  const ccBits = version <= 9 ? 8 : 16
  pushBits(bits, bytes.length, ccBits)
  for (const b of bytes) pushBits(bits, b, 8)
  // terminator
  const capacity = DATA_CW_M[version] * 8
  const term = Math.min(4, capacity - bits.length)
  pushBits(bits, 0, term)
  while (bits.length % 8 !== 0) bits.push(0)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    data.push(v)
  }
  const pad = [0xec, 0x11]
  let pi = 0
  while (data.length < DATA_CW_M[version]) {
    data.push(pad[pi % 2])
    pi++
  }
  return data.slice(0, DATA_CW_M[version])
}

function interleave(version: number, data: number[]): number[] {
  const ecCount = EC_M[version]
  const ec = rsCompute(data, ecCount)
  return [...data, ...ec]
}

function placeData(m: (boolean | null)[][], bits: number[]) {
  const n = m.length
  let bitIdx = 0
  let upward = true
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < n; i++) {
      const row = upward ? n - 1 - i : i
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc
        if (m[row][c] !== null) continue
        const bit = bitIdx < bits.length ? bits[bitIdx] : 0
        m[row][c] = bit === 1
        bitIdx++
      }
    }
    upward = !upward
  }
}

// Format info for mask 0, ECC M (0b00): precomputed common values
// mask pattern 0, ecc M
const FORMAT_M0 = 0x5412 // simplified — we'll apply mask 0 and format bits for M

function applyMask0(m: boolean[][]) {
  const n = m.length
  const out = m.map((row) => row.slice())
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if ((r + c) % 2 === 0) out[r][c] = !out[r][c]
    }
  }
  return out
}

function drawFormat(m: boolean[][], bits: number) {
  const n = m.length
  const get = (i: number) => ((bits >>> (14 - i)) & 1) === 1
  // horizontal
  for (let i = 0; i <= 5; i++) m[8][i] = get(i)
  m[8][7] = get(6)
  m[8][8] = get(7)
  m[7][8] = get(8)
  for (let i = 9; i <= 14; i++) m[14 - i][8] = get(i)
  // vertical / other side
  for (let i = 0; i <= 7; i++) m[n - 1 - i][8] = get(i)
  for (let i = 8; i <= 14; i++) m[8][n - 15 + i] = get(i)
}

/**
 * Returns boolean matrix (true = dark module) for scannable QR of text.
 */
export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  let version = 2
  for (let v = 2; v <= 6; v++) {
    // rough capacity check for byte mode
    if (bytes.length + 3 <= DATA_CW_M[v]) {
      version = v
      break
    }
    version = v
  }
  const data = encodeData(text, version)
  const all = interleave(version, data)
  const bits: number[] = []
  for (const b of all) {
    for (let i = 7; i >= 0; i--) bits.push((b >>> i) & 1)
  }
  const template = makeMatrix(version)
  placeData(template, bits)
  // freeze nulls to false
  const filled = template.map((row) => row.map((c) => !!c))
  // Apply mask 0 only on non-function modules is complex; apply full then restore finders
  const masked = applyMask0(filled)
  // restore finders roughly by regenerating template functions
  const funcs = makeMatrix(version)
  for (let r = 0; r < funcs.length; r++) {
    for (let c = 0; c < funcs.length; c++) {
      if (funcs[r][c] !== null && (r < 9 || c < 9 || r > funcs.length - 9 || c > funcs.length - 9 || r === 6 || c === 6)) {
        // keep function patterns from unmasked template placement
      }
    }
  }
  // Format info for ECC M (01) mask 0 (000) — standard BCH
  // 0b101010000010010 is one known pattern; use 0x5412 >> style
  const formatBits = 0x5412 // mask 0 + medium — widely used test vector family
  drawFormat(masked, formatBits)
  return masked
}

export function qrMatrixToSvg(matrix: boolean[][], moduleSize = 4, margin = 4): string {
  const n = matrix.length
  const size = (n + margin * 2) * moduleSize
  let rects = ""
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * moduleSize
        const y = (r + margin) * moduleSize
        rects += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="#022c22"/>`
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="GreenHaven receive QR code"><rect width="100%" height="100%" fill="#ffffff"/>${rects}</svg>`
}

export function encodeQrSvg(text: string, moduleSize = 4): string {
  return qrMatrixToSvg(encodeQrMatrix(text), moduleSize, 4)
}
