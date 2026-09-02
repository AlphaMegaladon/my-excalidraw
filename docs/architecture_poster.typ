#set page(
  paper: "a3",
  flipped: true,
  margin: (x: 1.5cm, y: 1.2cm),
  fill: rgb("#0f172a")
)

#set text(
  font: ("Geist", "Inter", "Liberation Sans", "Arial"),
  size: 11pt,
  fill: rgb("#e2e8f0")
)

// Farbschema definieren
#let brand-accent = rgb("#38bdf8")
#let brand-bg-card = rgb("#1e293b")
#let brand-border = rgb("#334155")
#let brand-success = rgb("#34d399")
#let brand-warn = rgb("#fbbf24")
#let brand-text-dim = rgb("#94a3b8")

#let poster-box(title: none, body, fill: brand-bg-card, border: brand-border) = {
  rect(
    width: 100%,
    radius: 8pt,
    fill: fill,
    stroke: 1pt + border,
    inset: 14pt,
    stack(
      spacing: 10pt,
      if title != none {
        text(weight: "bold", size: 14pt, fill: brand-accent, title)
      },
      body
    )
  )
}

// Header
#align(center)[
  #stack(
    spacing: 6pt,
    text(weight: "bold", size: 28pt, fill: rgb("#ffffff"), "Excalidraw Whiteboard — Architektur & Systemübersicht"),
    text(size: 13pt, fill: brand-text-dim, "Single-Board Persistenz · Next.js 16 App Router · Vercel Blob Storage · Optimistic ETag Locking")
  )
]

#v(10pt)

