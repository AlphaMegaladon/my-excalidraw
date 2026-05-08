import { sql } from "@vercel/postgres";

export const runtime = "nodejs";

type WhiteboardRow = {
  elements: unknown;
  app_state: unknown;
  files: unknown;
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

function authError(request: Request) {
  const appSecret = process.env.MY_SECRET_KEY ?? process.env.APP_SECRET;

  if (!appSecret) {
    return json({ error: "APP_SECRET or MY_SECRET_KEY is not configured." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${appSecret}`) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const errorResponse = authError(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const result = await sql<WhiteboardRow>`
      SELECT elements, app_state, COALESCE(files, '{}'::jsonb) AS files
      FROM whiteboard
      WHERE id = 1
    `;

    const row = result.rows[0];

    if (!row) {
      return json({ elements: [], appState: {}, files: {} });
    }

    return json({
      elements: Array.isArray(row.elements) ? row.elements : [],
      appState: isJsonObject(row.app_state) ? row.app_state : {},
      files: isJsonObject(row.files) ? row.files : {},
    });
  } catch (error) {
    console.error("Failed to load whiteboard.", error);
    return json({ error: "Failed to load whiteboard." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const errorResponse = authError(request);
  if (errorResponse) {
    return errorResponse;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isJsonObject(body)) {
    return json({ error: "Request body must be an object." }, { status: 400 });
  }

  const { elements, appState, files } = body;

  if (!Array.isArray(elements)) {
    return json({ error: "`elements` must be an array." }, { status: 400 });
  }

  if (!isJsonObject(appState)) {
    return json({ error: "`appState` must be an object." }, { status: 400 });
  }

  if (!isJsonObject(files)) {
    return json({ error: "`files` must be an object." }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO whiteboard (id, elements, app_state, files)
      VALUES (
        1,
        ${JSON.stringify(elements)}::jsonb,
        ${JSON.stringify(appState)}::jsonb,
        ${JSON.stringify(files)}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        elements = EXCLUDED.elements,
        app_state = EXCLUDED.app_state,
        files = EXCLUDED.files
    `;

    return json({ ok: true });
  } catch (error) {
    console.error("Failed to save whiteboard.", error);
    return json({ error: "Failed to save whiteboard." }, { status: 500 });
  }
}
