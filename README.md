# 筹算

A 股与场内基金量化台：行情、因子筛选、策略回测、模拟盘。内容不是投资建议。

## 怎么用

需要 [Node.js 20](https://nodejs.org/) 或以上。

```bash
git clone https://github.com/xuanske/chousuan.git
cd chousuan
npm install
npm run dev
```

终端会给出本地地址，用浏览器打开。行情由本机服务端去拉 Yahoo Finance，避免浏览器跨域。

可选：复制 `.env.example` 为 `.env`，填入 `XAI_API_KEY`，模拟盘旁的解读才可用。不填不影响行情和回测。

国内克隆：

```bash
git clone https://ghproxy.net/https://github.com/xuanske/chousuan.git
```

A 股与场内基金量化台：行情、因子筛选、策略回测、模拟盘。

红涨绿跌。行情走 Yahoo Finance v8 chart（服务端拉取）。模拟盘资金 100 万，存在浏览器本地。

## 规则（按 A 股习惯）

- 信号在收盘计算，**次日开盘**成交
- **T+1**：当天买入不能当天卖出
- 佣金万一 2.5（买卖都收）；A 股股票卖出加 **0.05% 印花税**
- 涨跌停（波幅极窄且涨跌约 10%）视为不成交
- 模拟盘 A 股 **100 股一手**
- 因子只用价量（动量、RSI、波动、均线偏离），不用 Yahoo 财务快照，避免前视偏差
- 指标：收益、买入持有、最大回撤、夏普、卡玛、胜率

历史回测不代表未来收益。内容不是投资建议。

## 源码

`src/components/quant` 台面，`src/lib/quant` 指标 / 回测 / 行情，`src/store/quant.ts` 状态。

Yahoo 不可用时会落到样本数据，样本行情不会当成真实行情缓存。

姊妹项目：[拂尘](https://github.com/xuanske/fuchen) · [开窍](https://github.com/xuanske/kaiqiao)
