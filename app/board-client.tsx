"use client";

import dynamic from "next/dynamic";
import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@excalidraw/excalidraw/index.css";

import type { FormEvent } from "react";
import type {
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";

const STORAGE_KEY = "my-excalidraw-app-secret";
const SAVE_DELAY_MS = 10_000;
const UPLOAD_ROUTE = "/api/blob/upload";
const MULTIPART_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

const Excalidraw = dynamic<ExcalidrawProps>(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Canvas wird geladen...
      </div>
    ),
  },
);

type BoardPayload = {
  elements: NonNullable<ExcalidrawInitialDataState["elements"]>;
  appState: NonNullable<ExcalidrawInitialDataState["appState"]>;
  files: NonNullable<ExcalidrawInitialDataState["files"]>;
};

type BoardFile = BoardPayload["files"][string];

type BoardMetadataPayload = {
  boardPath: string;
  boardUrl?: string;
  boardEtag?: string | null;
};

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;
type SceneSnapshot = {
  elements: Parameters<OnChange>[0];
  appState: Parameters<OnChange>[1];
  files: Parameters<OnChange>[2];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";
type BoardTheme = "light" | "dark";
type BoardEtag = string | null;

const BOARD_CONFLICT_MESSAGE = "Neuere Version verfügbar. Bitte neu laden.";

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

  return {
    elements: value.elements as BoardPayload["elements"],
    appState: value.appState as BoardPayload["appState"],
    files: isJsonObject(value.files) ? (value.files as BoardPayload["files"]) : {},
  };
}

function isBoardMetadataPayload(value: unknown): value is BoardMetadataPayload {
  return (
    isJsonObject(value) &&
    typeof value.boardPath === "string" &&
    (value.boardUrl === undefined || typeof value.boardUrl === "string") &&
    (value.boardEtag === undefined ||
      value.boardEtag === null ||
      typeof value.boardEtag === "string")
  );
}

function normalizeBoardEtag(value: unknown): BoardEtag {
  return typeof value === "string" ? value : null;
}

class BoardConflictError extends Error {
  constructor() {
    super(BOARD_CONFLICT_MESSAGE);
    this.name = "BoardConflictError";
  }
}

function isBoardConflictError(error: unknown) {
  if (error instanceof BoardConflictError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "BlobPreconditionFailedError" ||
    error.message.includes("ETag mismatch") ||
    error.message.includes("already exists")
  );
}

function normalizeTheme(value: unknown): BoardTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function extractPersistentAppState(appState: SceneSnapshot["appState"]) {
  const persistentAppState: Record<string, unknown> = {};

  if (isFiniteNumber(appState.scrollX)) {
    persistentAppState.scrollX = appState.scrollX;
  }

  if (isFiniteNumber(appState.scrollY)) {
    persistentAppState.scrollY = appState.scrollY;
  }

  if (isFiniteNumber(appState.zoom?.value)) {
    persistentAppState.zoom = { value: appState.zoom.value };
  }

  const nextTheme = normalizeTheme(appState.theme);

  if (nextTheme) {
    persistentAppState.theme = nextTheme;
  }

  return persistentAppState as Partial<BoardPayload["appState"]>;
}

function buildAuthHeaders(secret: string) {
  return {
    Authorization: `Bearer ${secret}`,
  };
}

function isVercelBlobUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function withCacheBust(url: string) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("t", Date.now().toString());
  return nextUrl.toString();
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

function buildBlobFileId(fileId: string) {
  const readablePart = fileId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120) || "file";
  return `${readablePart}-${hashString(fileId)}`.slice(0, 160);
}

