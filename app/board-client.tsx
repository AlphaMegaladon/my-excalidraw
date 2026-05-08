"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@excalidraw/excalidraw/index.css";

import type { FormEvent } from "react";
import type {
  ExcalidrawInitialDataState,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";

const STORAGE_KEY = "my-excalidraw-app-secret";
const SAVE_DELAY_MS = 2_000;

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

type OnChange = NonNullable<ExcalidrawProps["onChange"]>;
type SceneSnapshot = {
  elements: Parameters<OnChange>[0];
  appState: Parameters<OnChange>[1];
  files: Parameters<OnChange>[2];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

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

function buildAuthHeaders(secret: string) {
  return {
    Authorization: `Bearer ${secret}`,
  };
}

export default function BoardClient() {
  const [secret, setSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [initialData, setInitialData] = useState<BoardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSceneRef = useRef<SceneSnapshot | null>(null);
  const hasLoadedSecretRef = useRef(false);

  const isLoggedIn = secret.length > 0;

  const clearSavedSecret = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSecret("");
    setPasswordInput("");
    setInitialData(null);
    latestSceneRef.current = null;
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

        const payload = normalizeBoardPayload(await response.json());

        if (!payload) {
          setLoginError("Die gespeicherten Board-Daten haben ein unerwartetes Format.");
          return;
        }

        setInitialData(payload);
        setSaveStatus("saved");
      } catch {
        setLoginError("Das Board konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    },
    [clearSavedSecret],
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

  const saveBoard = useCallback(
    async (payload: BoardPayload) => {
      if (!secret) {
        return;
      }

      setSaveStatus("saving");
      setSaveError("");

      try {
        const response = await fetch("/api/board", {
          method: "POST",
          headers: {
            ...buildAuthHeaders(secret),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401) {
          clearSavedSecret();
          setLoginError("Deine Sitzung ist abgelaufen. Bitte erneut anmelden.");
          setSaveStatus("error");
          return;
        }

        if (!response.ok) {
          throw new Error("Save failed");
        }

        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
        setSaveError("Änderungen konnten nicht gespeichert werden.");
      }
    },
    [clearSavedSecret, secret],
  );

  const buildPayloadFromScene = useCallback(async (scene: SceneSnapshot) => {
    const { serializeAsJSON } = await import("@excalidraw/excalidraw");
    const serialized = serializeAsJSON(scene.elements, scene.appState, scene.files, "local");
    const payload = normalizeBoardPayload(JSON.parse(serialized));

    if (!payload) {
      throw new Error("Unexpected serialized scene shape");
    }

    return payload;
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
            initialData={{
              ...initialData,
              scrollToContent: true,
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
