import { createWorld, simulateMonth, simulateRemainingSeason } from "./engine";
import type { WorldState } from "./model";
self.onmessage = (
  e: MessageEvent<{
    id: number;
    type: "create" | "month" | "skip";
    world?: WorldState;
    seed?: number;
  }>,
) => {
  const { id, type, world, seed } = e.data;
  try {
    self.postMessage({ id, progress: "12球団の戦況と成績を集計しています…" });
    self.postMessage({
      id,
      result:
        type === "create"
          ? createWorld(seed)
          : type === "skip"
            ? simulateRemainingSeason(world!)
            : simulateMonth(world!),
    });
  } catch (e) {
    self.postMessage({
      id,
      error: e instanceof Error ? e.message : "計算に失敗しました。",
    });
  }
};
