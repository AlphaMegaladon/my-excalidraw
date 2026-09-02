# Projektfortschritt & Planung

## 1. Aktueller Status
- **Funktionsumfang**: Single-Board Excalidraw mit Passwortschutz und Vercel Blob Persistenz.
- **Auto-Save**: 10-Sekunden-Debounce (`SAVE_DELAY_MS = 10_000`) zur Schonung des Vercel Blob Limits.
- **Problem**: Bei schnellem Gerätewechsel oder Verlassen des Tabs vor Ablauf der 10 Sekunden besteht das Risiko von Datenverlust.

---

## 2. Geplante Erweiterung: Sofortiges Speichern (Button & Hotkey)

### 2.1 Zielsetzung
- Ermöglichung einer manuellen, verzögerungsfreien Speicherung ohne Wartezeit auf den 10-Sekunden-Timer.
- Tastatur-Shortcut (`Strg + S` bzw. `Cmd + S`) für Desktop-Poweruser.
- Interaktiver Speicher-Button im UI (Statusanzeige oben rechts).

### 2.2 Technische Schritte
1. **Sofortspeicher-Funktion (`triggerImmediateSave`)**:
   - Bricht einen laufenden Debounce-Timer (`saveTimerRef`) ab.
   - Holt die aktuelle Szene (`latestSceneRef`).
   - Serialisiert und speichert das Board sofort via `saveBoard()`.
2. **Keyboard Shortcut Handler**:
   - Globaler `keydown`-Listener für `(e.ctrlKey || e.metaKey) && e.key === "s"`.
   - `e.preventDefault()` verhindert den Browser-Dialog „Seite speichern unter...“.
   - Aufruf von `triggerImmediateSave()`.
3. **UI-Komponente**:
   - Status-Badge oben rechts wird interaktiv gestaltet (Entfernen von `pointer-events-none`).
   - Ergänzung um einen „Jetzt speichern“-Button bzw. Klickbarkeit des Badges bei ausstehenden Änderungen.
4. **Beforeunload-Absicherung (Optional/Empfohlen)**:
   - Warnung beim Schließen/Verlassen des Tabs, wenn noch ungespeicherte Änderungen in der Warteschlange liegen.

---

## 3. Backlog / Nächste Meilensteine
- [ ] Implementierung der Sofortspeicher-Logik in `app/board-client.tsx`.
- [ ] Tastaturkürzel `Strg + S` / `Cmd + S` einbinden.
- [ ] UI-Button zum manuellen Speichern bereitstellen.
- [ ] Aktualisierung des Architektur-Posters (`docs/architecture_poster.typ`) und der Dokumentation (`docs/architecture.md`).
