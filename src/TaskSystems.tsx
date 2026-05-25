// Root-owned task system with overlay, fetch/SSE intercepts, and submit-gate.
// Theme: uses your vars (--panel, --ink, --cy, --border). Progress ramps to 92% in >=15s.
// Cockpit loader video (submit) and intake loader video (config apply) render above the progress bar.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

type TaskOptions = {
  title?: string;
  message?: string;
  cancellable?: boolean;
};
type Reporter = { progress: (ratio: number | null, message?: string) => void };
type RunTask = <T>(
  opts: TaskOptions,
  fn: (report: Reporter, signal: AbortSignal) => Promise<T>
) => Promise<T>;
type Matcher = string | RegExp;
type AutoRule = Matcher[] | ((url: string) => boolean);

type TaskState = {
  open: boolean;
  title: string;
  message?: string;
  ratio: number | null;
  cancellable: boolean;
  cancel?: () => void;
};

const Ctx = createContext<{ run: RunTask } | null>(null);

const toUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  try {
    return (input as Request).url;
  } catch {
    return String(input);
  }
};
const match = (url: string, rule?: AutoRule): boolean => {
  if (!rule) return false;
  if (typeof rule === "function") return !!rule(url);
  return (rule as Matcher[]).some((m) =>
    typeof m === "string" ? url.includes(m) : m.test(url)
  );
};

export function TaskProvider({
  children,
  sseMatch = [/\/api\/cockpit\/progress\b/i],
  autoTitle = "Calculating",
  autoMessage = "Initializing Cockpit"
}: {
  children: React.ReactNode;
  sseMatch?: AutoRule;
  autoTitle?: string;
  autoMessage?: string;
}) {
  const [state, setState] = useState<TaskState>({
    open: false,
    title: "Working",
    message: "Please wait",
    ratio: null,
    cancellable: false,
  });

  const lastActive = useRef<HTMLElement | null>(null);
  const cssInjected = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Gate: only open overlay after an actual submit/calc gesture.
  const armedAt = useRef<number>(0);
  useEffect(() => {
    const arm = () => {
      armedAt.current = performance.now();
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(
        "button, input[type=submit], [role='button'], a"
      ) as HTMLElement | null;
      if (!el) return;
      const isSubmitType =
        (el instanceof HTMLButtonElement && el.type === "submit") ||
        (el instanceof HTMLInputElement && el.type === "submit");
      const txt = (el.textContent || "").toLowerCase();
      if (isSubmitType || /submit|calculate/.test(txt)) arm();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") arm();
    };

    document.addEventListener("submit", arm, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("submit", arm, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, []);

  // Inject CSS once. Uses your theme vars.
  useEffect(() => {
    if (cssInjected.current) return;
    const id = "task-systems-css";
    if (document.getElementById(id)) {
      cssInjected.current = true;
      return;
    }
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
:root{
  --ts-bg: var(--bg, #000);
  --ts-panel: var(--panel, rgba(5,9,11,.49));
  --ts-ink: var(--ink, #00f7db);
  --ts-cy: var(--cy, #00f7db);
  --ts-border: var(--border, #00f7db);
  --ts-radius: 12px;
  --ts-gap: 16px;
  --ts-shadow: 0 10px 30px rgba(0,0,0,.6);
}
.task-overlay{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(8px) saturate(110%);
  display: grid; place-items: center;
  z-index: 9999;
}
.task-panel{
  width: min(520px, 92vw);
  background: var(--ts-panel);
  color: var(--ts-ink);
  border: 1px solid var(--ts-border);
  border-radius: var(--ts-radius);
  box-shadow: var(--ts-shadow);
  padding: calc(var(--ts-gap) * 1.25);
  outline: none;
}
.task-header{
  display: grid; grid-template-columns: 40px 1fr;
  align-items: center; gap: var(--ts-gap);
  margin-bottom: var(--ts-gap);
}
.task-title{ font: 700 1.05rem/1.2 system-ui, sans-serif; letter-spacing:.02em }
.task-sub{ opacity:.9; font-size:.9rem; }

.task-spinner{
  width: 32px; height: 32px; border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--ts-cy) 35%, transparent);
  border-top-color: var(--ts-cy);
  animation: ts-spin .9s linear infinite;
}
@keyframes ts-spin{ to { transform: rotate(360deg) } }

/* video container above the progress bar */
.task-media{
  margin-bottom: 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--ts-cy) 40%, transparent);
  overflow: hidden;
  background: color-mix(in srgb, var(--ts-ink) 8%, transparent);
}
.task-media video{
  display: block;
  width: 100%;
  height: auto;
}

.task-progress{ display: grid; gap: 8px; }
.task-bar{
  height: 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--ts-ink) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ts-cy) 40%, transparent);
  overflow: hidden;
}
.task-bar-fill{
  height: 100%;
  background: var(--ts-cy);
  box-shadow:
    0 0 16px color-mix(in srgb, var(--ts-cy) 60%, transparent),
    0 0 36px color-mix(in srgb, var(--ts-cy) 40%, transparent);
  transform: translateZ(0);
  transition: width .18s linear;
}
.task-pct{ font-size: .85rem; opacity:.9; text-align: right; }

.task-bar--indeterminate{ position: relative; overflow: hidden; }
.task-bar--indeterminate .indet{
  position: absolute; inset: 0; width: 45%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ts-cy) 50%, transparent), transparent);
  animation: ts-slide 1.2s ease-in-out infinite;
}
@keyframes ts-slide{ 0%{ transform: translateX(-60%) } 50%{ transform: translateX(60%) } 100%{ transform: translateX(160%) } }

