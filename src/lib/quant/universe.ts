import type { Instrument, RangeKey, StrategyId } from "./types";

export const UNIVERSE: Instrument[] = [
  { id: "600519", yahoo: "600519.SS", name: "贵州茅台", kind: "stock", market: "SH", sector: "白酒" },
  { id: "000858", yahoo: "000858.SZ", name: "五粮液", kind: "stock", market: "SZ", sector: "白酒" },
  { id: "300750", yahoo: "300750.SZ", name: "宁德时代", kind: "stock", market: "SZ", sector: "电车" },
  { id: "002594", yahoo: "002594.SZ", name: "比亚迪", kind: "stock", market: "SZ", sector: "电车" },
  { id: "600036", yahoo: "600036.SS", name: "招商银行", kind: "stock", market: "SH", sector: "银行" },
  { id: "601318", yahoo: "601318.SS", name: "中国平安", kind: "stock", market: "SH", sector: "保险" },
  { id: "300308", yahoo: "300308.SZ", name: "中际旭创", kind: "stock", market: "SZ", sector: "光模块" },
  { id: "601012", yahoo: "601012.SS", name: "隆基绿能", kind: "stock", market: "SH", sector: "光伏" },
  { id: "510300", yahoo: "510300.SS", name: "沪深300ETF", kind: "etf", market: "SH", sector: "宽基" },
  { id: "510500", yahoo: "510500.SS", name: "中证500ETF", kind: "etf", market: "SH", sector: "宽基" },
  { id: "159915", yahoo: "159915.SZ", name: "创业板ETF", kind: "etf", market: "SZ", sector: "成长" },
  { id: "588000", yahoo: "588000.SS", name: "科创50ETF", kind: "etf", market: "SH", sector: "科创" },
  { id: "513100", yahoo: "513100.SS", name: "纳指ETF", kind: "etf", market: "SH", sector: "海外" },
  { id: "518880", yahoo: "518880.SS", name: "黄金ETF", kind: "etf", market: "SH", sector: "商品" },
  { id: "510880", yahoo: "510880.SS", name: "红利ETF", kind: "etf", market: "SH", sector: "红利" },
  { id: "0700", yahoo: "0700.HK", name: "腾讯控股", kind: "stock", market: "HK", sector: "互联网" },
  { id: "QQQ", yahoo: "QQQ", name: "纳斯达克100", kind: "etf", market: "US", sector: "海外" },
];

export const DEFAULT_WATCH = ["600519", "300750", "002594", "510300", "159915", "513100", "518880", "0700"];

export const RANGE_OPTIONS: { id: RangeKey; label: string }[] = [
  { id: "3mo", label: "3个月" },
  { id: "6mo", label: "6个月" },
  { id: "1y", label: "1年" },
  { id: "2y", label: "2年" },
  { id: "5y", label: "5年" },
];

export const STRATEGIES: { id: StrategyId; name: string; blurb: string }[] = [
  { id: "ma-cross", name: "均线金叉", blurb: "收盘金叉，次日开盘买。主板 ±10%、创业/科创 ±20%。股票 T+1，ETF 可当日。" },
  { id: "rsi-revert", name: "RSI 回归", blurb: "RSI<30 次日开盘买，RSI>70 卖。一字板和停牌不成交。" },
  { id: "momentum", name: "20日动量", blurb: "20日涨幅>5% 持有，转负离场。不含基本面，避免前视。" },
  { id: "dual-stop", name: "双均线止损", blurb: "MA10/MA30 金叉开仓，相对持仓高点回撤 8% 止损。含滑点。" },
];

export function instrumentById(id: string): Instrument | undefined {
  return UNIVERSE.find((x) => x.id === id);
}