function extensionForContentType(contentType: string) {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

function parseDataUrl(dataUrl: string, fallbackContentType = "image/png") {
  const match = dataUrl.match(/^data:([^,]*),([\s\S]*)$/);

  if (!match) {
    throw new Error("Invalid data URL");
  }

  const [, metadata, rawData] = match;
  const metadataParts = metadata.split(";").filter(Boolean);
  const contentType = (metadataParts.find((part) => part.includes("/")) || fallbackContentType)
    .toLowerCase();
  const isBase64 = metadataParts.includes("base64");

  if (isBase64) {
    const binary = atob(rawData);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return {
      blob: new Blob([bytes], { type: contentType }),
      contentType,
    };
  }

  return {
    blob: new Blob([decodeURIComponent(rawData)], { type: contentType }),
    contentType,
  };
}

function createBoardDocument(payload: BoardPayload) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    ...payload,
  };
}

export default function BoardClient() {
  const [secret, setSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [initialData, setInitialData] = useState<BoardPayload | null>(null);
  const [theme, setTheme] = useState<BoardTheme>("dark");
  const [boardPath, setBoardPath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSceneRef = useRef<SceneSnapshot | null>(null);
  const uploadedFileUrlsRef = useRef<Record<string, string>>({});
  const boardEtagRef = useRef<BoardEtag>(null);
  const hasLoadedSecretRef = useRef(false);

  const isLoggedIn = secret.length > 0;

  const clearSavedSecret = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSecret("");
    setPasswordInput("");
    setInitialData(null);
    setTheme("dark");
    setBoardPath("");
    latestSceneRef.current = null;
    uploadedFileUrlsRef.current = {};
    boardEtagRef.current = null;
  }, []);

  const rememberUploadedFileUrls = useCallback((payload: BoardPayload) => {
    const urls = { ...uploadedFileUrlsRef.current };

    for (const [fileId, file] of Object.entries(payload.files)) {
      if (typeof file.dataURL === "string" && isVercelBlobUrl(file.dataURL)) {
        urls[fileId] = file.dataURL;
      }
    }

    uploadedFileUrlsRef.current = urls;
  }, []);

  const replaceKnownFileDataUrls = useCallback((payload: BoardPayload): BoardPayload => {
    const files = { ...payload.files };

    for (const [fileId, blobUrl] of Object.entries(uploadedFileUrlsRef.current)) {
      const file = files[fileId];

      if (file && typeof file.dataURL === "string" && file.dataURL.startsWith("data:")) {
        files[fileId] = {
          ...file,
          dataURL: blobUrl as typeof file.dataURL,
        };
      }
    }

    return {
      ...payload,
      files,
    };
  }, []);

  const loadBoard = useCallback(
    async (nextSecret: string) => {
      setIsLoading(true);
      setLoginError("");

      try {
        const response = await fetch("/api/board", {
          headers: buildAuthHeaders(nextSecret),
          cache: "no-store",
        });

        if (response.status === 401) {
          clearSavedSecret();
          setLoginError("Das Passwort ist nicht korrekt.");
          return;
        }

        if (!response.ok) {
          setLoginError("Das Board konnte nicht geladen werden.");
          return;
        }

        const apiPayload: unknown = await response.json();
        let nextBoardPath = "";
        let payload = normalizeBoardPayload(apiPayload);

        if (isBoardMetadataPayload(apiPayload)) {
          nextBoardPath = apiPayload.boardPath;
          boardEtagRef.current = normalizeBoardEtag(apiPayload.boardEtag);

          if (apiPayload.boardUrl) {
            const boardResponse = await fetch(withCacheBust(apiPayload.boardUrl), {
              cache: "no-store",
            });

            if (!boardResponse.ok) {
              setLoginError("Das Board konnte nicht geladen werden.");
              return;
            }

            payload = normalizeBoardPayload(await boardResponse.json());
          }
        }

        if (!nextBoardPath) {
          setLoginError("Der Board-Dateiname konnte nicht geladen werden.");
          return;
        }

        if (!payload) {
          setLoginError("Die gespeicherten Board-Daten haben ein unerwartetes Format.");
          return;
        }

        setBoardPath(nextBoardPath);
        setTheme(normalizeTheme(payload.appState.theme) ?? "dark");
        setInitialData(payload);
        rememberUploadedFileUrls(payload);
        setSaveStatus("saved");
      } catch {
        setLoginError("Das Board konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    },
    [clearSavedSecret, rememberUploadedFileUrls],
  );

  useEffect(() => {
    if (hasLoadedSecretRef.current) {
      return;
    }

    hasLoadedSecretRef.current = true;

    const savedSecret = localStorage.getItem(STORAGE_KEY);

    if (savedSecret) {
      queueMicrotask(() => {
        setSecret(savedSecret);
        setPasswordInput(savedSecret);
        void loadBoard(savedSecret);
      });
    }
  }, [loadBoard]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const uploadBoardFile = useCallback(
    async (fileId: string, file: BoardFile, nextSecret: string): Promise<BoardFile> => {
      const dataUrl = file.dataURL;

      if (typeof dataUrl !== "string") {
        return file;
      }

      if (isVercelBlobUrl(dataUrl)) {
        uploadedFileUrlsRef.current = {
          ...uploadedFileUrlsRef.current,
          [fileId]: dataUrl,
        };
        return file;
      }

      const knownBlobUrl = uploadedFileUrlsRef.current[fileId];

      if (knownBlobUrl && dataUrl.startsWith("data:")) {
        return {
          ...file,
          dataURL: knownBlobUrl as typeof file.dataURL,
        };
      }

      if (!dataUrl.startsWith("data:")) {
        return file;
      }

      const fallbackContentType =
        typeof file.mimeType === "string" ? file.mimeType : "image/png";
      const { blob, contentType } = parseDataUrl(dataUrl, fallbackContentType);
      const blobFileId = buildBlobFileId(fileId);
      const pathname = `files/${blobFileId}.${extensionForContentType(contentType)}`;
      const uploadedBlob = await upload(pathname, blob, {
        access: "public",
        contentType,
        handleUploadUrl: UPLOAD_ROUTE,
        headers: buildAuthHeaders(nextSecret),
        clientPayload: JSON.stringify({ kind: "file", fileId: blobFileId }),
        multipart: blob.size >= MULTIPART_UPLOAD_THRESHOLD_BYTES,
      });

      uploadedFileUrlsRef.current = {
        ...uploadedFileUrlsRef.current,
        [fileId]: uploadedBlob.url,
      };

      return {
        ...file,
        dataURL: uploadedBlob.url as typeof file.dataURL,
      };
    },
    [],
  );

  const uploadBoardFiles = useCallback(
    async (payload: BoardPayload, nextSecret: string): Promise<BoardPayload> => {
      const files = { ...payload.files };

      for (const [fileId, file] of Object.entries(payload.files)) {
        files[fileId] = await uploadBoardFile(fileId, file, nextSecret);
      }

      return {
        ...payload,
        files,
      };
    },
    [uploadBoardFile],
  );

  const uploadBoardDocument = useCallback(
    async (
      payload: BoardPayload,
      nextSecret: string,
      nextBoardPath: string,
      expectedBoardEtag: BoardEtag,
    ) => {
      const boardBlob = new Blob([JSON.stringify(createBoardDocument(payload))], {
        type: "application/json",
      });

      return upload(nextBoardPath, boardBlob, {
        access: "public",
        contentType: "application/json",
        handleUploadUrl: UPLOAD_ROUTE,
        headers: buildAuthHeaders(nextSecret),
        clientPayload: JSON.stringify({ kind: "board", expectedBoardEtag }),
        multipart: boardBlob.size >= MULTIPART_UPLOAD_THRESHOLD_BYTES,
      });
    },
    [],
  );

  const saveBoard = useCallback(
    async (payload: BoardPayload) => {
      if (!secret) {
        return;
      }

      if (!boardPath) {
        setSaveStatus("error");
        setSaveError("Der Board-Dateiname konnte nicht geladen werden.");
        return;
      }

      setSaveStatus("saving");
      setSaveError("");

      try {
        const expectedBoardEtag = boardEtagRef.current;
        const payloadWithKnownBlobUrls = replaceKnownFileDataUrls(payload);
        const payloadWithUploadedFiles = await uploadBoardFiles(payloadWithKnownBlobUrls, secret);

        const uploadedBoard = await uploadBoardDocument(
          payloadWithUploadedFiles,
          secret,
          boardPath,
          expectedBoardEtag,
        );
        rememberUploadedFileUrls(payloadWithUploadedFiles);
        boardEtagRef.current = normalizeBoardEtag(uploadedBoard.etag);

        setSaveStatus("saved");
      } catch (error) {
        setSaveStatus("error");
        setSaveError(
          isBoardConflictError(error)
            ? BOARD_CONFLICT_MESSAGE
            : "Änderungen konnten nicht gespeichert werden.",
        );
      }
    },
    [
      boardPath,
      rememberUploadedFileUrls,
      replaceKnownFileDataUrls,
      secret,
      uploadBoardDocument,
      uploadBoardFiles,
    ],
  );

  const buildPayloadFromScene = useCallback(async (scene: SceneSnapshot) => {
    const { serializeAsJSON } = await import("@excalidraw/excalidraw");
    const serialized = serializeAsJSON(scene.elements, scene.appState, scene.files, "local");
    const payload = normalizeBoardPayload(JSON.parse(serialized));

    if (!payload) {
      throw new Error("Unexpected serialized scene shape");
    }

    return {
      ...payload,
      appState: {
        ...payload.appState,
        ...extractPersistentAppState(scene.appState),
      },
    };
  }, []);

  const scheduleSave = useCallback(
    (scene: SceneSnapshot) => {
      latestSceneRef.current = scene;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;

        if (latestSceneRef.current) {
          void buildPayloadFromScene(latestSceneRef.current)
            .then(saveBoard)
            .catch(() => {
              setSaveStatus("error");
              setSaveError("Änderungen konnten nicht vorbereitet werden.");
            });
        }
      }, SAVE_DELAY_MS);
    },
    [buildPayloadFromScene, saveBoard],
  );

  const handleChange = useCallback<OnChange>(
    (elements, appState, files) => {
      const nextTheme = normalizeTheme(appState.theme);

      if (nextTheme) {
        setTheme((currentTheme) => (currentTheme === nextTheme ? currentTheme : nextTheme));
      }

      scheduleSave({ elements, appState, files });
    },
    [scheduleSave],
  );

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSecret = passwordInput.trim();

    if (!nextSecret) {
      setLoginError("Bitte gib das Passwort ein.");
      return;
    }

    localStorage.setItem(STORAGE_KEY, nextSecret);
    setSecret(nextSecret);
    await loadBoard(nextSecret);
  };

  const statusText = useMemo(() => {
    if (saveStatus === "saving") {
      return "Speichert...";
    }

    if (saveStatus === "saved") {
      return "Gespeichert";
    }

    if (saveStatus === "error") {
      return saveError || "Speicherfehler";
    }

    return "Bereit";
  }, [saveError, saveStatus]);

  return (
    <main className="relative min-h-screen bg-[#f8fafc] text-zinc-950">
      {initialData && (
        <div className="h-screen">
          <Excalidraw
            theme={theme}
            initialData={{
              ...initialData,
              scrollToContent: false,
            }}
            onChange={handleChange}
          />
        </div>
      )}

      <div className="pointer-events-none absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md border border-zinc-200 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur">
        <span
          className={
            saveStatus === "error"
              ? "h-2 w-2 rounded-full bg-red-500"
              : saveStatus === "saving"
                ? "h-2 w-2 rounded-full bg-amber-500"
                : "h-2 w-2 rounded-full bg-emerald-500"
          }
        />
        <span>{statusText}</span>
      </div>

      {!isLoggedIn || !initialData ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
          >
            <h1 className="text-lg font-semibold">Whiteboard öffnen</h1>
            <label className="mt-4 block text-sm font-medium" htmlFor="app-secret">
              Passwort
            </label>
            <input
              id="app-secret"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
              disabled={isLoading}
            />
            {loginError ? <p className="mt-3 text-sm text-red-600">{loginError}</p> : null}
            <button
              type="submit"
              className="mt-5 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={isLoading}
            >
              {isLoading ? "Lädt..." : "Öffnen"}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
