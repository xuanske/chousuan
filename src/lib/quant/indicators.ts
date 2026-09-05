import type { Bar } from "./types.ts";

export function closes(bars: Bar[]): number[] {
  return bars.map((b) => b.c);
}

export function sma(values: number[], n: number): number[] {
  const out = Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= n) sum -= values[i - n]!;
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(values: number[], n: number): number[] {
  const out = Array<number>(values.length).fill(NaN);
  const k = 2 / (n + 1);
  let prev = 0;
  let started = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!started) {
      if (i === n - 1) {
        let s = 0;
        for (let j = 0; j < n; j++) s += values[j]!;
        prev = s / n;
        out[i] = prev;
        started = true;
      }
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(values: number[], n = 14): number[] {
  const out = Array<number>(values.length).fill(NaN);
  if (values.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i]! - values[i - 1]!;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let ag = gain / n;
  let al = loss / n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!;
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    ag = (ag * (n - 1) + g) / n;
    al = (al * (n - 1) + l) / n;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

export function stdev(values: number[], n: number): number[] {
  const mean = sma(values, n);
  const out = Array<number>(values.length).fill(NaN);
  for (let i = n - 1; i < values.length; i++) {
    let s = 0;
    const m = mean[i]!;
    for (let j = i - n + 1; j <= i; j++) {
      const d = values[j]! - m;
      s += d * d;
    }
    out[i] = Math.sqrt(s / n);
  }
  return out;
}

export function returns(values: number[], n: number): number[] {
  const out = Array<number>(values.length).fill(NaN);
  for (let i = n; i < values.length; i++) {
    const a = values[i - n]!;
    if (a) out[i] = values[i]! / a - 1;
  }
  return out;
}

export function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0;
  let dd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    if (peak > 0) dd = Math.min(dd, v / peak - 1);
  }
  return dd;
}

export function sharpe(daily: number[]): number {
  if (daily.length < 5) return 0;
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const varc =
    daily.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, daily.length - 1);
  const sd = Math.sqrt(varc);
  if (!sd) return 0;
  return (mean / sd) * Math.sqrt(252);
}

export function lastFinite(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]!;
    if (Number.isFinite(v)) return v;
  }
  return NaN;
}

export function annualized(total: number, days: number): number {
  if (days <= 1) return 0;
  const years = days / 365;
  if (total <= -0.999) return -1;
  return (1 + total) ** (1 / years) - 1;
}
