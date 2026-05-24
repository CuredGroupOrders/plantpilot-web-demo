// src/state/selectors/actionStatus.ts
import { useActions } from "../actions";

export type ActionStatus = "queued" | "done" | string;

export function useActionStatus() {
  const list = useActions((s) => s.list);

  // Map by action ID (not chipId).
  const map = new Map<string, ActionStatus>(
    list.map((a) => [a.id, (a as any).status as ActionStatus])
  );

  const counts = {
    queued: list.filter((a) => (a as any).status === "queued").length,
    done: list.filter((a) => (a as any).status === "done").length,
    total: list.length,
  };

  return {
    get: (id: string): ActionStatus | undefined => map.get(id),
    counts,
  };
}
