import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'limit-anzeige', key: 'limits' } as const, [], { shape: 'limits-1' })
const LEISTE_AB = 50

const NAMEN: Record<string, string> = {
  five_hour: '5 Std',
  seven_day: '7 Tage',
  spend_limit: 'Budget',
}

const name = (kind: string) => NAMEN[kind] ?? kind

function zeit(iso: string | undefined): string {
  if (!iso) return 'unbekannt'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}. ${p(d.getHours())}:${p(d.getMinutes())}`
}

function zeile(limits: readonly SessionRateLimit[]): string | undefined {
  if (limits.length === 0) return undefined
  return 'Limit ' + limits.map(l => `${name(l.kind)} ${Math.round(l.percentUsed)} %`).join(' · ')
}

// Schon gewarnt: "<kind>|<resetsAt>|<schwelle>"
const gewarnt = new Set<string>()

async function pruefe($: EngineInterface, werte: readonly SessionRateLimit[]) {
  $.ui.status(zeile(werte))
  const kopie: Limit[] = werte.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }))
  await update($, limits, () => kopie)
  for (const l of werte) {
    for (const schwelle of [95, 80]) {
      if (l.percentUsed < schwelle) continue
      const key = `${l.kind}|${l.resetsAt ?? ''}|${schwelle}`
      if (!gewarnt.has(key)) {
        gewarnt.add(key)
        const text = `Achtung: ${name(l.kind)}-Limit zu ${Math.round(l.percentUsed)} % verbraucht (Reset ${zeit(l.resetsAt)})`
        $.ui.toast(text)
        // Bei 95 % auch als Benachrichtigung, damit es am Handy ankommt.
        if (schwelle === 95) void $.ui.notify(text, { title: 'Claude-Limit' }).catch(() => undefined)
      }
      break
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'limit',
      description: 'Zeigt, wie viel vom Nutzungslimit verbraucht ist',
    })
    const ran = await next(e)
    const { rateLimits } = await $.session.usage()
    await pruefe($, rateLimits)

    return ran
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await pruefe($, e.rateLimits)

    return next(e)
  })

  on('command.run', { command: 'limit' }, async $ => {
    const { rateLimits, context, cost } = await $.session.usage()
    const zeilen =
      rateLimits.length === 0
        ? ['Noch keine Limit-Werte (kommen nach der ersten Antwort, nur bei Abo-Konten).']
        : rateLimits.map(
            l => `${name(l.kind).padEnd(7)} ${String(Math.round(l.percentUsed)).padStart(3)} %   Reset ${zeit(l.resetsAt)}`,
          )
    if (context.percent !== undefined) {
      zeilen.push(`Kontext ${String(Math.round(context.percent)).padStart(3)} %`)
    }
    if (cost) zeilen.push(`Kosten dieser Sitzung (API-Preise): ${cost.usd.toFixed(2)} $`)

    return { text: zeilen.join('\n') }
  })

  // Leiste über dem Eingabefeld (sichtbar auch in der Handy-App), ab 50 %.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const werte = await read($, limits)
    const hoch = werte.filter(l => l.percentUsed >= LEISTE_AB)
    if (e.props.hasSurvey || hoch.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const max = Math.max(...hoch.map(l => l.percentUsed))
    const farbe = max >= 95 ? 'red' : max >= 80 ? 'yellow' : undefined

    return (
      <Box>
        <Text color={farbe} dimColor={farbe === undefined}>
          Limit: {hoch.map(l => `${name(l.kind)} ${Math.round(l.percentUsed)} % (Reset ${zeit(l.resetsAt)})`).join(' · ')}
        </Text>
      </Box>
    )
  })
}
