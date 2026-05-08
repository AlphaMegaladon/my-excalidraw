import { list, put } from "@vercel/blob";

export const runtime = "nodejs";

const IMAGE_PREFIX = "files";

type BoardPayload = {
  type?: unknown;
  version?: unknown;
  source?: unknown;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, BoardFile>;
};

type BoardFile = {
  id?: unknown;
  dataURL?: unknown;
  mimeType?: unknown;
  created?: unknown;
  lastRetrieved?: unknown;
  version?: unknown;
  [key: string]: unknown;
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

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBoardPayload(value: unknown): BoardPayload | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (!Array.isArray(value.elements) || !isJsonObject(value.appState)) {
    return null;
  }

  const files: Record<string, BoardFile> = {};

  if (isJsonObject(value.files)) {
    for (const [fileId, file] of Object.entries(value.files)) {
      if (isJsonObject(file)) {
        files[fileId] = file;
      }
    }
  }

  return {
    ...value,
    elements: value.elements,
    appState: value.appState,
    files,
  };
}

function fallbackBoard() {
  return json({ elements: [], appState: {}, files: {} });
}

function parseDataUrl(dataUrl: string, fallbackMimeType: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);

  if (!match) {
    return null;
  }

  const [, mimeType, encoding, payload] = match;
  const contentType = mimeType || fallbackMimeType || "application/octet-stream";
  const buffer =
    encoding === ";base64"
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");

  return { buffer, contentType };
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/gif") {
    return "gif";
  }

  if (mimeType === "image/svg+xml") {
    return "svg";
  }

  return "bin";
}

function safePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isVercelBlobUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function uploadFilesAndReplaceDataUrls(board: BoardPayload) {
  const files: Record<string, BoardFile> = {};

  for (const [fileId, file] of Object.entries(board.files)) {
    const dataUrl = typeof file.dataURL === "string" ? file.dataURL : "";
    const mimeType = typeof file.mimeType === "string" ? file.mimeType : "application/octet-stream";

    if (isVercelBlobUrl(dataUrl)) {
      files[fileId] = file;
      continue;
    }

    const parsed = dataUrl.startsWith("data:") ? parseDataUrl(dataUrl, mimeType) : null;

    if (!parsed) {
      throw new Error(`File ${fileId} is not a Vercel Blob URL or data URL.`);
    }

    const pathname = `${IMAGE_PREFIX}/${safePathSegment(fileId)}.${extensionForMimeType(
      parsed.contentType,
    )}`;
    const blob = await put(pathname, parsed.buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: parsed.contentType,
    });

    files[fileId] = {
      ...file,
      dataURL: blob.url,
      mimeType: parsed.contentType,
      id: typeof file.id === "string" ? file.id : fileId,
    };
  }

  return {
    ...board,
    files,
  };
}

export async function GET(request: Request) {
  const errorResponse = authError(request);
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const boardPath = process.env.BLOB_FILENAME as string;
    const { blobs } = await list({ prefix: boardPath, limit: 1 });

    if (blobs.length === 0) {
      return fallbackBoard();
    }

    return Response.redirect(blobs[0].url, 307);
  } catch (error) {
    console.warn(
      `Falling back to an empty board because ${process.env.BLOB_FILENAME} could not be loaded.`,
      error,
    );
    return fallbackBoard();
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

  const board = normalizeBoardPayload(body);

  if (!board) {
    return json({ error: "Request body must include elements, appState, and files." }, { status: 400 });
  }

  try {
    const boardPath = process.env.BLOB_FILENAME as string;
    const boardWithBlobUrls = await uploadFilesAndReplaceDataUrls(board);

    await put(boardPath, JSON.stringify(boardWithBlobUrls, null, 2), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });

    return json({ ok: true, board: boardWithBlobUrls });
  } catch (error) {
    console.error(`Failed to save ${process.env.BLOB_FILENAME} to Vercel Blob.`, error);
    return json({ error: "Failed to save board." }, { status: 500 });
  }
}
