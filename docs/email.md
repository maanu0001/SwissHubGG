# E-Mail-Versand

Die Anwendung versendet zwei Arten von Nachrichten:

- **Benachrichtigungen** an das Team, wenn eine Kontaktanfrage eingeht
- **Antworten und Eingangsbestätigungen** an die anfragende Person

Ohne konfigurierten SMTP-Server werden alle Nachrichten weiterhin gespeichert
und im Dashboard angezeigt – sie werden nur nicht versendet. Das Dashboard
weist deutlich darauf hin. Es wird kein Versand vorgetäuscht.

## Konfiguration

Zugangsdaten stehen ausschliesslich in der `.env` und niemals in der Datenbank.

```dotenv
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_SECURE=false          # true nur bei Port 465 (implizites TLS)
SMTP_USER=noreply@swisshub.gg
SMTP_PASSWORD=…
MAIL_FROM_NAME=SwissHub
MAIL_FROM_ADDRESS=noreply@swisshub.gg
```

Bei Port 587 wird die Verbindung über STARTTLS verschlüsselt; die Anwendung
verlangt das ausdrücklich (`requireTLS`). Ein unverschlüsselter Versand ist
nicht vorgesehen.

Nach jeder Änderung den Container neu starten:

```bash
docker compose up -d app
```

## Zustellbarkeit

Damit Nachrichten nicht im Spamordner landen, sollten für die Domain gesetzt
sein:

| Eintrag | Zweck |
|---|---|
| **SPF** | erlaubt dem Mailserver, für `swisshub.gg` zu versenden |
| **DKIM** | signiert ausgehende Nachrichten |
| **DMARC** | legt fest, wie mit nicht bestätigten Nachrichten umzugehen ist |

Die konkreten Werte liefert der jeweilige Mailanbieter.

## Empfänger festlegen

Im Dashboard unter *Kontakt → E-Mail-Empfänger*:

1. **Adresse** und optional einen Namen erfassen.
2. **Typ** wählen: *An (TO)* für die zuständige Stelle, *Kopie (CC)* zum
   Mitlesen, *Blindkopie (BCC)* nur wenn wirklich nötig.
3. **Kategorien** zuordnen – so landet eine Sponsoring-Anfrage direkt beim
   richtigen Team. *Alle Kategorien* eignet sich für eine Sammeladresse.
4. **Aktiv** setzen.

Ohne aktive Empfänger wird keine Benachrichtigung versendet. Die Anfrage selbst
wird trotzdem gespeichert und erscheint in der Inbox; das Dashboard vermerkt
bei der Anfrage, dass kein Empfänger hinterlegt war.

Empfängeradressen sind öffentlich nicht auslesbar. Sie erscheinen weder im
HTML noch in einer API-Antwort.

## Eingangsbestätigung

Unter *Einstellungen → Kontaktformular* aktivierbar. Der Text wird unter
*Kontakt → E-Mail-Empfänger → Eingangsbestätigung* in Markdown gepflegt.

Verfügbare Platzhalter:

| Platzhalter | Inhalt |
|---|---|
| `{{name}}` | Name der anfragenden Person |
| `{{subject}}` | Betreff der Anfrage |
| `{{reference}}` | Referenznummer, z. B. `SH-260412-A3F9C1` |
| `{{kategorie}}` | gewählte Kategorie |
| `{{siteName}}` | Name der Website aus den Einstellungen |

## Testnachricht

Unter *Kontakt → E-Mail-Empfänger → Testmail*. Der Vorgang prüft zuerst die
SMTP-Verbindung und stellt erst danach eine Nachricht in die Warteschlange. Das
Ergebnis erscheint sofort; Fehler werden im Klartext angezeigt.

Testmails sind auf fünf Versuche pro Stunde und Person begrenzt.

## Wie der Versand abläuft

Der Versand blockiert nie eine Anfrage. Stattdessen:

1. Die Nachricht wird als Auftrag in der Datenbank gespeichert.
2. Ein Hintergrundlauf verarbeitet die Warteschlange jede Minute.
3. Aufträge werden exklusiv beansprucht (`FOR UPDATE SKIP LOCKED`), sodass
   keine Nachricht doppelt versendet wird.
4. Bei einem Fehler wird mit wachsendem Abstand erneut versucht: nach 1, 2, 4,
   8 … Minuten, höchstens fünfmal und maximal zwei Stunden Abstand.
5. Nach dem letzten Versuch gilt der Auftrag als fehlgeschlagen und erscheint
   im Dashboard unter *System*.

Aufträge, die durch einen Absturz hängen bleiben, werden nach 15 Minuten
automatisch wieder freigegeben.

## Zustellstatus einsehen

| Ort | Inhalt |
|---|---|
| *Kontakt → Anfrage öffnen* | Status der Benachrichtigung und der Eingangsbestätigung, je Antwort im Verlauf |
| *System* | Übersicht der Warteschlange und Liste fehlgeschlagener Aufträge mit Fehlermeldung |

Statuswerte: *in Warteschlange*, *wird versendet*, *zugestellt*,
*fehlgeschlagen*, *abgebrochen*.

„Zugestellt“ bedeutet: vom Mailserver angenommen. Ob die Nachricht im Postfach
ankommt, lässt sich technisch nicht garantieren – dafür sorgen SPF, DKIM und
DMARC.

## Sicherheit

- Betreff und Adressen werden von Zeilenumbrüchen befreit (Schutz vor
  Header-Injection).
- Adressen werden normalisiert und gegen ein Muster geprüft; ungültige Einträge
  werden verworfen.
- Jede Nachricht wird als HTML **und** als Klartext versendet.
- Fehlermeldungen werden auf 500 Zeichen gekürzt, damit keine unnötigen
  Details in der Datenbank landen.
- Zugangsdaten stehen nur in der Umgebung, nie in der Datenbank und nie im
  Dashboard.

## Fehlersuche

| Meldung | Ursache und Abhilfe |
|---|---|
| „Es ist kein SMTP-Server konfiguriert“ | `SMTP_HOST` oder `MAIL_FROM_ADDRESS` fehlt. |
| `ECONNREFUSED` | Host oder Port falsch, oder eine Firewall blockiert die Verbindung. |
| `Invalid login` | Benutzername oder Passwort stimmt nicht. Viele Anbieter verlangen ein eigenes Anwendungspasswort. |
| `self signed certificate` | Der Mailserver verwendet ein selbst signiertes Zertifikat. Ein gültiges Zertifikat einrichten – die Prüfung wird bewusst nicht abgeschaltet. |
| Nachrichten bleiben „in Warteschlange“ | Der Hintergrundlauf ist deaktiviert (`ENABLE_BACKGROUND_JOBS=false`). Im Dashboard unter *System* lässt er sich manuell auslösen. |
