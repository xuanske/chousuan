import { annualized, ema, lastFinite, maxDrawdown, returns, rsi, sharpe, sma, stdev } from "./indicators.ts";
import type { AssetKind, BacktestResult, BacktestTrade, Bar, Instrument, Market, StrategyId } from "./types.ts";

const COMMISSION = 0.00025;
const COMMISSION_MIN = 5;
const STAMP = 0.0005;
const TRANSFER = 0.00001;
const SLIPPAGE = 0.0005;

export function limitPct(id: string, market: Market, kind: AssetKind): number {
  if (market !== "SH" && market !== "SZ") return Number.POSITIVE_INFINITY;
  if (/^(300|301)/.test(id)) return 0.2;
  if (/^(688|689)/.test(id)) return 0.2;
  if (/^(8|4)\d{5}$/.test(id)) return 0.3;
  if (kind === "etf" && (/^(1599|588)/.test(id) || id === "159915")) return 0.2;
  return 0.1;
}

export function tradeCost(
  side: "buy" | "sell",
  notional: number,
  market: Market,
  kind: AssetKind,
  opts?: { minCommission?: boolean },
): number {
  const aShare = market === "SH" || market === "SZ";
  let comm = notional * COMMISSION;
  if (opts?.minCommission && aShare) comm = Math.max(comm, COMMISSION_MIN);
  const stamp = side === "sell" && kind === "stock" && aShare ? notional * STAMP : 0;
  const transfer = aShare ? notional * TRANSFER : 0;
  return comm + stamp + transfer;
}

export function snapshotStats(bars: Bar[]) {
  if (bars.length < 62) return null;
  const px = bars.map((b) => b.c);
  const last = px[px.length - 1]!;
  const prev20 = px[px.length - 21];
  const prev60 = px[px.length - 61];
  const r = rsi(px, 14);
  const ma20 = sma(px, 20);
  const dayRet = returns(px, 1);
  const vol = stdev(
    dayRet.map((v) => (Number.isFinite(v) ? v : 0)),
    20,
  );
  return {
    mom20: prev20 ? last / prev20 - 1 : NaN,
    mom60: prev60 ? last / prev60 - 1 : NaN,
    rsi: lastFinite(r),
    vol20: lastFinite(vol),
    drawdown: maxDrawdown(px),
    maBias: lastFinite(ma20) ? last / lastFinite(ma20) - 1 : NaN,
  };
}

export function isFillBlocked(bars: Bar[], i: number, inst?: Instrument): boolean {
  const market = inst?.market ?? "SH";
  const kind = inst?.kind ?? "stock";
  const id = inst?.id ?? "";
  if (market !== "SH" && market !== "SZ") return false;
  if (i <= 0) return false;
  const b = bars[i]!;
  if (b.v === 0) return true;
  const prev = bars[i - 1]!.c;
  if (!prev) return false;
  const lim = limitPct(id, market, kind);
  if (!Number.isFinite(lim)) return false;
  const chg = Math.max(Math.abs(b.o / prev - 1), Math.abs(b.c / prev - 1));
  const range = (b.h - b.l) / prev;
  return chg + 1e-6 >= lim * 0.95 && range < 0.012;
}

function slip(price: number, side: "buy" | "sell"): number {
  return side === "buy" ? price * (1 + SLIPPAGE) : price * (1 - SLIPPAGE);
}