.task-cancel{
  margin-top: calc(var(--ts-gap) * 1.25); width: 100%;
  border: 1px solid color-mix(in srgb, var(--ts-cy) 60%, transparent);
  background: transparent; color: var(--ts-ink);
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
}
.task-cancel:hover{ background: color-mix(in srgb, var(--ts-cy) 18%, transparent); }
`;
    document.head.appendChild(style);
    cssInjected.current = true;
  }, []);

  // Lock scroll when open
  useEffect(() => {
    if (!state.open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [state.open]);

  // Focus trap
  useEffect(() => {
    if (!state.open) return;
    lastActive.current = document.activeElement as HTMLElement;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.cancellable && state.cancel) state.cancel();
      if (e.key !== "Tab") return;
      const root = panelRef.current ?? document.body;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button,textarea,input,select,[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastActive.current?.focus?.();
    };
  }, [state.open, state.cancellable, state.cancel]);

  // Public run()
  const run: RunTask = useCallback(async (opts, fn) => {
    const ctrl = new AbortController();
    const reporter: Reporter = {
      progress: (ratio, message) =>
        setState((s) => ({
          ...s,
          ratio: ratio ?? null,
          message: message ?? s.message
        }))
    };
    return new Promise(async (resolve, reject) => {
      const close = () =>
        setState((s) => ({
          ...s,
          open: false,
          ratio: null,
          cancel: undefined
        }));
      setState({
        open: true,
        title: opts.title ?? "Working",
        message: opts.message ?? "Please wait",
        ratio: null,
        cancellable: !!opts.cancellable,
        cancel: opts.cancellable
          ? () => {
              ctrl.abort();
              close();
            }
          : undefined,
      });
      try {
        const out = await fn(reporter, ctrl.signal);
        close();
        resolve(out);
      } catch (err) {
        close();
        reject(err);
      }
    });
  }, []);

  // Fetch intercept: ONLY wrap /gas?mode=evaluate&apply=1 right after a submit/calc gesture.
  useEffect(() => {
    const orig = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = toUrl(input);

      // Tight URL check: /gas?mode=evaluate&apply=1
      let isEvaluateApply1 = false;
      try {
        const u = new URL(url, window.location.origin);
        isEvaluateApply1 =
          u.pathname === "/gas" &&
          u.searchParams.get("mode") === "evaluate" &&
          u.searchParams.get("apply") === "1";
      } catch {
        isEvaluateApply1 =
          /\/gas\?[^#]*\bmode=evaluate\b[^#]*\bapply=1\b/i.test(url);
      }

      const recentlyArmed = performance.now() - armedAt.current < 1500;

      if (!(recentlyArmed && isEvaluateApply1)) {
        return orig(input as any, init);
      }

      const DURATION_TO_92 = 15000; // ms
      const START = 0.06;
      const TARGET = 0.92;

      return run(
        {
          title: autoTitle,
          message: autoMessage,
          cancellable: false,
        },
        async (report) => {
          const startTs = performance.now();
          report.progress(START);
          const id = setInterval(() => {
            const t = performance.now() - startTs;
            const k = Math.min(1, t / DURATION_TO_92);
            const eased = 1 - Math.pow(1 - k, 1.7);
            const ratio = START + (TARGET - START) * eased;
            report.progress(ratio);
          }, 200);

          try {
            const res = await orig(input as any, init);
            report.progress(1);
            return res as any;
          } finally {
            clearInterval(id);
          }
        }
      );
    };

    return () => {
      window.fetch = orig;
    };
  }, [autoTitle, autoMessage, run]);

  // EventSource intercept: only if armed and URL matches your progress stream.
  useEffect(() => {
    const OrigES = window.EventSource;
    function WrappedES(this: any, url: string | URL, init?: EventSourceInit) {
      const href = typeof url === "string" ? url : url.toString();
      const es = new OrigES(url as any, init);

      const recentlyArmed = performance.now() - armedAt.current < 1500;
      if (recentlyArmed && match(href, sseMatch)) {
        setState((s) =>
          s.open
            ? s
            : {
                open: true,
                title: autoTitle,
                message: autoMessage,
                ratio: null,
                cancellable: false,
              }
        );

        const onAny = (ev: MessageEvent) => {
          try {
            const data = JSON.parse(ev.data);
            const ratio =
              typeof data.ratio === "number"
                ? data.ratio
                : typeof data.progress === "number"
                ? data.progress
                : null;
            const msg = data.message ?? data.status ?? undefined;
            if (ratio !== null)
              setState((s) => ({ ...s, ratio, message: msg ?? s.message }));
          } catch {}
        };
        const close = () =>
          setState((s) => ({
            ...s,
            open: false,
            ratio: null,
            cancel: undefined
          }));

        es.addEventListener("progress", onAny);
        es.addEventListener("message", onAny);
        es.addEventListener("done", () => {
          cleanup();
          close();
        });
        es.addEventListener("error", () => {
          cleanup();
          close();
        });

        const cleanup = () => {
          es.removeEventListener("progress", onAny);
          es.removeEventListener("message", onAny);
        };
      }

      return es;
    }
    // @ts-ignore
    WrappedES.prototype = OrigES.prototype;
    // @ts-ignore
    window.EventSource = WrappedES;
    return () => {
      // @ts-ignore
      window.EventSource = OrigES;
    };
  }, [sseMatch, autoTitle, autoMessage]);

  const value = useMemo(() => ({ run }), [run]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state.open &&
        createPortal(
          <div
            className="task-overlay"
            role="dialog"
            aria-modal="true"
            aria-busy="true"
            aria-label={state.title}
          >
            <div className="task-panel" ref={panelRef} tabIndex={-1}>
              <div className="task-header">
                <div className="task-spinner" aria-hidden="true" />
                <div>
                  <div className="task-title">{state.title}</div>
                  <div className="task-sub">{state.message}</div>
                </div>
              </div>

              <div className="task-progress" aria-live="polite">
                {typeof state.ratio === "number" ? (
                  <>
                    <div className="task-bar">
                      <div
                        className="task-bar-fill"
                        style={{
                          width: `${
                            Math.max(0, Math.min(1, state.ratio)) * 100
                          }%`
                        }}
                      />
                    </div>
                    <div className="task-pct">
                      {Math.round(state.ratio * 100)}%
                    </div>
                  </>
                ) : (
                  <div className="task-bar task-bar--indeterminate">
                    <div className="indet" />
                  </div>
                )}
              </div>

              {state.cancellable && state.cancel && (
                <button className="task-cancel" onClick={state.cancel}>
                  Cancel
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </Ctx.Provider>
  );
}

export function useTask(): { run: RunTask } {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTask must be used within <TaskProvider>");
  return ctx;
}
