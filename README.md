# claude-mods

Meine Mods für Claude, in jeder Sitzung installierbar.

| Mod | Was es macht |
| --- | --- |
| todo-dashboard | To-do-Fenster neben dem Chat, Befehl `/todo` |
| limit-anzeige | Nutzungslimit in der Statuszeile, Warnung bei 80 % und 95 %, Befehl `/limit` |
| komfort-extras | Dauer der letzten Antwort, Schutz vor gefährlichen Befehlen und .env-Änderungen |
| kosten-sparer | `/schnell <Aufgabe>` schickt einfache Aufgaben an Haiku und schont das Limit |

## Installieren

Im Terminal einer Claude-Sitzung (je Mod ein Aufruf, `y` für den Marketplace, dann den Bereich wählen):

```
/plugin install todo-dashboard --marketplace Sadacan/claude-mods
/plugin install limit-anzeige --marketplace Sadacan/claude-mods
/plugin install komfort-extras --marketplace Sadacan/claude-mods
/plugin install kosten-sparer --marketplace Sadacan/claude-mods
```

Aus einer Shell:

```
claude plugin install todo-dashboard --marketplace Sadacan/claude-mods
```

In der Desktop-App: + neben dem Eingabefeld → Plugins → Add marketplace mit `Sadacan/claude-mods` → Add plugin.

## Handy und Tablet

Cloud-Sitzungen aus der Claude-App auf Handy oder Tablet bekommen die Mods genauso (über das Setup-Skript der Umgebung). Dort:

- Fenster wie die To-do-Liste öffnen sich nicht von selbst, sondern über die Leiste „To-dos · Öffnen“ über dem Eingabefeld oder über das Mods-Menü der App.
- Aufgaben tippst du ins Eingabefeld der Liste, ohne `/todo`-Befehle.
- Das Limit steht ab 50 % als Leiste über dem Eingabefeld, bei 95 % kommt eine Benachrichtigung.
- Alle Befehle (`/todo`, `/limit`, `/schnell …`) gehen auch dort.

## Bedienung

### todo-dashboard

Öffnet beim Start ein Fenster „To-dos“ neben dem Chat. Die Liste bleibt über Sitzungen hinweg erhalten.

| Befehl | Wirkung |
| --- | --- |
| `/todo` | Fenster öffnen |
| `/todo <Text>` | Aufgabe hinzufügen |
| `/todo erledigt <Nr>` | Aufgabe abhaken (nochmal: wieder offen) |
| `/todo löschen <Nr>` | Aufgabe entfernen |
| `/todo aufräumen` | alle erledigten entfernen |
| `/todo liste` | Liste als Text |

Im Fenster gibt es oben ein Eingabefeld für neue Aufgaben; `[ ]` hakt ab, `x` löscht. Über dem Eingabefeld des Chats zeigt eine kleine Leiste „To-dos: 3 offen · Öffnen“.

### limit-anzeige

Zeigt in der Statuszeile z. B. `Limit 5 Std 23 % · 7 Tage 41 %`. Bei 80 % und bei 95 % eines Fensters kommt einmal eine Warnung. `/limit` zeigt alle Werte mit Reset-Zeit, Kontextfüllung und Kosten. Ab 50 % erscheint eine Leiste über dem Eingabefeld (gelb ab 80 %, rot ab 95 %), bei 95 % zusätzlich eine Benachrichtigung. Die Werte gibt es nur bei Abo-Konten und erst nach der ersten Antwort.

### komfort-extras

- Statuszeile: `Letzte Antwort: 12 s`
- Blockiert Befehle wie `rm -rf /`, `rm -rf ~`, `mkfs`, `dd of=/dev/…`, `git push --force`, `git reset --hard`, `git clean -fd`, `curl … | sh`, `shutdown`/`reboot`. Claude bekommt den Grund gesagt und bittet dich, den Befehl selbst auszuführen.
- Claude darf `.env`-Dateien (auch `.env.local` usw.) nicht bearbeiten; `.env.example` bleibt erlaubt.

### kosten-sparer

`/schnell <Aufgabe>` schickt die Aufgabe direkt an Haiku und zeigt die Antwort. Das eignet sich für kurze Fragen, Übersetzungen und kleine Schnipsel. Haiku sieht den bisherigen Chat nicht.
