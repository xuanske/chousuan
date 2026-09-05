import { createServerFn } from "@tanstack/react-start";
import { snapshotStats } from "./backtest";
import { loadHistories, loadHistoryFor, loadQuotesFor } from "./yahoo";
import type { RangeKey, ScreenRow } from "./types";
import { instrumentById, UNIVERSE } from "./universe";

export const fetchQuotes = createServerFn({ method: "POST" })
  .validator((input: { ids: string[] }) => input)
  .handler(async ({ data }) => {
    return loadQuotesFor(data.ids);
  });

export const fetchHistory = createServerFn({ method: "POST" })
  .validator((input: { id: string; range: RangeKey }) => input)
  .handler(async ({ data }) => {
    return loadHistoryFor(data.id, data.range);
  });

export const fetchScreener = createServerFn({ method: "POST" })
  .handler(async () => {
    const pack = await loadHistories(
      UNIVERSE.map((i) => i.id),
      "1y",
    );
    const rows: ScreenRow[] = [];
    for (const hist of pack) {
      const inst = instrumentById(hist.id);
      if (!inst) continue;
      const stats = snapshotStats(hist.bars);
      const last = hist.bars[hist.bars.length - 1];
      const prev = hist.bars[hist.bars.length - 2];
      if (!stats || !last || !prev) continue;
      const changePct = prev.c ? last.c / prev.c - 1 : 0;
      const score =
        (Number.isFinite(stats.mom20) ? stats.mom20 * 40 : 0) +
        (Number.isFinite(stats.mom60) ? stats.mom60 * 20 : 0) -
        (Number.isFinite(stats.vol20) ? stats.vol20 * 8 : 0) +
        (Number.isFinite(stats.rsi) && stats.rsi < 35 ? 6 : 0) +
        (Number.isFinite(stats.maBias) ? stats.maBias * 15 : 0);
      rows.push({
        id: inst.id,
        name: inst.name,
        kind: inst.kind,
        sector: inst.sector,
        price: last.c,
        changePct,
        mom20: stats.mom20,
        mom60: stats.mom60,
        rsi: stats.rsi,
        vol20: stats.vol20,
        drawdown: stats.drawdown,
        maBias: stats.maBias,
        score,
        source: hist.source,
      });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows;
  });

export const interpretSetup = createServerFn({ method: "POST" })
  .validator((input: { id: string; summary: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "解读暂不可用" };
    const inst = instrumentById(data.id);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content:
              "你是量化研究员。用简体中文、不超过 180 字，解读给定标的的量价与因子。不要给出买入/卖出指令，注明不是投资建议。",
          },
          {
            role: "user",
            content: `${inst?.name ?? data.id}\n${data.summary}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: "解读失败" };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
  });
