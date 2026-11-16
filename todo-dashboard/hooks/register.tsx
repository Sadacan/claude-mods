import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Todo } from '../types'

const PANE = 'todo-dashboard'
const STORE_KEY = 'todos'
const todos = atom({ plugin: 'todo-dashboard', key: 'todos' } as const, [], {
  shape: 'todos-1',
})

const HILFE = [
  '/todo                 Fenster öffnen',
  '/todo <Text>          Aufgabe hinzufügen',
  '/todo erledigt <Nr>   Aufgabe abhaken (nochmal: wieder offen)',
  '/todo löschen <Nr>    Aufgabe entfernen',
  '/todo aufräumen       alle erledigten entfernen',
  '/todo liste           Aufgaben als Text zeigen',
].join('\n')

function isTodoList(value: unknown): value is Todo[] {
  return (
    Array.isArray(value) &&
    value.every(
      t =>
        typeof t === 'object' &&
        t !== null &&
        typeof (t as Todo).id === 'number' &&
        typeof (t as Todo).text === 'string' &&
        typeof (t as Todo).isDone === 'boolean',
    )
  )
}

async function change($: EngineInterface, fn: (list: Todo[]) => Todo[]) {
  await update($, todos, list => fn(list))
  await $.store.set(STORE_KEY, await read($, todos))
}

function asText(list: Todo[]): string {
  if (list.length === 0) return 'Keine Aufgaben.'
  return list
    .map((t, i) => `${i + 1}. [${t.isDone ? 'x' : ' '}] ${t.text}`)
    .join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'todo',
      description: 'To-do-Liste: /todo <Text>, /todo erledigt <Nr>, /todo hilfe',
    })
    const saved = await $.store.get(STORE_KEY)
    if (isTodoList(saved)) await update($, todos, () => saved)
    void $.ui.open({ id: PANE, title: 'To-dos' })

    return next(e)
  })

  on('command.run', { command: 'todo' }, async ($, e) => {
    const args = e.args.trim()
    const [first = '', ...rest] = args.split(/\s+/)
    const word = first.toLowerCase()
    const nr = Number(rest[0])
    const list = await read($, todos)
    const pick = () => (Number.isInteger(nr) && nr >= 1 && nr <= list.length ? list[nr - 1] : undefined)

    if (args === '') {
      const { isPlaced } = await $.ui.open({ id: PANE, title: 'To-dos' })
      return { text: isPlaced ? 'To-do-Fenster geöffnet.' : asText(list) }
    }
    if (word === 'hilfe' || word === 'help') return { text: HILFE }
    if (word === 'liste' || word === 'list') return { text: asText(list) }
    if (word === 'aufräumen' || word === 'clear') {
      const n = list.filter(t => t.isDone).length
      await change($, l => l.filter(t => !t.isDone))
      return { text: `${n} erledigte Aufgabe(n) entfernt.` }
    }
    if (word === 'erledigt' || word === 'done' || word === 'löschen' || word === 'del') {
      const todo = pick()
      if (!todo) return { text: `Keine Aufgabe Nr. ${rest[0] ?? '?'}. ${HILFE}` }
      if (word === 'erledigt' || word === 'done') {
        await change($, l => l.map(t => (t.id === todo.id ? { ...t, isDone: !t.isDone } : t)))
        return { text: `${todo.isDone ? 'Wieder offen' : 'Erledigt'}: ${todo.text}` }
      }
      await change($, l => l.filter(t => t.id !== todo.id))
      return { text: `Gelöscht: ${todo.text}` }
    }

    const text = word === 'neu' || word === 'add' ? rest.join(' ') : args
    if (text === '') return { text: HILFE }
    const id = (await $.clock.now()) + Math.floor(Math.random() * 1000)
    await change($, l => [...l, { id, text, isDone: false }].slice(-200))
    return { text: `Hinzugefügt: ${text}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, todos)
    const open = list.filter(t => !t.isDone).length
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 5)

    return (
      <Box flexDirection="column">
        <Text bold>
          {open} offen, {list.length - open} erledigt
        </Text>
        {list.length === 0 && <Text dimColor>Noch keine Aufgaben. Tippe /todo &lt;Text&gt;</Text>}
        {list.slice(0, room).map((t, i) => (
          <Box key={`row-${t.id}`}>
            <Button
              key={`toggle-${t.id}`}
              label={t.isDone ? '[x]' : '[ ]'}
              onPress={() => change($, l => l.map(x => (x.id === t.id ? { ...x, isDone: !x.isDone } : x)))}
            />
            <Text dimColor={t.isDone} strikethrough={t.isDone}>
              {' '}
              {i + 1}. {t.text}{' '}
            </Text>
            <Button
              key={`del-${t.id}`}
              label="x"
              onPress={() => change($, l => l.filter(x => x.id !== t.id))}
            />
          </Box>
        ))}
        {list.length > room && <Text dimColor>… und {list.length - room} weitere (/todo liste)</Text>}
      </Box>
    )
  })
}
