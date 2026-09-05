import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFillBlocked, limitPct, tradeCost } from "./backtest.ts";
import type { Bar, Instrument } from "./types.ts";

const stock = (id: string, market: Instrument["market"] = "SH"): Instrument => ({
  id,
  yahoo: id,
  name: id,
  kind: "stock",
  market,
  sector: "测",
});

describe("A 股回测规则", () => {
  it("涨跌停按板块：主板 10%、创业/科创 20%", () => {
    assert.equal(limitPct("600519", "SH", "stock"), 0.1);
    assert.equal(limitPct("000858", "SZ", "stock"), 0.1);
    assert.equal(limitPct("300750", "SZ", "stock"), 0.2);
    assert.equal(limitPct("688981", "SH", "stock"), 0.2);
    assert.equal(limitPct("QQQ", "US", "etf"), Number.POSITIVE_INFINITY);
  });

  it("佣金万一 2.5、最低 5 元；印花税只在 A 股股票卖出；过户费双向", () => {
    const buySmall = tradeCost("buy", 1000, "SH", "stock", { minCommission: true });
    assert.equal(buySmall, 5 + 1000 * 0.00001);

    const sell = tradeCost("sell", 100_000, "SH", "stock");
    assert.ok(Math.abs(sell - (25 + 50 + 1)) < 1e-9);

    const etfSell = tradeCost("sell", 100_000, "SH", "etf");
    assert.ok(Math.abs(etfSell - (25 + 1)) < 1e-9);

    const us = tradeCost("sell", 100_000, "US", "etf");
    assert.ok(Math.abs(us - 25) < 1e-9);
  });

  it("创业板涨 10% 不锁，主板 10% 一字视为涨停锁单", () => {
    const t = 1_700_000_000_000;
    const bars: Bar[] = [
      { t, o: 10, h: 10, l: 10, c: 10, v: 1 },
      { t: t + 86_400_000, o: 11, h: 11, l: 11, c: 11, v: 1 },
    ];
    assert.equal(isFillBlocked(bars, 1, stock("300750", "SZ")), false);
    assert.equal(isFillBlocked(bars, 1, stock("600519", "SH")), true);
  });

  it("停牌成交量为 0 不成交", () => {
    const t = 1_700_000_000_000;
    const bars: Bar[] = [
      { t, o: 10, h: 10, l: 10, c: 10, v: 1 },
      { t: t + 86_400_000, o: 10, h: 10, l: 10, c: 10, v: 0 },
    ];
    assert.equal(isFillBlocked(bars, 1, stock("600519")), true);
  });
});
