import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../src/client/section.module.css', import.meta.url)), 'utf8')
const sectionSource = readFileSync(fileURLToPath(new URL('../src/client/section.tsx', import.meta.url)), 'utf8')
const tokens = readdirSync(fileURLToPath(new URL('../../ui-theme/src/styles/', import.meta.url)))
  .filter(name => name.endsWith('.css'))
  .map(name => readFileSync(fileURLToPath(new URL(`../../ui-theme/src/styles/${name}`, import.meta.url)), 'utf8'))
  .join('\n')

describe('ssh styles', () => {
  it('uses a CSS Module and only declared project tokens', () => {
    expect(sectionSource).toContain("import css from './section.module.css'")
    const named = [...css.matchAll(/var\((--(?:dsw|ds)-[a-z0-9-]+)/g)].map(match => match[1])
    expect(named.every(name => name?.startsWith('--dsw-alias-')
      || name?.startsWith('--dsw-shadow-')
      || name?.startsWith('--ds-transition-')
      || name === '--ds-ease-in-out'
      || name === '--ds-font-family-code')).toBe(true)
    expect([...new Set(named)].filter(name => !tokens.includes(`  ${String(name)}:`))).toEqual([])
  })

  it('contains no literal color values or fallback colors', () => {
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(|\btransparent\b/i)
    expect(css).not.toMatch(/var\(--dsw-[a-z0-9-]+\s*,/)
  })

  it('guards every animation behind reduced-motion', () => {
    const animations = [...css.matchAll(/@keyframes\s+([a-z0-9-]+)/g)].map(match => match[1])
    expect(animations.length).toBeGreaterThan(0)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
