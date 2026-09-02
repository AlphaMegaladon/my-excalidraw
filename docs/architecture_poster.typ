#set page(
  paper: "a0",
  flipped: true,
  margin: (x: 3.5cm, y: 3cm),
  fill: rgb("#090d16")
)

#set text(
  font: ("Geist", "Inter", "Liberation Sans", "Arial"),
  size: 20pt,
  fill: rgb("#e2e8f0")
)

// Farbpalette
#let c-bg = rgb("#090d16")
#let c-card = rgb("#131c2e")
#let c-card-inner = rgb("#1c2942")
#let c-border = rgb("#2a3b5c")
#let c-accent = rgb("#38bdf8")
#let c-cyan = rgb("#06b6d4")
#let c-success = rgb("#10b981")
#let c-warn = rgb("#f59e0b")
#let c-danger = rgb("#ef4444")
#let c-purple = rgb("#a855f7")
#let c-dim = rgb("#94a3b8")

// UI-Komponenten
#let card(body, title: none, badge: none, border-color: c-border, fill-color: c-card) = {
  rect(
    width: 100%,
    radius: 16pt,
    fill: fill-color,
    stroke: 2pt + border-color,
    inset: (x: 24pt, y: 22pt)
  )[
    #if title != none or badge != none {
      grid(
        columns: (1fr, auto),
        align: (left + horizon, right + horizon),
        if title != none { text(weight: "bold", size: 24pt, fill: c-accent, title) } else { [] },
        if badge != none {
          rect(
            fill: rgb("#1e3a8a"),
            radius: 8pt,
            inset: (x: 12pt, y: 6pt),
            stroke: 1pt + c-accent,
            text(size: 15pt, weight: "bold", fill: rgb("#bfdbfe"), badge)
          )
        } else { [] }
      )
      v(14pt)
    }
    #body
  ]
}

#let node(title, subtitle: none, fill: c-card-inner, border: c-border, accent: c-accent, width: 100%) = {
  rect(
    width: width,
    radius: 12pt,
    fill: fill,
    stroke: 1.5pt + border,
    inset: (x: 16pt, y: 14pt)
  )[
    #align(center)[
      #text(weight: "bold", size: 18pt, fill: accent, title)
      #if subtitle != none {
        v(4pt)
        text(size: 14pt, fill: c-dim, subtitle)
      }
    ]
  ]
}

#let arrow-down(label: none, color: c-accent) = {
  align(center)[
    #if label != none [
      #text(size: 13pt, fill: color, weight: "bold", label) \
    ]
    #text(size: 26pt, fill: color, "↓")
  ]
}

#let arrow-right(label: none, color: c-accent) = {
  align(center + horizon)[
    #if label != none [
      #text(size: 13pt, fill: color, weight: "bold", label) \
    ]
    #text(size: 28pt, fill: color, "➔")
  ]
}

// -------------------------------------------------------------
// HEADER
// -------------------------------------------------------------
#align(center)[
  #text(weight: "bold", size: 52pt, fill: rgb("#ffffff"), "Excalidraw Whiteboard — Architektur & Systemfluss") \
  #v(8pt)
  #text(size: 24pt, fill: c-dim, "Visuelle Übersicht · End-to-End Datenströme · Client-Side Vercel Blob Uploads · Optimistic Concurrency")
]

#v(20pt)

