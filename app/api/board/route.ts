import { list } from "@vercel/blob";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}

function fallbackBoard(boardPath?: string) {
  return json({ elements: [], appState: {}, files: {}, ...(boardPath ? { boardPath } : {}) });
}

function authError(request: Request) {
  const appSecret = process.env.MY_SECRET_KEY;

  if (!appSecret) {
    return json({ error: "MY_SECRET_KEY is not configured." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${appSecret}`) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({ error: "BLOB_READ_WRITE_TOKEN is not configured." }, { status: 500 });
  }

  if (!process.env.BLOB_FILENAME) {
    return json({ error: "BLOB_FILENAME is not configured." }, { status: 500 });
  }

  return null;
}

export async function GET(request: Request) {
  const errorResponse = authError(request);
  if (errorResponse) {
    return errorResponse;
  }

  const boardPath = process.env.BLOB_FILENAME as string;

  try {
    const { blobs } = await list({ prefix: boardPath, limit: 1 });
    const boardBlob = blobs.find((blob) => blob.pathname === boardPath);

    if (!boardBlob) {
      return fallbackBoard(boardPath);
    }

    return json({
      boardPath,
      boardUrl: boardBlob.url,
    });
  } catch (error) {
    console.warn(`Falling back to an empty board because ${boardPath} could not be listed.`, error);
    return fallbackBoard(boardPath);
  }
}

export function POST() {
  return json({ error: "Use /api/blob/upload for client-side Blob uploads." }, { status: 405 });
}