// 3-Spalten-Layout
#grid(
  columns: (1fr, 1.2fr, 1fr),
  gutter: 14pt,
  
  // SPALTE 1
  stack(
    spacing: 14pt,
    poster-box(title: "1. Technologiestack")[
      #list(
        [ *Framework*: Next.js 16 (App Router, Node.js API Runtime) ],
        [ *UI & Canvas*: React 19, Tailwind CSS 4, @excalidraw/excalidraw (SSR: false) ],
        [ *Storage*: @vercel/blob (Direct Client Uploads) ],
        [ *Language*: TypeScript 5 (Strict Mode) ],
      )
    ],
    
    poster-box(title: "2. Authentifizierung & Autorisierung")[
      #rect(
        fill: rgb("#0b1329"),
        inset: 8pt,
        radius: 4pt,
        stroke: 1pt + brand-border,
        text(size: 9.5pt, font: "Courier", "Authorization: Bearer <MY_SECRET_KEY>")
      )
      
      #v(4pt)
      - *Single Secret Protection*: Abgesichert durch gemeinsamen `MY_SECRET_KEY`.
      - *Client Session*: Wird nach Login im `localStorage` hinterlegt (`my-excalidraw-app-secret`).
      - *API Validation*: Jede API-Route prüft den Bearer-Token. Bei Fehler: `401 Unauthorized` und Session-Reset.
    ],
    
    poster-box(title: "3. Umgebungsvariablen")[
      #table(
        columns: (1fr, 1.5fr),
        stroke: (x, y) => if y == 0 { (bottom: 1pt + brand-accent) } else { (bottom: 0.5pt + brand-border) },
        fill: (col, row) => if row == 0 { rgb("#0f172a") } else { none },
        align: (left, left),
        table.header([*Variable*], [*Zweck*]),
        [`MY_SECRET_KEY`], [App-Passwort],
        [`BLOB_READ_WRITE_TOKEN`], [Vercel Blob Access],
        [`BLOB_FILENAME`], [Board JSON Pfad],
      )
    ]
  ),
  
  // SPALTE 2 (Zentrum: Architektur & Datenfluss)
  stack(
    spacing: 14pt,
    poster-box(title: "4. System- & Datenfluss-Architektur")[
      #align(center)[
        #rect(
          fill: rgb("#0f172a"),
          radius: 6pt,
          inset: 10pt,
          stroke: 1pt + brand-border,
          [
            #text(size: 10pt, weight: "bold", fill: brand-accent, "Browser Client (React 19 / Excalidraw)") \
            #text(size: 8.5pt, fill: brand-text-dim, "Passwort-Gate · Auto-Save Debounce (10s) · In-Memory ETag · Data-URL Extractor")
          ]
        )
      ]
      
      #grid(
        columns: (1fr, 1fr),
        gutter: 8pt,
        align(center)[
          #text(size: 8.5pt, fill: brand-warn, "① Token Request\n(Auth Header)") \
          #text(size: 16pt, "↓")
        ],
        align(center)[
          #text(size: 8.5pt, fill: brand-success, "② Direct Multi-part\nUpload (Blob Client)") \
          #text(size: 16pt, "↓")
        ]
      )
      
      #grid(
        columns: (1fr, 1fr),
        gutter: 8pt,
        rect(
          fill: rgb("#0f172a"),
          radius: 6pt,
          inset: 8pt,
          stroke: 1pt + brand-border,
          align(center)[
            #text(weight: "bold", size: 10pt, fill: brand-accent, "Next.js API Routes") \
            #text(size: 8.5pt, fill: brand-text-dim, "GET /api/board\nPOST /api/blob/upload")
          ]
        ),
        rect(
          fill: rgb("#0f172a"),
          radius: 6pt,
          inset: 8pt,
          stroke: 1pt + brand-border,
          align(center)[
            #text(weight: "bold", size: 10pt, fill: brand-accent, "Vercel Blob Storage") \
            #text(size: 8.5pt, fill: brand-text-dim, "Board-JSON (Version 2)\nBilder (files/<fileId>.<ext>)")
          ]
        )
      )
      
      #v(4pt)
      #line(length: 100%, stroke: 0.5pt + brand-border)
      
      #text(weight: "bold", size: 11pt, fill: rgb("#ffffff"), "Datenfluss beim Speichern:")
      #enum(
        [Extraktion eingebetteter Data-URLs aus Canvas-Elementen.],
        [Paralleler Upload aller Bilddateien direkt zu `files/...` via Client Token.],
        [Ersetzung der lokalen Data-URLs im JSON durch dauerhafte Blob-URLs.],
        [Upload des Board-JSON mit `ifMatch: expectedBoardEtag`.],
        [Update des lokalen ETag-Zustands bei Erfolg.]
      )
    ]
  ),
  
  // SPALTE 3
  stack(
    spacing: 14pt,
    poster-box(title: "5. Optimistic Locking & Konfliktschutz")[
      - *ETag-Tracking*: Beim initialen Abruf merkt sich der Client das ETag des Board-Blobs.
      - *Precondition Check*: Beim Speichern übergibt der Client `expectedBoardEtag` an `/api/blob/upload`.
      - *Konflikt-Erkennung*: Hat ein anderer Client zwischenzeitlich gespeichert, lehnt Vercel Blob den Schreibvorgang mit `412 Precondition Failed` ab.
      - *Benutzer-Feedback*: `BoardConflictError` informiert den Nutzer: _„Neuere Version verfügbar. Bitte neu laden.“_
    ],
    
    poster-box(title: "6. Performance & Auto-Save")[
      - *10s Debounce*: Änderungen am Whiteboard lösen einen 10-Sekunden-Timer aus (`SAVE_DELAY_MS = 10_000`).
      - *Payload-Optimierung*: Base64-Assets verbleiben nicht im Board-JSON, sondern werden isoliert gespeichert.
      - *Multipart Upload*: Dateien ab 4 MB werden automatisch partitioniert hochgeladen (`MULTIPART_UPLOAD_THRESHOLD_BYTES = 4 MB`).
      - *Status-Indikatoren*: Visuelle Anzeige oben rechts:
        - #text(fill: brand-success, "●") *Gespeichert* (saved)
        - #text(fill: brand-warn, "●") *Speichert...* (saving)
        - #text(fill: rgb("#f87171"), "●") *Speicherfehler* (error / conflict)
    ]
  )
)
