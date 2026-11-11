/**
 * Parse the repository's deliberately restricted prebuild command format.
 * Only direct Node.js script invocations are accepted; no shell is involved.
 */
export function parseNodeScriptCommands(raw, { root, existsSync }) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Prebuild check list is empty or missing.')
  }

  const commands = raw.split(/\s*&&\s*/)
  const parsed = []

  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index].trim()
    if (!command) throw new Error(`Prebuild command ${index + 1} is empty.`)
    // Shell syntax is intentionally unsupported. This keeps execution shell-free.
    if (/[;|`$<>\n\r]/.test(command) || command.includes('$(')) {
      throw new Error(`Prebuild command ${index + 1} contains unsupported shell syntax.`)
    }

    const tokens = command.split(/\s+/)
    if (tokens.shift() !== 'node') {
      throw new Error(`Prebuild command ${index + 1} must invoke node directly: ${command}`)
    }
    const scriptIndex = tokens.findIndex((token) => token.startsWith('scripts/'))
    const script = scriptIndex >= 0 ? tokens[scriptIndex] : ''
    if (!/^scripts\/[A-Za-z0-9._/-]+\.mjs$/.test(script) || script.split('/').includes('..')) {
      throw new Error(`Prebuild command ${index + 1} has no safe scripts/*.mjs target: ${command}`)
    }
    if (existsSync && !existsSync(`${root}/${script}`)) {
      throw new Error(`Prebuild command ${index + 1} references missing script: ${script}`)
    }
    parsed.push({ command, args: tokens, script })
  }
  return parsed
}

export function hasNodeScript(raw, script, options) {
  try {
    return parseNodeScriptCommands(raw, options).some((item) => item.script === script)
  } catch {
    return false
  }
}
