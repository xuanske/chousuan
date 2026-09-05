import { create } from "zustand";
import { fetchHistory, fetchQuotes, fetchScreener, interpretSetup } from "@/lib/quant/api";
import { runBacktest, tradeCost } from "@/lib/quant/backtest";
import { DEFAULT_WATCH, instrumentById } from "@/lib/quant/universe";
import type {
  BacktestResult,
  History,
  PaperBook,
  Quote,
  RangeKey,
  ScreenRow,
  StrategyId,
} from "@/lib/quant/types";

const WATCH_KEY = "chousuan.watch.v1";
const BOOK_KEY = "chousuan.book.v1";
const STARTING_CASH = 1_000_000;

function loadWatch(): string[] {
  if (typeof localStorage === "undefined") return DEFAULT_WATCH;
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string") && parsed.length) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WATCH;
}

function loadBook(): PaperBook {
  if (typeof localStorage === "undefined") return { cash: STARTING_CASH, positions: [], trades: [] };
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    const parsed = raw ? (JSON.parse(raw) as PaperBook) : null;
    if (parsed && typeof parsed.cash === "number" && Array.isArray(parsed.positions)) return parsed;
  } catch {
    /* ignore */
  }
  return { cash: STARTING_CASH, positions: [], trades: [] };
}

export type DeskTab = "chart" | "screen" | "backtest" | "paper";

type QuantState = {
  tab: DeskTab;
  id: string;
  range: RangeKey;
  strategy: StrategyId;
  watch: string[];
  quotes: Record<string, Quote>;
  history: History | null;
  screen: ScreenRow[];
  result: BacktestResult | null;
  book: PaperBook;
  insight: string | null;
  loading: boolean;
  screening: boolean;
  talking: boolean;
  error: string | null;
  tradeHint: string | null;
  setTab: (tab: DeskTab) => void;
  setId: (id: string) => void;
  setRange: (range: RangeKey) => void;
  setStrategy: (strategy: StrategyId) => void;
  toggleWatch: (id: string) => void;
  refreshQuotes: () => Promise<void>;
  loadBars: () => Promise<void>;
  loadScreen: () => Promise<void>;
  runStrategy: () => void;
  trade: (side: "buy" | "sell", shares: number) => void;
  resetBook: () => void;
  askInsight: () => Promise<void>;
};