// -------------------------------------------------------------
// HAUPTLAYOUT (3 Spalten)
// -------------------------------------------------------------
#grid(
  columns: (1fr, 1.35fr, 1fr),
  gutter: 24pt,

  // ==========================================
  // SPALTE 1: SYSTEMTOPOLOGIE & AUTH
  // ==========================================
  [
    #card(title: "1. System-Topologie & Komponenten", badge: "Infrastruktur")[
      #v(6pt)
      // Client Node
      #node("BROWSER / CLIENT", subtitle: "React 19 · Next.js 16 Client Runtime", border: c-accent, accent: c-accent)
      
      #v(10pt)
      #grid(
        columns: (1fr, 1fr),
        gutter: 12pt,
        node("Excalidraw Core", subtitle: "Canvas Engine (CSR)", fill: rgb("#112240"), border: c-cyan, accent: c-cyan),
        node("Session Store", subtitle: "localStorage (Token)", fill: rgb("#112240"), border: c-cyan, accent: c-cyan)
      )

      #v(14pt)
      #grid(
        columns: (1fr, 1fr),
        gutter: 14pt,
        arrow-down(label: "Auth Token / APIs", color: c-warn),
        arrow-down(label: "Direct Blob Upload", color: c-success)
      )
      #v(10pt)

      // Server & Storage Nodes
      #grid(
        columns: (1fr, 1fr),
        gutter: 14pt,
        [
          #node("NEXT.JS BACKEND", subtitle: "Node.js API Routes", border: c-warn, accent: c-warn)
          #v(8pt)
          #rect(
            width: 100%,
            radius: 8pt,
            fill: rgb("#1e2210"),
            stroke: 1pt + c-warn,
            inset: 10pt
          )[
            #align(center)[
              #text(size: 13pt, font: "Courier", fill: rgb("#fef08a"), "GET /api/board\nPOST /api/blob/upload")
            ]
          ]
        ],
        [
          #node("VERCEL BLOB", subtitle: "Object Store & CDN", border: c-success, accent: c-success)
          #v(8pt)
          #rect(
            width: 100%,
            radius: 8pt,
            fill: rgb("#062419"),
            stroke: 1pt + c-success,
            inset: 10pt
          )[
            #align(center)[
              #text(size: 13pt, font: "Courier", fill: rgb("#a7f3d0"), "board.json (Version 2)\nfiles/<hash>.<ext>")
            ]
          ]
        ]
      )
    ]

    #v(20pt)

    #card(title: "2. Authentifizierung & Secret Handshake", badge: "Security")[
      #grid(
        columns: (1fr, auto, 1.2fr),
        gutter: 10pt,
        node("Benutzer-Input", subtitle: "Passwort-Dialog", fill: c-card-inner),
        arrow-right(color: c-purple),
        node("Bearer Token", subtitle: "Authorization Header", fill: rgb("#26143b"), border: c-purple, accent: c-purple)
      )
      
      #v(14pt)
      #rect(
        width: 100%,
        radius: 10pt,
        fill: rgb("#0b1329"),
        stroke: 1.5pt + c-border,
        inset: 14pt
      )[
        #grid(
          columns: (auto, 1fr),
          gutter: 14pt,
          text(size: 22pt, "🔒"),
          [
            #text(size: 15pt, weight: "bold", fill: rgb("#ffffff"), "Validierung via Server Environment Variables") \
            #text(size: 13pt, fill: c-dim, "Abgleich von ")
            #text(size: 13pt, font: "Courier", fill: c-accent, "Bearer <token>")
            #text(size: 13pt, fill: c-dim, " gegen ")
            #text(size: 13pt, font: "Courier", fill: c-accent, "MY_SECRET_KEY")
          ]
        )
      ]
    ]

    #v(20pt)

    #card(title: "3. Konfigurationsmatrix", badge: "ENV")[
      #table(
        columns: (1.2fr, 1.8fr),
        stroke: 1pt + c-border,
        fill: (x, y) => if y == 0 { rgb("#1e293b") } else { none },
        align: (left, left),
        inset: 12pt,
        table.header([*Variable*], [*Zweck & Sichtbarkeit*]),
        [`MY_SECRET_KEY`], [Zugangsschlüssel (Server-Only)],
        [`BLOB_READ_WRITE_TOKEN`], [Vercel Blob RW API Key (Server-Only)],
        [`BLOB_FILENAME`], [Target Pfad für Board-JSON (z.B. board.json)],
      )
    ]
  ],

  // ==========================================
  // SPALTE 2: END-TO-END PIPELINE & DATENFLUSS
  // ==========================================
  [
    #card(title: "4. End-to-End Speicher-Pipeline (Auto-Save Lifecycle)", badge: "Dataflow")[
      
      // Step 1: Trigger
      #rect(width: 100%, radius: 10pt, fill: c-card-inner, stroke: 1.5pt + c-accent, inset: 16pt)[
        #grid(
          columns: (auto, 1fr),
          gutter: 16pt,
          rect(fill: c-accent, radius: 8pt, inset: (x: 12pt, y: 8pt), text(weight: "bold", size: 16pt, fill: c-bg, "SCHRITT 1")),
          [
            #text(weight: "bold", size: 18pt, fill: rgb("#ffffff"), "Trigger: Strg+S / Button / 10s Debounce Timer") \
            #text(size: 14pt, fill: c-dim, "Canvas onChange (10s Debounce) oder manueller Sofort-Trigger (Ctrl+S / Speichern-Button)")
          ]
        )
      ]

      #arrow-down(color: c-accent)

      // Step 2: Extraction
      #rect(width: 100%, radius: 10pt, fill: c-card-inner, stroke: 1.5pt + c-cyan, inset: 16pt)[
        #grid(
          columns: (auto, 1fr),
          gutter: 16pt,
          rect(fill: c-cyan, radius: 8pt, inset: (x: 12pt, y: 8pt), text(weight: "bold", size: 16pt, fill: c-bg, "SCHRITT 2")),
          [
            #text(weight: "bold", size: 18pt, fill: rgb("#ffffff"), "Asset-Extraktion & Data-URL Parsing") \
            #text(size: 14pt, fill: c-dim, "Identifikation von data:image/png;base64,... -> Umwandlung in native Binary Blobs & Hashes")
          ]
        )
      ]

      #arrow-down(color: c-cyan)

      // Step 3: Media Upload
      #rect(width: 100%, radius: 10pt, fill: c-card-inner, stroke: 1.5pt + c-warn, inset: 16pt)[
        #grid(
          columns: (auto, 1fr),
          gutter: 16pt,
          rect(fill: c-warn, radius: 8pt, inset: (x: 12pt, y: 8pt), text(weight: "bold", size: 16pt, fill: c-bg, "SCHRITT 3")),
          [
            #text(weight: "bold", size: 18pt, fill: rgb("#ffffff"), "Client-Side Token Generierung & Image Upload") \
            #text(size: 14pt, fill: c-dim, "POST /api/blob/upload validiert Signatur -> Direct Multi-part Upload nach files/<fileId>.<ext>")
          ]
        )
      ]

      #arrow-down(color: c-warn)

      // Step 4: URL Rewrite
      #rect(width: 100%, radius: 10pt, fill: c-card-inner, stroke: 1.5pt + c-purple, inset: 16pt)[
        #grid(
          columns: (auto, 1fr),
          gutter: 16pt,
          rect(fill: c-purple, radius: 8pt, inset: (x: 12pt, y: 8pt), text(weight: "bold", size: 16pt, fill: c-bg, "SCHRITT 4")),
          [
            #text(weight: "bold", size: 18pt, fill: rgb("#ffffff"), "JSON Payload Transformation & ETag Attachment") \
            #text(size: 14pt, fill: c-dim, "Ersetzen aller Base64-Strings durch permanente CDN-URLs -> Anhängen von expectedBoardEtag")
          ]
        )
      ]

      #arrow-down(color: c-purple)

      // Step 5: Final Persistence
      #rect(width: 100%, radius: 10pt, fill: c-card-inner, stroke: 1.5pt + c-success, inset: 16pt)[
        #grid(
          columns: (auto, 1fr),
          gutter: 16pt,
          rect(fill: c-success, radius: 8pt, inset: (x: 12pt, y: 8pt), text(weight: "bold", size: 16pt, fill: c-bg, "SCHRITT 5")),
          [
            #text(weight: "bold", size: 18pt, fill: rgb("#ffffff"), "Board-Persistenz & Lokales State-Update") \
            #text(size: 14pt, fill: c-dim, "Atomarer Upload von board.json -> Speichern des neuen ETags -> Status: Gespeichert (●)")
          ]
        )
      ]
    ]

    #v(20pt)

    #card(title: "5. Payload-Optimierung (Transformation Schema)", badge: "Optimization")[
      #grid(
        columns: (1fr, auto, 1fr),
        gutter: 12pt,
        [
          #align(center)[#text(size: 14pt, weight: "bold", fill: c-danger, "Vorher (Excalidraw Native)")]
          #v(4pt)
          #rect(width: 100%, fill: rgb("#2a1215"), stroke: 1pt + c-danger, radius: 8pt, inset: 10pt)[
            #text(size: 11pt, font: "Courier", fill: rgb("#fca5a5"), "{\n  \"dataURL\":\n  \"data:image/png;base64,\n  iVBORw0KGgoAAAANSUh...\"\n}")
          ]
          #v(4pt)
          #align(center)[#text(size: 12pt, fill: c-dim, "Sehr große JSON Payload")]
        ],
        arrow-right(color: c-cyan),
        [
          #align(center)[#text(size: 14pt, weight: "bold", fill: c-success, "Nachher (Vercel Blob CDN)")]
          #v(4pt)
          #rect(width: 100%, fill: rgb("#062419"), stroke: 1pt + c-success, radius: 8pt, inset: 10pt)[
            #text(size: 11pt, font: "Courier", fill: rgb("#a7f3d0"), "{\n  \"dataURL\":\n  \"https://...blob.vercel-\n  storage.com/files/img.png\"\n}")
          ]
          #v(4pt)
          #align(center)[#text(size: 12pt, fill: c-dim, "Schlanke, performante Payload")]
        ]
      )
    ]
  ],

  // ==========================================
  // SPALTE 3: CONCURRENCY & STATUS ENGINE
  // ==========================================
  [
    #card(title: "6. Optimistic Locking & Konflikt-Diagramm", badge: "Concurrency")[
      
      #node("Client A startet Upload", subtitle: "Sendet expectedBoardEtag: \"etag_v1\"", fill: c-card-inner)
      
      #v(8pt)
      #arrow-down(color: c-accent)
      #v(4pt)

      #rect(
        width: 100%,
        radius: 12pt,
        fill: rgb("#231f3d"),
        stroke: 1.5pt + c-purple,
        inset: 14pt
      )[
        #align(center)[
          #text(weight: "bold", size: 16pt, fill: rgb("#e9d5ff"), "Vercel Blob: ifMatch Prüfung") \
          #text(size: 13pt, fill: c-dim, "Entspricht expectedBoardEtag dem aktuellen Server-Blob?")
        ]
      ]

      #v(10pt)
      #grid(
        columns: (1fr, 1fr),
        gutter: 12pt,
        [
          #align(center)[#text(size: 14pt, weight: "bold", fill: c-success, "JA (Match)")]
          #arrow-down(color: c-success)
          #rect(width: 100%, radius: 8pt, fill: rgb("#062419"), stroke: 1.5pt + c-success, inset: 10pt)[
            #align(center)[
              #text(size: 14pt, weight: "bold", fill: c-success, "200 OK — Gespeichert") \
              #text(size: 12pt, fill: c-dim, "Neues ETag wird registriert")
            ]
          ]
        ],
        [
          #align(center)[#text(size: 14pt, weight: "bold", fill: c-danger, "NEIN (Mismatch)")]
          #arrow-down(color: c-danger)
          #rect(width: 100%, radius: 8pt, fill: rgb("#2a1215"), stroke: 1.5pt + c-danger, inset: 10pt)[
            #align(center)[
              #text(size: 14pt, weight: "bold", fill: c-danger, "412 Precondition Failed") \
              #text(size: 12pt, fill: c-dim, "BoardConflictError ausgelöst")
            ]
          ]
        ]
      )

      #v(12pt)
      #rect(
        width: 100%,
        radius: 8pt,
        fill: rgb("#2a1810"),
        stroke: 1pt + c-warn,
        inset: 10pt
      )[
        #align(center)[
          #text(size: 13pt, weight: "bold", fill: rgb("#fed7aa"), "Benutzerhinweis: „Neuere Version verfügbar. Bitte neu laden.“")
        ]
      ]
    ]

    #v(20pt)

    #card(title: "7. UI Status-Engine & State Machine", badge: "State Machine")[
      
      #grid(
        columns: (1fr, 1fr),
        gutter: 14pt,
        [
          #rect(width: 100%, radius: 10pt, fill: rgb("#062419"), stroke: 1.5pt + c-success, inset: 12pt)[
            #grid(
              columns: (auto, 1fr),
              gutter: 10pt,
              text(size: 20pt, fill: c-success, "●"),
              [
                #text(size: 15pt, weight: "bold", fill: rgb("#ffffff"), "Gespeichert") \
                #text(size: 12pt, fill: c-dim, "State: saved (idle)")
              ]
            )
          ]
        ],
        [
          #rect(width: 100%, radius: 10pt, fill: rgb("#261e0b"), stroke: 1.5pt + c-warn, inset: 12pt)[
            #grid(
              columns: (auto, 1fr),
              gutter: 10pt,
              text(size: 20pt, fill: c-warn, "●"),
              [
                #text(size: 15pt, weight: "bold", fill: rgb("#ffffff"), "Speichert...") \
                #text(size: 12pt, fill: c-dim, "State: saving (uploading)")
              ]
            )
          ]
        ]
      )

      #v(10pt)

      #rect(width: 100%, radius: 10pt, fill: rgb("#2a1215"), stroke: 1.5pt + c-danger, inset: 12pt)[
        #grid(
          columns: (auto, 1fr),
          gutter: 10pt,
          text(size: 20pt, fill: c-danger, "●"),
          [
            #text(size: 15pt, weight: "bold", fill: rgb("#ffffff"), "Speicherfehler / Versionskonflikt") \
            #text(size: 12pt, fill: c-dim, "State: error (BoardConflictError oder Network Failure)")
          ]
        )
      ]
    ]

    #v(20pt)

    #card(title: "8. Multipart Upload Skalierung", badge: "Performance")[
      #grid(
        columns: (auto, 1fr),
        gutter: 14pt,
        text(size: 28pt, "⚡"),
        [
          #text(size: 15pt, weight: "bold", fill: rgb("#ffffff"), "Schwellenwert: 4 MB (MULTIPART_UPLOAD_THRESHOLD_BYTES)") \
          #text(size: 13pt, fill: c-dim, "Dateien < 4 MB werden als Single Chunk übertragen. Große Boards und hochauflösende Grafiken werden parallelisiert in Chunks segmentiert hochgeladen.")
        ]
      )
    ]
  ]
)