export function runBacktest(bars: Bar[], strategy: StrategyId, id: string, inst?: Instrument): BacktestResult | null {
  if (bars.length < 80) return null;
  const market = inst?.market ?? "SH";
  const kind = inst?.kind ?? "stock";
  const aShareStock = (market === "SH" || market === "SZ") && kind === "stock";
  const px = bars.map((b) => b.c);
  const ma10 = sma(px, 10);
  const ma20 = sma(px, 20);
  const ma30 = sma(px, 30);
  const ma60 = sma(px, 60);
  const r = rsi(px, 14);
  const mom = returns(px, 20);

  let cash = 1;
  let shares = 0;
  let peak = 0;
  let lastBuyFill = -1;
  let pending: { side: "buy" | "sell"; note: string } | null = null;
  const trades: BacktestTrade[] = [];
  const equity: BacktestResult["equity"] = [];
  const daily: number[] = [];
  let investedDays = 0;
  const startPx = px[0]!;

  function lastN(values: number[], i: number): number {
    const v = values[i];
    return Number.isFinite(v) ? (v as number) : NaN;
  }

  function fill(i: number, side: "buy" | "sell", note: string) {
    if (isFillBlocked(bars, i, inst ?? { id, yahoo: id, name: id, kind, market, sector: "" })) return false;
    const raw = bars[i]!.o || px[i]!;
    if (!(raw > 0)) return false;
    const price = slip(raw, side);
    if (side === "buy") {
      if (shares > 0) return false;
      const cost = tradeCost("buy", cash, market, kind);
      const spend = Math.max(0, cash - cost);
      shares = spend / price;
      cash = 0;
      peak = price;
      lastBuyFill = i;
      trades.push({ t: bars[i]!.t, side: "buy", price, shares, note });
      return true;
    }
    if (shares <= 0) return false;
    if (aShareStock && i <= lastBuyFill) return false;
    const gross = shares * price;
    const cost = tradeCost("sell", gross, market, kind);
    cash = Math.max(0, gross - cost);
    trades.push({ t: bars[i]!.t, side: "sell", price, shares, note });
    shares = 0;
    peak = 0;
    return true;
  }

  function signal(i: number) {
    const price = px[i]!;
    if (shares > 0) peak = Math.max(peak, price);

    if (strategy === "ma-cross") {
      const a = lastN(ma20, i);
      const b = lastN(ma60, i);
      const pa = lastN(ma20, i - 1);
      const pb = lastN(ma60, i - 1);
      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(pa) && Number.isFinite(pb)) {
        if (pa <= pb && a > b) return { side: "buy" as const, note: "MA20 上穿 MA60" };
        if (pa >= pb && a < b) return { side: "sell" as const, note: "MA20 下穿 MA60" };
      }
    } else if (strategy === "rsi-revert") {
      const cur = lastN(r, i);
      if (Number.isFinite(cur)) {
        if (cur < 30) return { side: "buy" as const, note: `RSI ${cur.toFixed(0)}` };
        if (cur > 70) return { side: "sell" as const, note: `RSI ${cur.toFixed(0)}` };
      }
    } else if (strategy === "momentum") {
      const m = lastN(mom, i);
      if (Number.isFinite(m)) {
        if (m > 0.05) return { side: "buy" as const, note: `20日 ${(m * 100).toFixed(1)}%` };
        if (m < 0) return { side: "sell" as const, note: "动量转负" };
      }
    } else if (strategy === "dual-stop") {
      const a = lastN(ma10, i);
      const b = lastN(ma30, i);
      const pa = lastN(ma10, i - 1);
      const pb = lastN(ma30, i - 1);
      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(pa) && Number.isFinite(pb)) {
        if (pa <= pb && a > b) return { side: "buy" as const, note: "MA10 上穿 MA30" };
        if (pa >= pb && a < b) return { side: "sell" as const, note: "均线死叉" };
      }
      if (shares > 0 && peak > 0 && price <= peak * 0.92) return { side: "sell" as const, note: "回撤 8% 止损" };
    }
    return null;
  }

  function mark(i: number) {
    const value = cash + shares * px[i]!;
    const bench = px[i]! / startPx;
    equity.push({ t: bars[i]!.t, value, bench });
    if (equity.length > 1) {
      const prev = equity[equity.length - 2]!.value;
      daily.push(prev ? value / prev - 1 : 0);
    }
    if (shares > 0) investedDays += 1;
  }

  for (let i = 0; i < bars.length; i++) {
    if (pending) {
      fill(i, pending.side, pending.note);
      pending = null;
    }
    const sig = signal(i);
    if (sig) pending = sig;
    mark(i);
  }

  if (shares > 0) fill(bars.length - 1, "sell", "期末平仓");

  const end = equity[equity.length - 1]?.value ?? 1;
  const totalReturn = end - 1;
  const benchReturn = px[px.length - 1]! / startPx - 1;
  const days = Math.max(1, (bars[bars.length - 1]!.t - bars[0]!.t) / 86_400_000);
  const years = Math.max(days / 365, 1 / 12);
  const roundTrips = trades.filter((t) => t.side === "sell");
  let wins = 0;
  for (let i = 0; i < trades.length - 1; i++) {
    if (trades[i]!.side === "buy" && trades[i + 1]!.side === "sell") {
      const buyPx = trades[i]!.price;
      const sellPx = trades[i + 1]!.price;
      const buyFee = tradeCost("buy", buyPx, market, kind) / Math.max(buyPx, 1e-9);
      const sellFee = tradeCost("sell", sellPx, market, kind) / Math.max(sellPx, 1e-9);
      if (sellPx * (1 - sellFee) > buyPx * (1 + buyFee)) wins += 1;
    }
  }
  const ann = annualized(totalReturn, days);
  const mdd = maxDrawdown(equity.map((e) => e.value));

  return {
    strategy,
    id,
    start: bars[0]!.t,
    end: bars[bars.length - 1]!.t,
    equity,
    trades,
    totalReturn,
    benchReturn,
    annualized: ann,
    maxDrawdown: mdd,
    sharpe: sharpe(daily),
    calmar: mdd < 0 ? ann / Math.abs(mdd) : 0,
    winRate: roundTrips.length ? wins / roundTrips.length : 0,
    tradesCount: roundTrips.length,
    exposure: investedDays / bars.length,
    turnover: roundTrips.length / years,
  };
}

export function chartSeries(bars: Bar[]) {
  const px = bars.map((b) => b.c);
  const ma20 = sma(px, 20);
  const ma60 = sma(px, 60);
  const r = rsi(px, 14);
  const e12 = ema(px, 12);
  const e26 = ema(px, 26);
  const macd = px.map((_, i) =>
    Number.isFinite(e12[i]) && Number.isFinite(e26[i]) ? e12[i]! - e26[i]! : NaN,
  );
  const signal = ema(macd.map((v) => (Number.isFinite(v) ? v : 0)), 9);
  return bars.map((b, i) => ({
    t: b.t,
    o: b.o,
    h: b.h,
    l: b.l,
    c: b.c,
    v: b.v,
    ma20: ma20[i],
    ma60: ma60[i],
    rsi: r[i],
    macd: macd[i],
    signal: signal[i],
    lastFinite: lastFinite(px),
  }));
}
