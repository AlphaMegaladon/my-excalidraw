# Projektfortschritt & Planung

## 1. Aktueller Status
- **Funktionsumfang**: Single-Board Excalidraw mit Passwortschutz und Vercel Blob Persistenz.
- **Auto-Save**: 10-Sekunden-Debounce (`SAVE_DELAY_MS = 10_000`) zur Schonung des Vercel Blob Limits.
- **Manuelles Speichern**: Sofortiges Speichern via interaktivem UI-Button und Tastaturkürzel (`Strg + S` / `Cmd + S`) implementiert.

---

## 2. Geplante Erweiterung: Sofortiges Speichern (Button & Hotkey)

### 2.1 Zielsetzung
- Ermöglichung einer manuellen, verzögerungsfreien Speicherung ohne Wartezeit auf den 10-Sekunden-Timer.
- Tastatur-Shortcut (`Strg + S` bzw. `Cmd + S`) für schnellen Workflow.
- Interaktiver Speicher-Button im UI (Statusanzeige oben rechts).
- Schutz vor unbeabsichtigtem Tab-Schließen bei ungespeichertem Zustand.

### 2.2 Technische Schritte
1. **Sofortspeicher-Funktion (`triggerImmediateSave`)**: [x]
   - Bricht einen laufenden Debounce-Timer (`saveTimerRef`) ab.
   - Holt die aktuelle Szene (`latestSceneRef`).
   - Serialisiert und speichert das Board sofort via `saveBoard()`.
2. **Keyboard Shortcut Handler**: [x]
   - Globaler `keydown`-Listener für `(e.ctrlKey || e.metaKey) && e.key === "s"`.
   - `e.preventDefault()` verhindert den Browser-Dialog „Seite speichern unter...“.
   - Aufruf von `triggerImmediateSave()`.
3. **UI-Komponente**: [x]
   - Status-Badge oben rechts interaktiv gestaltet mit separatem „Speichern“-Button und Shortcut-Tipp (`⌘S`).
   - Erkennt `hasPendingChanges` und deaktiviert den Button bei bereits gespeichertem Zustand.
4. **Beforeunload-Absicherung**: [x]
   - Browser-Warnung beim Schließen/Verlassen des Fensters bei ausstehenden Änderungen.

---

## 3. Backlog / Nächste Meilensteine
- [x] Implementierung der Sofortspeicher-Logik in `app/board-client.tsx`.
- [x] Tastaturkürzel `Strg + S` / `Cmd + S` einbinden.
- [x] UI-Button zum manuellen Speichern bereitstellen.
- [x] Aktualisierung der Dokumentation (`docs/architecture.md`, `docs/adr.md`).
