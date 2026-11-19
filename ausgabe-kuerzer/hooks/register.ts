import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

// Ab dieser Länge (Zeichen, etwa 2000 Tokens) wird gekürzt.
const GRENZE = 8000
const KOPF = 3000
const ENDE = 4000
const ORDNER = '/tmp/claude-ausgaben'
// Befehle, deren Ausgabe Claude bewusst ganz lesen will (Dateiinhalt, Diffs).
const VOLL = /(#\s*voll\b)|^\s*(cat|sed|head|tail|awk|jq|diff|less|nl)\b|\bgit\s+(diff|show)\b/

const HINWEIS = [
  '# Lange Befehlsausgaben (Mod "ausgabe-kuerzer")',
  `Bash-Ausgaben über ${GRENZE} Zeichen werden auf Anfang und Ende gekürzt; die volle Ausgabe liegt in der genannten Datei unter ${ORDNER}.`,
  'Brauchst du mehr, such gezielt in der Datei (grep, sed -n) statt sie ganz zu lesen.',
  'Ungekürzt bleiben cat, sed, head, tail, awk, jq, diff, git diff/show und Befehle mit dem Kommentar "# voll".',
].join('\n')

// Farb- und Steuercodes entfernen, Fortschrittszeilen (\r) auf den letzten Stand bringen,
// gleiche Zeilen hintereinander zusammenfassen.
export function saeubern(text: string): string {
  const ohneFarben = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
  const zeilen = ohneFarben.split('\n').map(z => (z.includes('\r') ? z.split('\r').filter(Boolean).pop() ?? '' : z))
  const raus: string[] = []
  let gleich = 0
  for (const z of zeilen) {
    if (raus.length > 0 && z === raus[raus.length - 1]) { gleich++; continue }
    if (gleich > 0) { raus.push(`[… ${gleich}× dieselbe Zeile]`); gleich = 0 }
    raus.push(z)
  }
  if (gleich > 0) raus.push(`[… ${gleich}× dieselbe Zeile]`)
  return raus.join('\n')
}

export function kuerzen(text: string, pfad: string): string {
  if (text.length <= GRENZE) return text
  const kopf = text.slice(0, KOPF).replace(/\n[^\n]*$/, '')
  const ende = text.slice(-ENDE).replace(/^[^\n]*\n/, '')
  const weg = text.length - kopf.length - ende.length
  const zeilen = text.slice(kopf.length, text.length - ende.length).split('\n').length
  return `${kopf}\n\n[… ${zeilen} Zeilen / ${weg} Zeichen gekürzt (Mod ausgabe-kuerzer). Volle Ausgabe: ${pfad}]\n\n${ende}`
}

let nr = 0

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    try {
      return await verarbeiten($, e.command, ran)
    } catch {
      return ran
    }
  })

  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    if (!e.tools.includes('Bash')) return { sections }
    return { sections: [...sections, { id: 'ausgabe-kuerzer:hinweis', text: HINWEIS, scope: 'session' as const }] }
  })
}

async function verarbeiten($: EngineInterface, command: string, ran: ToolCallResult<'Bash'>): Promise<ToolCallResult<'Bash'>> {
    if (ran.deny !== undefined || ran.isError === true || VOLL.test(command)) return ran
    const r = ran.result as { stdout?: unknown; stderr?: unknown }
    if (typeof r?.stdout !== 'string' || typeof r?.stderr !== 'string') return ran

    const stdout = saeubern(r.stdout)
    const stderr = saeubern(r.stderr)
    if (stdout.length <= GRENZE && stderr.length <= GRENZE && stdout === r.stdout && stderr === r.stderr) return ran

    nr++
    const pfad = `${ORDNER}/${Date.now()}-${nr}.txt`
    if (stdout.length > GRENZE || stderr.length > GRENZE) {
      await $.fs.write(pfad, `$ ${command}\n\n${r.stdout}${r.stderr ? `\n--- stderr ---\n${r.stderr}` : ''}`)
    }

    const result = { ...ran.result, stdout: kuerzen(stdout, pfad), stderr: kuerzen(stderr, pfad) }
    return ran.context ? { result, context: ran.context } : { result }
}
