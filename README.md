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
/plugin install todo-dashboard --marketplace DEIN-NAME/claude-mods
/plugin install limit-anzeige --marketplace DEIN-NAME/claude-mods
/plugin install komfort-extras --marketplace DEIN-NAME/claude-mods
/plugin install kosten-sparer --marketplace DEIN-NAME/claude-mods
```
