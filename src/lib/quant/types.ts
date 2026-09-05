export type AssetKind = "stock" | "etf";
export type Market = "SH" | "SZ" | "HK" | "US";
export type RangeKey = "3mo" | "6mo" | "1y" | "2y" | "5y";
export type StrategyId = "ma-cross" | "rsi-revert" | "momentum" | "dual-stop";
export type DataSource = "live" | "sample";

export type Instrument = {
  id: string;
  yahoo: string;
  name: string;
  kind: AssetKind;
  market: Market;
  sector: string;
};

export type Bar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type Quote = {
  id: string;
  price: number;
  prev: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  updatedAt: number;
  source: DataSource;
};

export type History = {
  id: string;
  bars: Bar[];
  source: DataSource;
};

export type ScreenRow = {
  id: string;
  name: string;
  kind: AssetKind;
  sector: string;
  price: number;
  changePct: number;
  mom20: number;
  mom60: number;
  rsi: number;
  vol20: number;
  drawdown: number;
  maBias: number;
  score: number;
  source: DataSource;
};

export type BacktestTrade = {
  t: number;
  side: "buy" | "sell";
  price: number;
  shares: number;
  note: string;
};

export type BacktestResult = {
  strategy: StrategyId;
  id: string;
  start: number;
  end: number;
  equity: { t: number; value: number; bench: number }[];
  trades: BacktestTrade[];
  totalReturn: number;
  benchReturn: number;
  annualized: number;
  maxDrawdown: number;
  sharpe: number;
  calmar: number;
  winRate: number;
  tradesCount: number;
  exposure: number;
  turnover: number;
};

export type PaperPosition = {
  id: string;
  shares: number;
  cost: number;
  lastBuyDay?: string;
};

export type PaperTrade = {
  t: number;
  id: string;
  side: "buy" | "sell";
  shares: number;
  price: number;
};

export type PaperBook = {
  cash: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
};
