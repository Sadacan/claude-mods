import { expect, test } from 'claude-code/testing'

const lang = Array.from({ length: 2000 }, (_, i) => `Zeile ${i} ok`).join('\n')

test('lange Ausgabe wird gekürzt und gespeichert', async ($, on) => {
  const geschrieben: string[] = []
  on('fs.write', (_, e) => { geschrieben.push(e.path); return { value: undefined } })
  on('tool.call', () => ({ result: { stdout: lang, stderr: '', interrupted: false } }))
  const r = await $.tool.call({ tool: 'Bash', command: 'npm test' })
  const out = (r.result as { stdout: string }).stdout
  expect(out.length < 6000).toBe(true)
  expect(out.includes('Zeile 0 ok')).toBe(true)
  expect(out.includes('Zeile 1999 ok')).toBe(true)
  expect(out.includes('gekürzt')).toBe(true)
  expect(geschrieben.length).toBe(1)
})

test('cat und kurze Ausgaben bleiben unverändert', async ($, on) => {
  on('tool.call', (_, e) => ({ result: { stdout: (e as { command: string }).command === 'cat x' ? lang : 'kurz', stderr: '', interrupted: false } }))
  const a = await $.tool.call({ tool: 'Bash', command: 'cat x' })
  expect((a.result as { stdout: string }).stdout).toBe(lang)
  const b = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect((b.result as { stdout: string }).stdout).toBe('kurz')
})

test('Farbcodes und Wiederholungen werden entfernt', async ($, on) => {
  on('tool.call', () => ({ result: { stdout: '\x1b[32mgrün\x1b[0m\nx\nx\nx\nende', stderr: '', interrupted: false } }))
  const r = await $.tool.call({ tool: 'Bash', command: 'make' })
  expect((r.result as { stdout: string }).stdout).toBe('grün\nx\n[… 2× dieselbe Zeile]\nende')
})
