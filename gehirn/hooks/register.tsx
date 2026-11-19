import type { EngineInterface, Register } from 'claude-code'

// Die Gehirn-Seite (Claude-Artifact) mit der Sammlung "eintraege".
const GEHIRN_URL = 'https://claude.ai/artifact/HnHmcM42G7XrYi7AAsvxji'
const GEHIRN_SLUG = '87e505c5-f761-4d2b-9b09-9174e59cd0b1'
const SERVER = 'claude-artifacts'
const MAX_FRAGE = 2000
const MAX_ANTWORT = 4000

const HINWEIS = [
  '# Gedächtnis des Nutzers ("Gehirn")',
  `Alle früheren Gespräche aus Code-Sitzungen und die Notizen des Nutzers liegen dauerhaft im Artifact ${GEHIRN_URL} (slug ${GEHIRN_SLUG}), Sammlung "eintraege".`,
  'Felder: art ("code" oder "notiz"), ts (ms), projekt, frage, antwort. Neue Einträge legt der Mod "gehirn" selbst an; schreibe nicht selbst hinein, außer der Nutzer bittet dich, sich etwas zu merken (dann art "notiz").',
  `Lies es, wenn der Nutzer sich auf Früheres bezieht ("wie letztes Mal", "mein Projekt", "weißt du noch") oder dir Hintergrund fehlt: mit dem Werkzeug ArtifactData, action "query", url ${GEHIRN_URL}, collection "eintraege", query { order_by: { field: "ts", direction: "desc" }, limit: 30 } (gezielt mit where projekt oder art "notiz"). Lies es nicht ohne Anlass, das spart Tokens.`,
].join('\n')

let projekt = ''
let frage = ''
let sitzung = ''

const kurz = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)} …` : s)

async function merken($: EngineInterface, daten: Record<string, unknown>) {
  const ts = await $.clock.now()
  const id = `${sitzung}-${ts}`
  const data = { ts, ...daten }
  // Weg 1: die Artifact-Verbindung der Sitzung, wenn es sie gibt.
  try {
    const r = await $.mcp.call(SERVER, 'db_write', {
      slug: GEHIRN_SLUG,
      ops: [{ op: 'set', path: `eintraege/${id}`, data }],
    })
    if (!r.isError) return
  } catch {
    // weiter mit Weg 2
  }
  // Weg 2: das eingebaute Werkzeug ArtifactData (braucht die Erlaubnis-Regel "ArtifactData").
  try {
    const r = await $.tool.call({
      tool: 'ArtifactData',
      action: 'set',
      url: GEHIRN_URL,
      collection: 'eintraege',
      doc_id: id,
      data,
    } as never)
    if ('deny' in r && r.deny !== undefined) $.ui.log(`gehirn: Speichern nicht erlaubt (${r.deny})`)
  } catch {
    $.ui.log('gehirn: Gehirn nicht erreichbar, Eintrag übersprungen')
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    projekt = e.cwd.split('/').filter(Boolean).pop() ?? ''
    sitzung = `s${(await $.clock.now()).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
    await $.command.register({
      name: 'gehirn',
      description: 'Link zu deinem Gehirn; /gehirn <Text> merkt sich eine Notiz',
    })

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    if (!e.isMeta && !e.command) frage = e.text

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && !e.isAborted && frage !== '' && e.answer.trim() !== '') {
      void merken($, {
        art: 'code',
        projekt,
        frage: kurz(frage, MAX_FRAGE),
        antwort: kurz(e.answer, MAX_ANTWORT),
      })
      frage = ''
    }

    return ran
  })

  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)

    return { sections: [...sections, { id: 'gehirn:hinweis', text: HINWEIS, scope: 'session' as const }] }
  })

  on('command.run', { command: 'gehirn' }, async ($, e) => {
    const text = e.args.trim()
    if (text === '') return { text: `Dein Gehirn: ${GEHIRN_URL}` }
    await merken($, { art: 'notiz', projekt: '', frage: kurz(text, MAX_FRAGE), antwort: '' })

    return { text: `Gemerkt: ${kurz(text, 120)}` }
  })
}
