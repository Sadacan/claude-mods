import type { Register } from 'claude-code'

// Befehle, die fast nie gewollt sind und viel kaputt machen können.
const GEFAEHRLICH: readonly [RegExp, string][] = [
  [/\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|-r\s+-f|-f\s+-r|--recursive\s+--force|--force\s+--recursive)[a-z]*\s+(\/|~|\$HOME|\*|\.\.?)(\s|\/?$|\/\*)/i, 'rm -rf auf /, ~, * oder .'],
  [/\bmkfs(\.\w+)?\b/, 'Dateisystem formatieren (mkfs)'],
  [/\bdd\b[^|;&]*\bof=\/dev\//, 'dd auf ein Gerät'],
  [/>\s*\/dev\/(sd|nvme|hd|disk)/, 'Schreiben direkt auf ein Laufwerk'],
  [/:\(\)\s*\{\s*:\|:&\s*\};:/, 'Fork-Bombe'],
  [/\bchmod\s+-R\s+0?777\s+\/(\s|$)/, 'chmod -R 777 /'],
  [/\bchown\s+-R\b[^;&|]*\s\/(\s|$)/, 'chown -R auf /'],
  [/\bgit\s+push\b[^;&|]*(\s--force\b|\s-f\b)(?![-\w])/, 'git push --force (nimm --force-with-lease)'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard verwirft Änderungen'],
  [/\bgit\s+clean\s+-[a-z]*f[a-z]*d|\bgit\s+clean\s+-[a-z]*d[a-z]*f/, 'git clean -fd löscht ungetrackte Dateien'],
  [/\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z)?sh\b/, 'Skript aus dem Netz direkt ausführen'],
  [/(^|[;&|]\s*)(sudo\s+)?(shutdown|reboot|halt|poweroff)\b/, 'Rechner herunterfahren'],
]

const ENV_DATEI = /(^|[\\/])\.env(\.[\w.-]+)?$/
const ENV_BEISPIEL = /\.env\.(example|sample|template)$/

const istEnv = (pfad: string) => ENV_DATEI.test(pfad) && !ENV_BEISPIEL.test(pfad)

function dauer(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  return `${Math.floor(s / 60)} min ${s % 60} s`
}

export const register: Register = on => {
  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      $.ui.status(`Letzte Antwort: ${dauer(e.durationMs)}${e.isAborted ? ' (abgebrochen)' : ''}`)
    }

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, ($, e, next) => {
    for (const [muster, grund] of GEFAEHRLICH) {
      if (muster.test(e.command)) {
        return {
          deny: `${$.plugin.name}: blockiert – ${grund}. Wenn das wirklich gewollt ist, bitte den Nutzer, den Befehl selbst auszuführen.`,
        }
      }
    }

    return next(e)
  }).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: Prüfung fehlgeschlagen, Befehl sicherheitshalber blockiert.` },
  )

  on('tool.call', { tool: ['Edit', 'Write'] }, ($, e, next) =>
    istEnv(e.file_path)
      ? { deny: `${$.plugin.name}: ${e.file_path} enthält Geheimnisse und ist geschützt. Der Nutzer muss sie selbst ändern.` }
      : next(e),
  ).catch(($, e, next) =>
    next.called ? next(e) : { deny: `${$.plugin.name}: Prüfung fehlgeschlagen.` },
  )
}
