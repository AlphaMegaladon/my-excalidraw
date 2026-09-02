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

// Farbschema
#let brand-accent = rgb("#38bdf8")
#let brand-bg-card = rgb("#1e293b")
#let brand-border = rgb("#334155")
#let brand-success = rgb("#34d399")
#let brand-warn = rgb("#fbbf24")
#let brand-error = rgb("#f87171")
#let brand-text-dim = rgb("#94a3b8")

// Box-Komponente für das Poster
#let poster-box(body, title: none, fill: brand-bg-card, border: brand-border) = {
  rect(
    width: 100%,
    radius: 8pt,
    fill: fill,
    stroke: 1pt + border,
    inset: 14pt,
  )[
    #if title != none {
      text(weight: "bold", size: 13pt, fill: brand-accent, title)
      v(8pt)
    }
    #body
  ]
}

// Header
#align(center)[
  #text(weight: "bold", size: 26pt, fill: rgb("#ffffff"), "Excalidraw Whiteboard — Architektur & Systemübersicht") \
  #v(4pt)
  #text(size: 12pt, fill: brand-text-dim, "Single-Board Persistenz · Next.js 16 App Router · Vercel Blob Storage · Optimistic ETag Locking")
]

#v(10pt)

// 3-Spalten-Layout
#grid(
  columns: (1fr, 1.25fr, 1fr),
  gutter: 14pt,
  
  // SPALTE 1
  [
    #poster-box(title: "1. Technologiestack")[
      - *Framework*: Next.js 16 (App Router, Node.js API Runtime)
      - *UI & Canvas*: React 19, Tailwind CSS 4, `@excalidraw/excalidraw` (SSR: false)
      - *Storage*: `@vercel/blob` (Direct Client-Side Uploads)
      - *Sprache*: TypeScript 5 (Strict Mode)
    ]

    #v(14pt)

    #poster-box(title: "2. Authentifizierung & Autorisierung")[
      #rect(
        width: 100%,
        fill: rgb("#0b1329"),
        inset: 8pt,
        radius: 4pt,
        stroke: 1pt + brand-border,
      )[
        #text(size: 9.5pt, font: "Courier", "Authorization: Bearer <MY_SECRET_KEY>")
      ]
      
      #v(6pt)
      - *Single Secret*: Schutz der gesamten App über einen gemeinsamen `MY_SECRET_KEY`.
      - *Client Session*: Ablage im `localStorage` (`my-excalidraw-app-secret`).
      - *API-Schutz*: `/api/board` und `/api/blob/upload` validieren den Bearer-Token serverseitig. Bei Misserfolg: `401 Unauthorized` und Session-Reset.
    ]

    #v(14pt)

    #poster-box(title: "3. Umgebungsvariablen")[
      #table(
        columns: (1fr, 1.4fr),
        stroke: 0.5pt + brand-border,
        fill: (x, y) => if y == 0 { rgb("#0b1329") } else { none },
        align: (left, left),
        table.header([*Variable*], [*Zweck*]),
        [`MY_SECRET_KEY`], [App-Passwort],
        [`BLOB_READ_WRITE_TOKEN`], [Vercel Blob Access],
        [`BLOB_FILENAME`], [Board JSON Pfad],
      )
    ]
  ],
  
  // SPALTE 2 (Architektur & Speicherkonzept)
  [
    #poster-box(title: "4. System- & Datenfluss-Architektur")[
      #align(center)[
        #rect(
          width: 100%,
          fill: rgb("#0b1329"),
          radius: 6pt,
          inset: 10pt,
          stroke: 1pt + brand-border,
        )[
          #text(size: 10.5pt, weight: "bold", fill: brand-accent, "Browser Client (React 19 / Excalidraw)") \
          #text(size: 8.5pt, fill: brand-text-dim, "Passwort-Gate · Auto-Save Debounce (10s) · In-Memory ETag · Data-URL Extractor")
        ]
      ]
      
      #v(6pt)
      
      #grid(
        columns: (1fr, 1fr),
        gutter: 8pt,
        align(center)[
          #text(size: 8.5pt, fill: brand-warn, "① Client Upload Token\n(Bearer Auth Header)") \
          #text(size: 14pt, "↓")
        ],
        align(center)[
          #text(size: 8.5pt, fill: brand-success, "② Direct Multi-part Upload\n(@vercel/blob/client)") \
          #text(size: 14pt, "↓")
        ]
      )
      
      #v(6pt)
      
      #grid(
        columns: (1fr, 1fr),
        gutter: 8pt,
        rect(
          width: 100%,
          fill: rgb("#0b1329"),
          radius: 6pt,
          inset: 8pt,
          stroke: 1pt + brand-border,
        )[
          #align(center)[
            #text(weight: "bold", size: 9.5pt, fill: brand-accent, "Next.js API Routes") \
            #text(size: 8pt, fill: brand-text-dim, "GET /api/board\nPOST /api/blob/upload")
          ]
        ],
        rect(
          width: 100%,
          fill: rgb("#0b1329"),
          radius: 6pt,
          inset: 8pt,
          stroke: 1pt + brand-border,
        )[
          #align(center)[
            #text(weight: "bold", size: 9.5pt, fill: brand-accent, "Vercel Blob Storage") \
            #text(size: 8pt, fill: brand-text-dim, "Board-JSON (Version 2)\nBilder (files/<fileId>.<ext>)")
          ]
        ]
      )
      
      #v(8pt)
      #line(length: 100%, stroke: 0.5pt + brand-border)
      #v(4pt)
      
      #text(weight: "bold", size: 10.5pt, fill: rgb("#ffffff"), "Speicherablauf (Auto-Save Lifecycle):")
      
      + Extraktion eingebetteter Data-URLs aus Canvas-Elementen.
      + Paralleler Upload neuer Bilddateien nach `files/...` via Client Token.
      + Ersetzung der lokalen Base64-URLs durch permanente Vercel-Blob-URLs.
      + Upload des Board-Dokuments mit `ifMatch: expectedBoardEtag`.
      + Lokales ETag-Update nach erfolgreichem Upload.
    ]
  ],
  
  // SPALTE 3
  [
    #poster-box(title: "5. Optimistic Locking & Konfliktschutz")[
      - *ETag-Tracking*: Beim Initialabruf via `/api/board` speichert der Client das Blob-ETag (`boardEtagRef`).
      - *Precondition Check*: Beim Speichern übergibt der Client `expectedBoardEtag` im `clientPayload`.
      - *Konflikterkennung*: Hat ein anderer Client zwischenzeitlich gespeichert, antwortet Vercel Blob mit `412 Precondition Failed`.
      - *Benutzerführung*: `BoardConflictError` zeigt: \
        _„Neuere Version verfügbar. Bitte neu laden.“_
    ]

    #v(14pt)

    #poster-box(title: "6. Performance & Status")[
      - *10s Debounce*: Änderungen am Canvas triggern einen 10s-Timer (`SAVE_DELAY_MS = 10_000`).
      - *Schlanke Payloads*: Große Bilddaten verbleiben nicht im Board-JSON, sondern werden isoliert gespeichert.
      - *Multipart Upload*: Automatische Segmentierung ab 4 MB (`MULTIPART_UPLOAD_THRESHOLD_BYTES = 4 MB`).
      - *Visuelle Statusanzeige*:
        - #text(fill: brand-success, "●") *Gespeichert* (`saved`)
        - #text(fill: brand-warn, "●") *Speichert...* (`saving`)
        - #text(fill: brand-error, "●") *Speicherfehler / Konflikt* (`error`)
    ]
  ]
)
