import type { Bar, DataSource, History, Quote, RangeKey } from "./types";
import { instrumentById } from "./universe";

const TTL = 90_000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.value as T);
  return load().then((value) => {
    const source = value && typeof value === "object" ? (value as { source?: DataSource }).source : undefined;
    if (source !== "sample") cache.set(key, { at: Date.now(), value });
    return value;
  });
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

type YahooChart = {
  chart?: {
    result?: {
      timestamp?: number[];
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
      };
      indicators?: {
        quote?: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
  };
};

async function fetchChart(yahoo: string, range: string): Promise<YahooChart> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=${range}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`行情 ${res.status}`);
  return (await res.json()) as YahooChart;
}

function parseBars(data: YahooChart): Bar[] {
  const result = data.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];
  const bars: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q?.open?.[i];
    const h = q?.high?.[i];
    const l = q?.low?.[i];
    const c = q?.close?.[i];
    const v = q?.volume?.[i];
    if (![o, h, l, c].every((x) => typeof x === "number" && Number.isFinite(x))) continue;
    bars.push({
      t: ts[i]! * 1000,
      o: o as number,
      h: h as number,
      l: l as number,
      c: c as number,
      v: typeof v === "number" ? v : 0,
    });
  }
  return bars;
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function sampleBars(id: string, n: number): Bar[] {
  let s = hash(id) || 1;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const bars: Bar[] = [];
  let price = 20 + (hash(id) % 80);
  const now = Date.now();
  for (let i = n; i >= 0; i--) {
    const shock = (rand() - 0.48) * 0.03;
    price = Math.max(1, price * (1 + 0.00015 + shock));
    const o = price * (1 + (rand() - 0.5) * 0.01);
    const c = price;
    const h = Math.max(o, c) * (1 + rand() * 0.012);
    const l = Math.min(o, c) * (1 - rand() * 0.012);
    bars.push({
      t: now - i * 86_400_000,
      o,
      h,
      l,
      c,
      v: Math.round(1e6 + rand() * 8e6),
    });
  }
  return bars;
}

function quoteFromBars(id: string, bars: Bar[], source: DataSource): Quote | null {
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  return {
    id,
    price: last.c,
    prev: prev.c,
    changePct: prev.c ? last.c / prev.c - 1 : 0,
    high: last.h,
    low: last.l,
    volume: last.v,
    updatedAt: last.t,
    source,
  };
}

export async function loadHistoryFor(id: string, range: RangeKey): Promise<History> {
  return cached(`h:${id}:${range}`, async () => {
    const inst = instrumentById(id);
    if (!inst) throw new Error("未知标的");
    try {
      const data = await fetchChart(inst.yahoo, range);
      const bars = parseBars(data);
      if (bars.length < 15) throw new Error("K线不足");
      return { id, bars, source: "live" as const };
    } catch {
      const n = range === "5y" ? 800 : range === "2y" ? 400 : range === "1y" ? 250 : range === "6mo" ? 130 : 70;
      return { id, bars: sampleBars(id, n), source: "sample" as const };
    }
  });
}

export async function loadQuoteFor(id: string): Promise<Quote | null> {
  return cached(`q:${id}`, async () => {
    const hist = await loadHistoryFor(id, "3mo");
    return quoteFromBars(id, hist.bars, hist.source);
  });
}

export async function loadQuotesFor(ids: string[]): Promise<Quote[]> {
  const unique = [...new Set(ids)];
  const rows = await mapPool(unique, 4, (id) => loadQuoteFor(id));
  return rows.filter((x): x is Quote => Boolean(x));
}

export async function loadHistories(ids: string[], range: RangeKey): Promise<History[]> {
  return mapPool([...new Set(ids)], 4, (id) => loadHistoryFor(id, range));
}
