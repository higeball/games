import { useEffect, useState } from "react";
import { PHASE_NAMES, money, type WorldState } from "./model";
import {
  SAVE_SLOTS,
  listSaveSlots,
  loadWorldSlot,
  saveWorldSlot,
  type SaveSlotInfo,
} from "./storage";
import { ConfirmDialog } from "./ConfirmDialog";

export function SaveSlotsPanel({
  w,
  onLoad,
}: {
  w: WorldState | null;
  onLoad: (next: WorldState) => Promise<void>;
}) {
  const [slots, setSlots] = useState<Array<SaveSlotInfo | null>>([
    null,
    null,
    null,
  ]);
  const [ready, setReady] = useState(false),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{
    slot: number;
    action: "save" | "load";
  } | null>(null);
  useEffect(() => {
    let active = true;
    listSaveSlots()
      .then((list) => {
        if (active) {
          setSlots(list);
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setMessage(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const run = async (
    slot: number,
    action: "save" | "load",
    overwrite = false,
  ) => {
    setConfirm(null);
    setWorking(true);
    setMessage("");
    try {
      if (action === "save") {
        if (!w) throw Error("プレイを始めてからセーブしてください。");
        await saveWorldSlot(slot, w, overwrite);
        setSlots(await listSaveSlots());
        setMessage(`セーブ${slot}に保存しました。`);
      } else await onLoad(await loadWorldSlot(slot));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="save-slots-panel" aria-label="3つのセーブ枠">
      <h3>セーブ枠（3つ）</h3>
      <p className="muted">
        手動セーブは自動保存とは別に残ります。このブラウザ内の保存です。端末移動には書き出しをご利用ください。
      </p>
      {SAVE_SLOTS.map((slot) => {
        const info = slots[slot - 1];
        return (
          <article className="save-slot" key={slot}>
            <h4>
              セーブ{slot}{" "}
              <small>
                {!ready ? "読み込み中" : info ? "保存済み" : "空き"}
              </small>
            </h4>
            {info && (
              <p>
                {info.damaged ? (
                  "データを読み込めません。上書きは可能です。"
                ) : (
                  <>
                    {info.year}年 · {PHASE_NAMES[info.phase]}
                    <br />
                    資金 {money(info.cash)}
                    <br />
                    <small>
                      {new Date(info.savedAt).toLocaleString("ja-JP")}
                    </small>
                  </>
                )}
              </p>
            )}
            <div className="inline-actions">
              <button
                disabled={!w || !ready || working}
                onClick={() =>
                  info
                    ? setConfirm({ slot, action: "save" })
                    : void run(slot, "save")
                }
              >
                セーブ{slot}に保存
              </button>
              <button
                disabled={!info || !!info.damaged || !ready || working}
                onClick={() =>
                  w
                    ? setConfirm({ slot, action: "load" })
                    : void run(slot, "load")
                }
              >
                セーブ{slot}をロード
              </button>
            </div>
          </article>
        );
      })}
      {working && <p>セーブデータを処理しています…</p>}
      {message && <p className="notice">{message}</p>}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.action === "save"
              ? "セーブを上書きしますか？"
              : "セーブをロードしますか？"
          }
          confirmLabel={
            confirm.action === "save" ? "上書きして保存" : "ロードする"
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => void run(confirm.slot, confirm.action, true)}
        >
          <p>
            {confirm.action === "save"
              ? `セーブ${confirm.slot}を現在のプレイで置き換えます。他の枠と自動セーブは変更しません。`
              : `セーブ${confirm.slot}から再開します。現在のプレイは自動セーブのバックアップに残ります。手動セーブ枠は変更しません。`}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
