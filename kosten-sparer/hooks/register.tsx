import type { Register } from 'claude-code'

const SYSTEM =
  'Du bist ein schneller Helfer für einfache Aufgaben: kurze Fragen, Umformulieren, ' +
  'Übersetzen, kleine Code-Schnipsel, Befehle erklären. Antworte knapp, in der Sprache ' +
  'der Aufgabe, ohne Einleitung.'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'schnell',
      description: 'Einfache Aufgabe an Haiku schicken (spart Limit): /schnell <Aufgabe>',
    })

    return next(e)
  })

  on('command.run', { command: 'schnell' }, async ($, e) => {
    const aufgabe = e.args.trim()
    if (aufgabe === '') {
      return { text: 'Benutzung: /schnell <Aufgabe>, z. B. /schnell Übersetze "Guten Morgen" ins Spanische' }
    }

    $.ui.status('Haiku denkt …')
    const r = await $.model.complete({
      model: 'haiku',
      system: SYSTEM,
      prompt: aufgabe,
      maxTokens: 2048,
      effort: 'low',
      timeoutMs: 60000,
    })
    $.ui.status(undefined)

    if (!r.isAnswered) {
      return { text: `Haiku hat nicht geantwortet (${r.reason}). Stell die Frage einfach normal.` }
    }

    return { text: `${r.text}\n\n— Haiku, ${r.usage.output_tokens} Tokens` }
  })
}