export const useQuant = create<QuantState>((set, get) => ({
  tab: "chart",
  id: DEFAULT_WATCH[0]!,
  range: "1y",
  strategy: "ma-cross",
  watch: DEFAULT_WATCH,
  quotes: {},
  history: null,
  screen: [],
  result: null,
  book: { cash: STARTING_CASH, positions: [], trades: [] },
  insight: null,
  loading: false,
  screening: false,
  talking: false,
  error: null,
  tradeHint: null,

  setTab: (tab) => {
    set({ tab });
    if (tab === "screen" && get().screen.length === 0) void get().loadScreen();
  },
  setId: (id) => {
    set({ id, insight: null, result: null });
    void get().loadBars();
  },
  setRange: (range) => {
    set({ range, result: null });
    void get().loadBars();
  },
  setStrategy: (strategy) => {
    set({ strategy });
    get().runStrategy();
  },

  toggleWatch: (id) => {
    const watch = get().watch.includes(id)
      ? get().watch.filter((x) => x !== id)
      : [...get().watch, id];
    localStorage.setItem(WATCH_KEY, JSON.stringify(watch));
    set({ watch });
    void get().refreshQuotes();
  },

  refreshQuotes: async () => {
    try {
      const ids = [...new Set([...get().watch, get().id])];
      const rows = await fetchQuotes({ data: { ids } });
      const quotes: Record<string, Quote> = {};
      for (const row of rows) quotes[row.id] = row;
      set({ quotes, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "行情失败" });
    }
  },

  loadBars: async () => {
    set({ loading: true, error: null });
    try {
      const history = await fetchHistory({ data: { id: get().id, range: get().range } });
      set({ history, loading: false });
      get().runStrategy();
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "K线失败",
      });
    }
  },

  loadScreen: async () => {
    set({ screening: true });
    try {
      const screen = await fetchScreener();
      set({ screen, screening: false });
    } catch (err) {
      set({
        screening: false,
        error: err instanceof Error ? err.message : "筛选失败",
      });
    }
  },

  runStrategy: () => {
    const { history, strategy, id } = get();
    if (!history) return;
    set({ result: runBacktest(history.bars, strategy, id, instrumentById(id)) });
  },

  trade: (side, shares) => {
    const quote = get().quotes[get().id];
    const inst = instrumentById(get().id);
    if (!quote || !inst || shares <= 0) return;
    const lot = inst.market === "SH" || inst.market === "SZ" ? 100 : 1;
    if (shares % lot !== 0) {
      set({ tradeHint: `A 股按 ${lot} 股一手。请改手数。` });
      return;
    }
    const price = quote.price;
    const book = structuredClone(get().book);
    const pos = book.positions.find((p) => p.id === get().id);
    const today = new Date().toISOString().slice(0, 10);
    const tPlusOne = (inst.market === "SH" || inst.market === "SZ") && inst.kind === "stock";
    if (side === "buy") {
      const notional = shares * price;
      const fee = tradeCost("buy", notional, inst.market, inst.kind, { minCommission: true });
      const cost = notional + fee;
      if (cost > book.cash) {
        set({ tradeHint: "现金不足。" });
        return;
      }
      book.cash -= cost;
      if (pos) {
        const total = pos.shares + shares;
        pos.cost = (pos.cost * pos.shares + notional) / total;
        pos.shares = total;
        pos.lastBuyDay = today;
      } else {
        book.positions.push({ id: get().id, shares, cost: price, lastBuyDay: today });
      }
    } else {
      if (!pos || pos.shares < shares) {
        set({ tradeHint: "持仓不足。" });
        return;
      }
      if (tPlusOne && pos.lastBuyDay === today) {
        set({ tradeHint: "A 股股票 T+1：今天买的不能今天卖。场内 ETF 可以。" });
        return;
      }
      const notional = shares * price;
      const fee = tradeCost("sell", notional, inst.market, inst.kind, { minCommission: true });
      book.cash += Math.max(0, notional - fee);
      pos.shares -= shares;
      if (pos.shares <= 0) book.positions = book.positions.filter((p) => p.id !== get().id);
    }
    book.trades.unshift({
      t: Date.now(),
      id: get().id,
      side,
      shares,
      price,
    });
    book.trades = book.trades.slice(0, 40);
    localStorage.setItem(BOOK_KEY, JSON.stringify(book));
    set({ book, tradeHint: null });
  },

  resetBook: () => {
    const book = { cash: STARTING_CASH, positions: [], trades: [] };
    localStorage.setItem(BOOK_KEY, JSON.stringify(book));
    set({ book });
  },

  askInsight: async () => {
    const { history, result, quotes, id } = get();
    const inst = instrumentById(id);
    const q = quotes[id];
    if (!inst || !history) return;
    const last = history.bars[history.bars.length - 1];
    const first = history.bars[0];
    const span = first && last ? last.c / first.c - 1 : 0;
    const summary = [
      `最新价 ${q?.price ?? last?.c}`,
      `当日 ${((q?.changePct ?? 0) * 100).toFixed(2)}%`,
      `区间涨跌 ${(span * 100).toFixed(1)}%`,
      result
        ? `策略 ${result.strategy} 收益 ${(result.totalReturn * 100).toFixed(1)}% 回撤 ${(result.maxDrawdown * 100).toFixed(1)}% 夏普 ${result.sharpe.toFixed(2)}`
        : "",
    ]
      .filter(Boolean)
      .join("；");
    set({ talking: true, insight: null });
    try {
      const res = await interpretSetup({ data: { id, summary } });
      set({
        talking: false,
        insight: res.ok ? res.text : res.error,
      });
    } catch {
      set({ talking: false, insight: "解读失败" });
    }
  },
}));

export function hydrateQuant() {
  useQuant.setState({ watch: loadWatch(), book: loadBook() });
}
