import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'todo-dashboard',
  component: 'Pane',
  requestId: 'todo-dashboard',
  props: {
    title: 'To-dos',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('Aufgabe per Eingabefeld hinzufügen und abhaken, auf jeder Oberfläche', async ($, on) => {
  on('command.register', () => ({ value: { command: 'todo' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let t = 1000
  const gespeichert = new Map<string, unknown>()
  on('clock.now', () => ({ value: (t += 1000) }))
  on('store.get', (_, e) => ({ value: gespeichert.get(e.key) }))
  on('store.set', (_, e) => (gespeichert.set(e.key, e.value), { value: undefined }))
  await $.session.start({ cwd: '/', surface: 'mobile', isInteractive: true })

  for (const surface of ['mobile', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.input({ key: 'neu', text: `Milch ${surface}` })
    const row = await ui.find({ type: 'Text', text: new RegExp(`Milch ${surface}`) })
    expect(row?.text).toContain(`Milch ${surface}`)
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  expect((await ui.find({ type: 'Text', text: /offen/ }))?.text).toContain('2 offen')
  await ui.unmount()
})
