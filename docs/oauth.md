# Discord-Anmeldung einrichten

Das Admin-Dashboard hat keine Benutzernamen und keine Passwörter. Die Anmeldung
läuft ausschliesslich über Discord. Das hat zwei Vorteile: Es gibt keine
Passwörter zu verwalten oder zu verlieren, und die Berechtigung lässt sich an
die bestehenden Rollen im SwissHub-Server knüpfen.

## Wie die Prüfung abläuft

Bei jeder Anmeldung prüft der Server nacheinander:

1. **Gültiger OAuth-Rückruf** – `state` aus Cookie und Datenbank müssen
   übereinstimmen, der PKCE-Verifier muss passen. Damit sind untergeschobene
   Anmeldungen ausgeschlossen.
2. **Mitgliedschaft** – die Person muss Mitglied des in `DISCORD_GUILD_ID`
   hinterlegten Servers sein.
3. **Berechtigung** – sie muss eine der freigegebenen Discord-Rollen besitzen,
   ausdrücklich per Benutzer-ID erlaubt sein oder bereits ein aktives Konto im
   Dashboard haben.
4. **Rechte** – welche Bereiche sichtbar sind, ergibt sich anschliessend
   ausschliesslich aus den im Dashboard vergebenen Rollen.

Ein erfolgreicher Discord-Login allein erteilt also **keine** Rechte. Ist
Discord nicht erreichbar, wird der Zugriff verweigert – es gibt bewusst keinen
Notfallzugang, der die Prüfung umgeht.

## Schritt 1: Discord-Anwendung anlegen

1. <https://discord.com/developers/applications> öffnen und **New Application**
   wählen. Als Namen z. B. `SwissHub Website` verwenden.
2. Im Bereich **OAuth2** die Redirect-URI eintragen – exakt so, inklusive
   Protokoll und ohne abschliessenden Schrägstrich:

   ```
   https://swisshub.gg/admin/login/callback
   ```

   Für die lokale Entwicklung zusätzlich:

   ```
   http://localhost:3000/admin/login/callback
   ```

   Die Adresse baut die Anwendung aus `APP_URL` – sie muss hier also genau so
   stehen. Wechselt die Domain, wird die neue Redirect-URI zuerst ergänzt und
   erst nach der Prüfung die alte entfernt; dazwischen ist die Anmeldung sonst
   nicht möglich (siehe [deployment.md](deployment.md#domainwechsel)).

3. **Client ID** und **Client Secret** kopieren und in die `.env` eintragen:

   ```dotenv
   DISCORD_CLIENT_ID=123456789012345678
   DISCORD_CLIENT_SECRET=…
   ```

Die Anwendung fordert nur die Berechtigungen `identify` und
`guilds.members.read` an. Es werden keine Nachrichten gelesen und keine Aktionen
im Server ausgeführt.

## Schritt 2: Server-ID hinterlegen

In Discord unter *Einstellungen → Erweitert* den **Entwicklermodus**
aktivieren. Danach mit Rechtsklick auf den SwissHub-Server → **Server-ID
kopieren**.

```dotenv
DISCORD_GUILD_ID=123456789012345678
```

## Schritt 3: Zugriff freigeben

Es gibt zwei Wege, die sich kombinieren lassen.

**Über Discord-Rollen** (empfohlen, weil pflegeleicht): Rechtsklick auf eine
Rolle → **ID kopieren**. Mehrere IDs werden mit Komma getrennt.

```dotenv
DISCORD_ADMIN_ROLE_IDS=111111111111111111,222222222222222222
```

**Über einzelne Personen**: Rechtsklick auf ein Mitglied → **Benutzer-ID
kopieren**.

```dotenv
DISCORD_ALLOWED_USER_IDS=333333333333333333
```

## Schritt 4: Ersten Superadmin einrichten

Damit sich überhaupt jemand Rechte vergeben kann, braucht es einen ersten
Superadmin:

```dotenv
DISCORD_BOOTSTRAP_SUPERADMIN_IDS=333333333333333333
```

Anschliessend die Anwendung neu starten, `/admin` aufrufen und anmelden. Das
Konto erhält dabei automatisch Superadmin-Rechte.

**Danach den Wert wieder leeren** und die Anwendung neu starten. Weitere
Superadmins werden ab dann im Dashboard unter *Benutzer & Rollen* vergeben.

## Optional: Bot-Token als Rückfallweg

Normalerweise liest die Anwendung die Mitgliedschaft mit dem Token der
angemeldeten Person (`guilds.members.read`). Falls das fehlschlägt, kann
ersatzweise ein Bot-Token verwendet werden:

```dotenv
DISCORD_BOT_TOKEN=…
```

Der Bot muss Mitglied des Servers sein. Weitere Rechte braucht er nicht. Ohne
Bot-Token funktioniert die Anmeldung ebenfalls – nur ohne diesen zweiten Weg.

## Neue Personen aufnehmen

1. Die Person erhält im Discord eine freigegebene Rolle (oder ihre Benutzer-ID
   wird in `DISCORD_ALLOWED_USER_IDS` ergänzt).
2. Sie meldet sich einmal unter `/admin` an. Dabei entsteht ihr Konto mit der
   Rolle **Nur Lesen**.
3. Ein Superadmin vergibt unter *Benutzer & Rollen* die passenden Rollen.
   Die Änderung wirkt sofort, ohne erneute Anmeldung.

## Zugriff entziehen

| Ziel | Vorgehen |
|---|---|
| Sofort und vollständig | *Benutzer & Rollen* → Konto **deaktivieren**. Alle Sitzungen enden sofort. |
| Nur Rechte einschränken | Rollen entfernen oder anpassen – wirkt beim nächsten Seitenaufruf. |
| Nur abmelden | *Sitzungen beenden* – die Person kann sich erneut anmelden. |

Alle diese Vorgänge erscheinen im Audit-Log.

## Fehlermeldungen bei der Anmeldung

| Meldung | Ursache |
|---|---|
| „Die Discord-Anmeldung ist noch nicht konfiguriert“ | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` oder `DISCORD_GUILD_ID` fehlt. |
| „Für den Zugang musst du Mitglied des SwissHub-Discords sein“ | Keine Mitgliedschaft im konfigurierten Server. |
| „Dein Discord-Konto ist für das Dashboard nicht freigeschaltet“ | Keine freigegebene Rolle und keine erlaubte Benutzer-ID. |
| „Dieses Konto wurde deaktiviert“ | Das Konto wurde im Dashboard deaktiviert. |
| „Discord ist gerade nicht erreichbar“ | Die Mitgliedschaft konnte nicht geprüft werden. Der Zugriff bleibt bewusst verwehrt. |
| „Die Anmeldung ist ungültig oder abgelaufen“ | Der Vorgang dauerte länger als zehn Minuten oder es fehlte das Cookie. |

Abgelehnte Anmeldungen werden im Audit-Log festgehalten.
