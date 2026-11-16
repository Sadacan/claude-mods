import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

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

async function pruefe($: EngineInterface, limits: readonly SessionRateLimit[]) {
  $.ui.status(zeile(limits))
  for (const l of limits) {
    for (const schwelle of [95, 80]) {
      if (l.percentUsed < schwelle) continue
      const key = `${l.kind}|${l.resetsAt ?? ''}|${schwelle}`
      if (!gewarnt.has(key)) {
        gewarnt.add(key)
        $.ui.toast(
          `Achtung: ${name(l.kind)}-Limit zu ${Math.round(l.percentUsed)} % verbraucht (Reset ${zeit(l.resetsAt)})`,
        )
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
}
