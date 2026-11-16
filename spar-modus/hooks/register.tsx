import type { EngineInterface, Register } from 'claude-code'

type Stufe = 'einfach' | 'mittel' | 'schwer'
type Modus = 'auto' | 'aus' | 'stark'

// Welches Modell und welche Denktiefe je Stufe. "schwer" lässt das Sitzungsmodell.
const ZIEL: Record<'einfach' | 'mittel', { model: string; rang: number; effort: 'low' | 'medium' }> = {
  einfach: { model: 'haiku', rang: 1, effort: 'low' },
  mittel: { model: 'sonnet', rang: 2, effort: 'medium' },
}
// Ab so vielen Tokens im Kontext lohnt ein Modellwechsel nicht mehr: der Zwischenspeicher
// des bisherigen Modells wäre verloren, und alles neu einzulesen kostet mehr, als es spart.
const KONTEXT_GRENZE = 40000

const KNAPP = [
  '# Sparsam arbeiten (Mod "spar-modus")',
  'Gleiche Qualität, weniger Tokens:',
  '- Antworte knapp und direkt, ohne Einleitung, Wiederholung der Frage oder Zusammenfassung von Offensichtlichem.',
  '- Zeige bei Code-Änderungen nur die geänderten Stellen, nie ganze Dateien, außer der Nutzer will sie.',
  '- Lies große Dateien gezielt (Suche, Ausschnitte) statt komplett; lies nichts doppelt.',
  '- Für breite Suchen über viele Dateien nutze einen Explore-Subagenten statt alles selbst zu lesen.',
  '- Gründlichkeit, Tests und Prüfungen bleiben wie sonst: gespart wird an Worten, nicht an Sorgfalt.',
].join('\n')

const ERKLAERUNG =
  'Aufgabe an einen KI-Coding-Assistenten. Stufe "einfach": kurze Frage, Erklärung, Übersetzung, ' +
  'Umformulieren, Mini-Änderung an einer Stelle, Status abfragen. Stufe "mittel": normale Code-Änderung, ' +
  'Fehler mit klarer Ursache, Recherche, Text schreiben. Stufe "schwer": Architektur, Planung, schwierige ' +
  'oder unklare Fehlersuche, viele Dateien, Sicherheit, alles Kritische oder Mehrdeutige. ' +
  'Im Zweifel die höhere Stufe.\n\nAufgabe:\n'

let modus: Modus = 'auto'
let stufe: Stufe | undefined
let letztesModell = ''

const rang = (model: string) => (/haiku/i.test(model) ? 1 : /sonnet/i.test(model) ? 2 : 3)
const anzeige = (model: string) => (/haiku/i.test(model) ? 'Haiku' : /sonnet/i.test(model) ? 'Sonnet' : /opus/i.test(model) ? 'Opus' : model)

async function einstufen($: EngineInterface, text: string): Promise<Stufe | undefined> {
  const t = text.trim()
  if (/^!(stark|opus|schwer)\b/i.test(t)) return 'schwer'
  if (/^!(mittel|sonnet)\b/i.test(t)) return 'mittel'
  if (/^!(schnell|haiku|einfach)\b/i.test(t)) return 'einfach'
  if (t.length > 4000) return 'schwer'
  try {
    const label = await $.model.classify(ERKLAERUNG + t.slice(0, 2000), ['einfach', 'mittel', 'schwer'])
    return label === 'einfach' || label === 'mittel' || label === 'schwer' ? label : undefined
  } catch {
    return undefined
  }
}

// Entscheidet für eine Anfrage, ob heruntergeschaltet wird; undefined heißt: so lassen.
async function waehle($: EngineInterface, model: string, agentId: string | undefined): Promise<'einfach' | 'mittel' | undefined> {
  if (agentId !== undefined) return undefined
  if (modus !== 'auto' || stufe === undefined || stufe === 'schwer') {
    letztesModell = model
    $.ui.status(modus === 'auto' && stufe ? `Modell: ${anzeige(model)} · ${stufe}` : undefined)
    return undefined
  }
  const ziel = ZIEL[stufe]
  if (ziel.rang >= rang(model)) {
    letztesModell = model
    $.ui.status(`Modell: ${anzeige(model)} · ${stufe}`)
    return undefined
  }
  const { context } = await $.session.usage()
  const istGross = (context.tokens ?? 0) > KONTEXT_GRENZE
  // Bei großem Kontext nur auf ein Modell wechseln, das schon die letzte Anfrage bekam.
  if (istGross && rang(letztesModell) !== ziel.rang) {
    letztesModell = model
    $.ui.status(`Modell: ${anzeige(model)} · ${stufe} (Kontext groß, kein Wechsel)`)
    return undefined
  }
  letztesModell = ziel.model
  $.ui.status(`Modell: ${anzeige(ziel.model)} · ${stufe}`)
  return stufe
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const gespeichert = await $.store.get('modus')
    if (gespeichert === 'auto' || gespeichert === 'aus' || gespeichert === 'stark') modus = gespeichert
    await $.command.register({
      name: 'modell',
      description: 'Automatische Modellwahl: /modell auto | stark | aus',
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.isMeta || e.command) return next(e)
    stufe = modus === 'auto' ? await einstufen($, e.text) : undefined
    if ((e.attachments?.length ?? 0) > 0 && stufe === 'einfach') stufe = 'mittel'

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const model = await waehle($, e.model, e.agentId)
    if (model === undefined) return yield* next(e)
    const ziel = ZIEL[model]

    return yield* next({ ...e, model: ziel.model, effort: ziel.effort })
  })

  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    if (modus === 'aus') return { sections }

    return { sections: [...sections, { id: 'spar-modus:knapp', text: KNAPP, scope: 'session' as const }] }
  })

  on('command.run', { command: 'modell' }, async ($, e) => {
    const wort = e.args.trim().toLowerCase()
    if (wort === 'auto' || wort === 'aus' || wort === 'stark') {
      modus = wort
      await $.store.set('modus', modus)
      if (modus !== 'auto') $.ui.status(undefined)
      const was = {
        auto: 'Automatisch: einfache Aufgaben an Haiku, normale an Sonnet, schwere ans Sitzungsmodell.',
        stark: 'Immer das Sitzungsmodell (kein Herunterschalten), knappe Antworten bleiben an.',
        aus: 'Spar-Modus aus: kein Modellwechsel, keine Spar-Hinweise.',
      }[modus]
      return { text: was }
    }

    return {
      text: [
        `Spar-Modus: ${modus}${stufe ? `, letzte Aufgabe: ${stufe}` : ''}${letztesModell ? `, Modell: ${anzeige(letztesModell)}` : ''}`,
        '/modell auto   automatisch wählen (Standard)',
        '/modell stark  immer das stärkste Modell',
        '/modell aus    alles aus',
        'Einzeln erzwingen: Nachricht mit !stark, !mittel oder !schnell beginnen.',
      ].join('\n'),
    }
  })
}
