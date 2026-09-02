# Architecture Decision Records (ADRs)

Dieser Leitfaden dokumentiert wesentliche Architekturentscheidungen für das Excalidraw-Whiteboard.

---

## ADR-001: Manuelle Speicherung via UI-Button und Tastaturkürzel (Strg/Cmd + S)

### Status
Akzeptiert / Geplant

### Kontext
Das System nutzt aktuell ein automatisches Speichern mit einem 10-Sekunden-Debounce (`SAVE_DELAY_MS = 10_000`), um das Vercel Blob Kontingent im Free-Tier nicht zu überlasten. Wenn Nutzer jedoch kurz nach einer Zeichnung das Gerät wechseln oder den Tab schließen, können die letzten Änderungen verloren gehen, falls die 10 Sekunden noch nicht abgelaufen sind.

### Entscheidung
1. **Tastatur-Shortcut**: Es wird ein globaler Keydown-Listener für `Ctrl + S` (Windows/Linux) und `Cmd + S` (macOS) registriert, der das Standardverhalten des Browsers (`preventDefault()`) abfängt und die Speicherung sofort anstößt.
2. **Interaktiver Speicher-Button**: Der Status-Indikator oben rechts wird interaktiv gemacht und erlaubt das manuelle Forcieren des Speichervorgangs per Klick.
3. **Timer-Reset**: Ein manueller Speicheraufruf verwirft den ausstehenden 10-Sekunden-Timer und führt die Serialisierung sowie den Upload unverzüglich aus.

### Konsequenzen
- **Positiv**:
  - Kein Datenverlust bei schnellem Gerätewechsel.
  - Gewohnter Workflow für Benutzer über Standard-Tastaturkürzel.
  - Das automatische 10s-Intervall bleibt als Fallback erhalten, um weiterhin API-Requests zu minimieren.
- **Negativ / Neutral**:
  - Minimaler Mehraufwand in der State-Verwaltung zur Vermeidung paralleler Uploads während eines bereits laufenden Speicherprozesses.
