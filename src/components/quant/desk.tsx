import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chartSeries } from "@/lib/quant/backtest";
import { formatCompact, formatCny, formatDate, formatDateLong, formatPct, formatPrice, toneClass } from "@/lib/quant/format";
import { RANGE_OPTIONS, STRATEGIES, UNIVERSE, instrumentById } from "@/lib/quant/universe";
import { cn } from "@/lib/utils";
import { hydrateQuant, useQuant, type DeskTab } from "@/store/quant";
import { LogoMark } from "./logo";

const TABS: { id: DeskTab; label: string }[] = [
  { id: "chart", label: "行情" },
  { id: "screen", label: "因子" },
  { id: "backtest", label: "回测" },
  { id: "paper", label: "模拟盘" },
];

export function Desk() {
  const tab = useQuant((s) => s.tab);
  const setTab = useQuant((s) => s.setTab);
  const refreshQuotes = useQuant((s) => s.refreshQuotes);
  const loadBars = useQuant((s) => s.loadBars);
  const error = useQuant((s) => s.error);

  useEffect(() => {
    hydrateQuant();
    void refreshQuotes();
    void loadBars();
    const tick = () => {
      if (document.visibilityState === "visible") void refreshQuotes();
    };
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refreshQuotes, loadBars]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <div className="font-display text-lg font-medium leading-none tracking-tight">筹算</div>
              <div className="mt-1 text-[11px] tracking-wide text-muted-foreground">股票 · ETF 量化台</div>
            </div>
          </div>
          <nav className="flex w-full gap-1 overflow-x-auto sm:ml-auto sm:w-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-3.5 text-sm transition-[background-color,color] duration-150",
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <WatchRail />
        <main className="min-w-0">
          {error ? (
            <p className="mb-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {tab === "chart" ? <ChartPane /> : null}
          {tab === "screen" ? <ScreenPane /> : null}
          {tab === "backtest" ? <BacktestPane /> : null}
          {tab === "paper" ? <PaperPane /> : null}
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            公开行情可能延迟，Yahoo 无时点基本面所以因子只用价量。回测按收盘出信号、次日开盘成交并加 0.05% 滑点；A 股股票 T+1，场内 ETF 可当日；佣金万一 2.5（模拟盘最低 5 元），过户费 0.001%，股票卖出加 0.05% 印花税。主板 ±10%、创业板/科创板 ±20%，一字板和停牌不成交。历史回测不代表未来收益，不是投资建议，模拟盘不连接券商。
          </p>
        </main>
      </div>
    </div>
  );
}

function WatchRail() {
  const watch = useQuant((s) => s.watch);
  const id = useQuant((s) => s.id);
  const quotes = useQuant((s) => s.quotes);
  const setId = useQuant((s) => s.setId);
  const toggleWatch = useQuant((s) => s.toggleWatch);

  return (
    <aside className="rounded-2xl bg-card p-3 shadow-[var(--shadow-border)] lg:sticky lg:top-3 lg:h-fit">
      <p className="px-1 text-xs text-muted-foreground">监视列表</p>
      <ul className="mt-2 space-y-0.5">
        {watch.map((wid) => {
          const inst = instrumentById(wid);
          const q = quotes[wid];
          if (!inst) return null;
          return (
            <li key={wid}>
              <button
                type="button"
                onClick={() => setId(wid)}
                className={cn(
                  "flex w-full min-w-0 items-baseline justify-between gap-3 rounded-xl px-2.5 py-2 text-left",
                  id === wid ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{inst.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{inst.id}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm tabular-nums">{q ? formatPrice(q.price, inst.market) : "…"}</span>
                  <span className={cn("block font-mono text-[11px] tabular-nums", toneClass(q?.changePct ?? 0))}>
                    {q ? formatPct(q.changePct) : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-1 text-xs text-muted-foreground">全部标的</p>
      <div className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
        {UNIVERSE.map((inst) => (
          <button
            key={inst.id}
            type="button"
            onClick={() => toggleWatch(inst.id)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/60"
          >
            <span>{inst.name}</span>
            <span className="text-muted-foreground">{watch.includes(inst.id) ? "已监视" : "加入"}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ChartPane() {
  const id = useQuant((s) => s.id);
  const range = useQuant((s) => s.range);
  const setRange = useQuant((s) => s.setRange);
  const history = useQuant((s) => s.history);
  const quotes = useQuant((s) => s.quotes);
  const loading = useQuant((s) => s.loading);
  const insight = useQuant((s) => s.insight);
  const talking = useQuant((s) => s.talking);
  const askInsight = useQuant((s) => s.askInsight);
  const inst = instrumentById(id);
  const q = quotes[id];
  const series = useMemo(() => (history ? chartSeries(history.bars) : []), [history]);

  if (!inst) return null;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {inst.kind === "etf" ? "场内基金" : "股票"} · {inst.sector} · {inst.market}
              {history?.source === "sample" ? " · 离线样本" : ""}
            </p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">{inst.name}</h1>
            <p className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-3xl tabular-nums">{q ? formatPrice(q.price, inst.market) : "…"}</span>
              <span className={cn("font-mono text-base tabular-nums", toneClass(q?.changePct ?? 0))}>
                {q ? formatPct(q.changePct) : ""}
              </span>
            </p>
          </div>
          <div className="flex gap-1 rounded-full bg-muted p-1">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={cn(
                  "h-9 rounded-full px-3 text-xs",
                  range === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-72">
          {loading || series.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">读取 K 线…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="t"
                  tickFormatter={(v) => formatDate(Number(v))}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as (typeof series)[number];
                    return (
                      <div className="rounded-lg bg-popover px-3 py-2 text-xs shadow-[var(--shadow-border)]">
                        <p>{formatDateLong(row.t)}</p>
                        <p className="mt-1 font-mono tabular-nums">收 {formatPrice(row.c, inst.market)}</p>
                        <p className="font-mono tabular-nums text-muted-foreground">
                          MA20 {Number.isFinite(row.ma20) ? formatPrice(row.ma20, inst.market) : "—"}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="c" stroke="var(--color-chart-line)" fill="var(--color-chart-fill)" strokeWidth={1.6} />
                <Line type="monotone" dataKey="ma20" stroke="var(--color-chart-ma)" dot={false} strokeWidth={1.2} connectNulls />
                <Line type="monotone" dataKey="ma60" stroke="var(--color-muted-foreground)" dot={false} strokeWidth={1} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void askInsight()} disabled={talking}>
            <Sparkles />
            {talking ? "解读中…" : "解读这只标的"}
          </Button>
        </div>
        {insight ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{insight}</p>
        ) : null}
      </section>
    </div>
  );
}

function ScreenPane() {
  const screen = useQuant((s) => s.screen);
  const screening = useQuant((s) => s.screening);
  const loadScreen = useQuant((s) => s.loadScreen);
  const setId = useQuant((s) => s.setId);
  const setTab = useQuant((s) => s.setTab);

  useEffect(() => {
    if (screen.length === 0) void loadScreen();
  }, [screen.length, loadScreen]);

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-medium">因子排序</h2>
          <p className="mt-1 text-sm text-muted-foreground">动量、波动、RSI、均线偏离合成得分。红涨绿跌。</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadScreen()} disabled={screening}>
          {screening ? "计算中" : "刷新"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-t border-border">
              <th className="px-5 py-2 font-medium">标的</th>
              <th className="px-3 py-2 font-medium">现价</th>
              <th className="px-3 py-2 font-medium">当日</th>
              <th className="px-3 py-2 font-medium">20日</th>
              <th className="px-3 py-2 font-medium">60日</th>
              <th className="px-3 py-2 font-medium">RSI</th>
              <th className="px-3 py-2 font-medium">波动</th>
              <th className="px-3 py-2 font-medium">回撤</th>
              <th className="px-5 py-2 font-medium">得分</th>
            </tr>
          </thead>
          <tbody>
            {screen.map((row) => (
              <tr key={row.id} className="border-t border-border/70">
                <td className="px-5 py-2.5">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setId(row.id);
                      setTab("chart");
                    }}
                  >
                    <span className="block">{row.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.id} · {row.sector}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{formatPrice(row.price)}</td>
                <td className={cn("px-3 py-2.5 font-mono tabular-nums", toneClass(row.changePct))}>{formatPct(row.changePct)}</td>
                <td className={cn("px-3 py-2.5 font-mono tabular-nums", toneClass(row.mom20))}>{formatPct(row.mom20)}</td>
                <td className={cn("px-3 py-2.5 font-mono tabular-nums", toneClass(row.mom60))}>{formatPct(row.mom60)}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{Number.isFinite(row.rsi) ? row.rsi.toFixed(0) : "—"}</td>
                <td className="px-3 py-2.5 font-mono tabular-nums">{Number.isFinite(row.vol20) ? formatPct(row.vol20, 1) : "—"}</td>
                <td className={cn("px-3 py-2.5 font-mono tabular-nums", toneClass(row.drawdown))}>{formatPct(row.drawdown)}</td>
                <td className="px-5 py-2.5 font-mono tabular-nums">{row.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {screening && screen.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">正在拉取一年行情并计算因子…</p>
        ) : null}
      </div>
    </section>
  );
}

function BacktestPane() {
  const strategy = useQuant((s) => s.strategy);
  const setStrategy = useQuant((s) => s.setStrategy);
  const result = useQuant((s) => s.result);
  const history = useQuant((s) => s.history);
  const runStrategy = useQuant((s) => s.runStrategy);
  const inst = instrumentById(useQuant((s) => s.id));

  useEffect(() => {
    if (history && !result) runStrategy();
  }, [history, result, runStrategy]);

  const chart = result?.equity ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {STRATEGIES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStrategy(s.id)}
            className={cn(
              "rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)]",
              strategy === s.id && "ring-1 ring-ring",
            )}
          >
            <p className="font-medium">{s.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
          </button>
        ))}
      </div>

      {result ? (
        <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl font-medium">
            {inst?.name} · {STRATEGIES.find((s) => s.id === result.strategy)?.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateLong(result.start)} — {formatDateLong(result.end)} · 相对买入持有 · {history?.source === "live" ? "Yahoo 行情" : "样本行情，不是实盘"}
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "筹算-回测.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            导出回测 JSON
          </button>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="策略收益" value={formatPct(result.totalReturn)} tone={result.totalReturn} />
            <Stat label="买入持有" value={formatPct(result.benchReturn)} tone={result.benchReturn} />
            <Stat label="最大回撤" value={formatPct(result.maxDrawdown)} tone={result.maxDrawdown} />
            <Stat label="夏普" value={result.sharpe.toFixed(2)} />
            <Stat label="卡玛" value={result.calmar.toFixed(2)} />
            <Stat label="年化" value={formatPct(result.annualized)} tone={result.annualized} />
            <Stat label="胜率" value={formatPct(result.winRate, 0)} />
            <Stat label="交易次数" value={String(result.tradesCount)} />
            <Stat label="持仓占比" value={formatPct(result.exposure, 0)} />
            <Stat label="年换手" value={`${result.turnover.toFixed(1)} 次`} />
          </div>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="t" tickFormatter={(v) => formatDate(Number(v))} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={28} />
                <YAxis tickFormatter={(v) => `${((Number(v) - 1) * 100).toFixed(0)}%`} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Line type="monotone" dataKey="value" stroke="var(--color-chart-line)" dot={false} strokeWidth={1.6} />
                <Line type="monotone" dataKey="bench" stroke="var(--color-muted-foreground)" dot={false} strokeWidth={1} strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {result.trades.length > 0 ? (
            <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-sm">
              {result.trades.slice(-12).reverse().map((t, i) => (
                <li key={`${t.t}-${i}`} className="flex justify-between gap-3 font-mono text-xs tabular-nums">
                  <span className={t.side === "buy" ? "text-up" : "text-down"}>
                    {t.side === "buy" ? "买" : "卖"} {formatDate(t.t)}
                  </span>
                  <span className="truncate text-muted-foreground">{t.note}</span>
                  <span>{t.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">这段行情里策略没有开仓。</p>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">K 线不足或仍在加载。</p>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-lg tabular-nums", tone !== undefined ? toneClass(tone) : "")}>{value}</p>
    </div>
  );
}

function PaperPane() {
  const book = useQuant((s) => s.book);
  const quotes = useQuant((s) => s.quotes);
  const id = useQuant((s) => s.id);
  const trade = useQuant((s) => s.trade);
  const resetBook = useQuant((s) => s.resetBook);
  const tradeHint = useQuant((s) => s.tradeHint);
  const inst = instrumentById(id);
  const q = quotes[id];
  const [qty, setQty] = useState(100);

  const mtm = book.positions.reduce((n, p) => {
    const px = quotes[p.id]?.price ?? p.cost;
    return n + px * p.shares;
  }, 0);
  const equity = book.cash + mtm;
  const pnl = equity - 1_000_000;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-medium">模拟资金</h2>
        <p className="mt-1 text-sm text-muted-foreground">按最新价成交。A 股股票 100 股一手、T+1；场内 ETF 可当日。佣金万一 2.5 最低 5 元，含印花税和过户费。起始 100 万。</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="总资产" value={formatCny(equity)} />
          <Stat label="现金" value={formatCny(book.cash)} />
          <Stat label="浮动盈亏" value={formatCny(pnl)} tone={pnl} />
        </div>
        {inst && q ? (
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">手数（股 / 份，A 股 100 的倍数）</span>
              <input
                type="number"
                min={100}
                step={100}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-11 w-32 rounded-xl border border-input bg-background px-3 font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </label>
            <Button onClick={() => trade("buy", qty)}>买入 {inst.name}</Button>
            <Button variant="outline" onClick={() => trade("sell", qty)}>
              卖出
            </Button>
            <Button variant="ghost" onClick={resetBook}>
              重置模拟盘
            </Button>
          </div>
        ) : null}
        {tradeHint ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {tradeHint}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h3 className="font-medium">持仓</h3>
        {book.positions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">空仓。在行情页选标的后回来下单。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {book.positions.map((p) => {
              const name = instrumentById(p.id)?.name ?? p.id;
              const px = quotes[p.id]?.price ?? p.cost;
              const diff = px / p.cost - 1;
              return (
                <li key={p.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    {name}
                    <span className="ml-2 text-muted-foreground">{p.shares} 股</span>
                  </span>
                  <span className={cn("font-mono tabular-nums", toneClass(diff))}>
                    {formatPrice(px)} · {formatPct(diff)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {book.trades.length > 0 ? (
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h3 className="font-medium">成交</h3>
          <ul className="mt-3 space-y-1 text-xs">
            {book.trades.slice(0, 12).map((t, i) => (
              <li key={`${t.t}-${i}`} className="flex justify-between font-mono tabular-nums text-muted-foreground">
                <span>
                  {t.side === "buy" ? "买" : "卖"} {instrumentById(t.id)?.name} × {formatCompact(t.shares)}
                </span>
                <span>{t.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
