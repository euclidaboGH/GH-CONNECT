#!/usr/bin/env node
/** Fail early when a TSX/JSX element repeats an attribute (e.g. duplicate inputMode). */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const roots = ['app', 'components', 'pages', 'src']
const extensions = new Set(['.tsx', '.jsx'])
const ignored = new Set(['node_modules', '.next', '.vercel', 'dist', 'build', 'coverage'])
const files = []
function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(path.join(dir, entry.name))
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name))
    }
  }
}
for (const dir of roots) walk(path.join(root, dir))
let failures = 0
for (const file of files) {
  const sourceText = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX)
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const seen = new Set()
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue
        const name = attribute.name.getText(source)
        if (seen.has(name)) {
          const pos = source.getLineAndCharacterOfPosition(attribute.name.getStart(source))
          console.error(`FAIL ${path.relative(root, file)}:${pos.line + 1}:${pos.character + 1} duplicate JSX prop \"${name}\"`)
          failures++
        }
        seen.add(name)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}
console.log(`${failures ? 'FAIL' : 'PASS'} JSX duplicate-prop check: ${files.length} files scanned`)
if (failures) process.exit(1)
