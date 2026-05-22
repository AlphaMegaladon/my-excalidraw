import { handleUpload } from "@vercel/blob/client";
import { BlobNotFoundError, head } from "@vercel/blob";

import type { HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

const BOARD_MAX_BYTES = 100 * 1024 * 1024;
const IMAGE_MAX_BYTES = 50 * 1024 * 1024;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const IMAGE_PREFIX = "files/";
const IMAGE_PATH_PATTERN = /^files\/([A-Za-z0-9_-]{1,160})\.(png|jpg|jpeg|webp|gif|svg)$/;
const BOARD_CONTENT_TYPES = ["application/json"];
const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

type UploadClientPayload = {
  kind?: unknown;
  fileId?: unknown;
  expectedBoardEtag?: unknown;
};

class BoardConflictError extends Error {
  constructor() {
    super("Board version conflict.");
    this.name = "BoardConflictError";
  }
}

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

function parseClientPayload(clientPayload: string | null): UploadClientPayload {
  if (!clientPayload) {
    throw new Error("clientPayload is required.");
  }

  if (clientPayload.length > 1_000) {
    throw new Error("clientPayload is too large.");
  }

  const parsed: unknown = JSON.parse(clientPayload);

  if (!isJsonObject(parsed)) {
    throw new Error("clientPayload must be a JSON object.");
  }

  return parsed;
}

function parseExpectedBoardEtag(payload: UploadClientPayload) {
  if (payload.expectedBoardEtag === null || typeof payload.expectedBoardEtag === "string") {
    return payload.expectedBoardEtag;
  }

  throw new Error("Board uploads require clientPayload.expectedBoardEtag.");
}

function isBlobNotFoundError(error: unknown) {
  return (
    error instanceof BlobNotFoundError ||
    (error instanceof Error && error.name === "BlobNotFoundError")
  );
}

async function readBoardEtag(boardPath: string) {
  try {
    return (await head(boardPath)).etag;
  } catch (error) {
    if (isBlobNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function validateBoardUpload(pathname: string, payload: UploadClientPayload) {
  const boardPath = process.env.BLOB_FILENAME as string;

  if (payload.kind !== "board") {
    throw new Error("Board uploads require clientPayload.kind = \"board\".");
  }

  if (pathname !== boardPath) {
    throw new Error("Board uploads may only target BLOB_FILENAME.");
  }

  const expectedBoardEtag = parseExpectedBoardEtag(payload);
  const currentBoardEtag = await readBoardEtag(boardPath);

  if (currentBoardEtag !== expectedBoardEtag) {
    throw new BoardConflictError();
  }

  return {
    addRandomSuffix: false,
    allowOverwrite: currentBoardEtag !== null,
    allowedContentTypes: BOARD_CONTENT_TYPES,
    cacheControlMaxAge: 60,
    ...(currentBoardEtag !== null ? { ifMatch: currentBoardEtag } : {}),
    maximumSizeInBytes: BOARD_MAX_BYTES,
    tokenPayload: JSON.stringify({ kind: "board", pathname, expectedBoardEtag }),
    validUntil: Date.now() + TOKEN_TTL_MS,
  };
}

function validateImageUpload(pathname: string, payload: UploadClientPayload) {
  if (payload.kind !== "file") {
    throw new Error("Image uploads require clientPayload.kind = \"file\".");
  }

  if (!pathname.startsWith(IMAGE_PREFIX)) {
    throw new Error("Image uploads must be stored below files/.");
  }

  const match = pathname.match(IMAGE_PATH_PATTERN);

  if (!match) {
    throw new Error("Image upload pathname is not allowed.");
  }

  const [, fileId] = match;

  if (typeof payload.fileId !== "string" || payload.fileId !== fileId) {
    throw new Error("Image upload fileId must match the pathname.");
  }

  return {
    addRandomSuffix: false,
    allowOverwrite: true,
    allowedContentTypes: IMAGE_CONTENT_TYPES,
    cacheControlMaxAge: 30 * 24 * 60 * 60,
    maximumSizeInBytes: IMAGE_MAX_BYTES,
    tokenPayload: JSON.stringify({ kind: "file", fileId, pathname }),
    validUntil: Date.now() + TOKEN_TTL_MS,
  };
}

async function validateUpload(pathname: string, clientPayload: string | null) {
  const payload = parseClientPayload(clientPayload);

  if (pathname === process.env.BLOB_FILENAME) {
    return validateBoardUpload(pathname, payload);
  }

  return validateImageUpload(pathname, payload);
}

export async function POST(request: Request) {
  const errorResponse = authError(request);
  if (errorResponse) {
    return errorResponse;
  }

  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.type !== "blob.generate-client-token") {
    return json({ error: "Only client upload token generation is supported." }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return validateUpload(pathname, clientPayload);
      },
    });

    return json(response);
  } catch (error) {
    if (error instanceof BoardConflictError) {
      return json({ error: "Board version conflict." }, { status: 409 });
    }

    console.warn("Rejected Vercel Blob client upload token request.", error);
    return json({ error: "Upload is not allowed." }, { status: 400 });
  }
}
