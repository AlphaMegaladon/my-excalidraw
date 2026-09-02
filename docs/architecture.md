# Architektur-Dokumentation

Diese Dokumentation beschreibt den Aufbau, die Datenflüsse, die Authentifizierung und das Speicherkonzept der Excalidraw-Whiteboard-Anwendung.

---

## 1. Technologiestack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Node.js Runtime für APIs)
- **UI & Rendering**: [React 19](https://react.dev), [Tailwind CSS 4](https://tailwindcss.com)
- **Canvas / Whiteboard**: [@excalidraw/excalidraw](https://excalidraw.com) (Client-seitig dynamisch geladen via `next/dynamic` mit SSR: false)
- **Persistenz & Storage**: [@vercel/blob](https://vercel.com/docs/storage/vercel-blob)
- **Sprache**: TypeScript

---

## 2. Systemüberblick

Die Anwendung bietet ein passwortgeschütztes Single-Board Excalidraw-Whiteboard, das Zeichenelemente, App-Zustände und eingebettete Mediendateien (Bilder) direkt in Vercel Blob speichert.

```text
+-------------------------------------------------------------+
| Browser / Client                                            |
|                                                             |
|  +-----------------------+     +--------------------------+ |
|  | Password Gate & Modal |     | Excalidraw Canvas        | |
|  +-----------+-----------+     +------------+-------------+ |
|              |                              |               |
|              v                              v               |
|  +--------------------------------------------------------+ |
|  | BoardClient (State, Auto-Save Debounce, Conflict ETag) | |
|  +---------------------------+----------------------------+ |
+------------------------------|------------------------------+
                               |
            +------------------+------------------+
            | API Calls                           | Direct Uploads
            v                                     v
+------------------------+             +----------------------+
| Next.js API Routes     |             | Vercel Blob Storage  |
|                        |             |                      |
| - GET /api/board       |             | - Board JSON         |
| - POST /api/blob/upload|             | - Image Files        |
+------------------------+             +----------------------+
```

---

## 3. Authentifizierung & Autorisierung

- **Passwortschutz**: Der Zugriff erfolgt über einen gemeinsamen Schlüssel (`MY_SECRET_KEY`), der als Environment-Variable hinterlegt ist.
- **Client-Storage**: Nach erfolgreicher Passworteingabe wird das Passwort im `localStorage` unter `my-excalidraw-app-secret` abgelegt.
- **Header**: Jeder Request an die API Routes (`/api/board`, `/api/blob/upload`) sendet einen Authorization-Header:
  `Authorization: Bearer <MY_SECRET_KEY>`.
- **Validierung**: Beide Endpunkte prüfen den Bearer-Token gegen `process.env.MY_SECRET_KEY`. Bei Nichtübereinstimmung wird `401 Unauthorized` zurückgegeben und die lokale Session zurückgesetzt.

---

## 4. Speicherkonzept & Vercel Blob

### 4.1. Board-Daten (`BLOB_FILENAME`)
- Das Board wird als JSON-Dokument in Vercel Blob gespeichert (`type: "excalidraw"`, Version 2).
- Enthält:
  - `elements`: Liste aller Excalidraw-Zeichenelemente.
  - `appState`: Persistenter Zustand (z. B. `theme`, `zoom`, `scrollX`, `scrollY`).
  - `files`: Dateireferenzen und zugehörige Vercel-Blob-URLs.

### 4.2. Bilder & Assets (`files/`)
- Eingefügte Bilder werden aus dem Data-URL-Format extrahiert (`data:image/...;base64,...`).
- Der Hash und ein bereinigter Bezeichner bilden den Pfad unter `files/<blobFileId>.<ext>`.
- Bilder werden direkt zu Vercel Blob hochgeladen.
- Im Board-JSON wird die lokale Data-URL durch die dauerhafte Vercel-Blob-URL ersetzt, um die Payload klein zu halten.

### 4.3. Client-Side Upload Flow
1. Client fordert bei `/api/blob/upload` ein Client-Token an (validiert Dateigröße, Content-Type, Pfad und ETag).
2. Der Upload des Blobs erfolgt direkt vom Browser zu Vercel Blob (`upload(...)` aus `@vercel/blob/client`), wodurch der Next.js-Server bei großen Payloads entlastet wird.

---

## 5. Konflikterkennung & Datenintegrität

- **Optimistisches Sperren mit ETags**:
  - Beim Laden des Boards via `/api/board` wird das `etag` des gespeicherten Blobs ausgelesen und im Client hinterlegt.
  - Beim Speichern übergibt der Client `expectedBoardEtag`.
  - Der Upload-Endpunkt setzt bei existierenden Dateien `ifMatch: expectedBoardEtag`.
  - Bei Versionskonflikten wirft der Upload einen Precondition-Fehler (`BoardConflictError`), und der Nutzer wird informiert („Neuere Version verfügbar. Bitte neu laden.“).

---

## 6. Auto-Save & Lifecycle

- **Änderungserkennung**: `onChange` des Excalidraw-Canvas feuert bei jeder Modifikation.
- **Debounce**: Änderungen werden gesammelt und nach 10 Sekunden Inaktivität (`SAVE_DELAY_MS = 10_000`) automatisch gespeichert.
- **Statusanzeige**:
  - `Bereit` (idle / initial)
  - `Speichert...` (saving)
  - `Gespeichert` (saved)
  - `Speicherfehler` / Konflikthinweis (error)

---

## 7. Erforderliche Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `MY_SECRET_KEY` | Das Passwort für den Zugriff auf das Whiteboard. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Read/Write-Token für Speicheroperationen. |
| `BLOB_FILENAME` | Dateiname bzw. Pfad für das Whiteboard-JSON in Vercel Blob (z. B. `board.json`). |
