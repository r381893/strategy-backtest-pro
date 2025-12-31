# 回測引擎核心邏輯
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel

class BacktestParams(BaseModel):
    """回測參數"""
    initial_cash: float = 100000
    leverage: float = 2.0
    fee_rate: float = 0.001
    slippage: float = 0.0005
    strategy_mode: str = "buy_and_hold"
    ma_fast: int = 20
    ma_slow: int = 60
    trade_direction: str = "long_only"
    enable_rebalance: bool = True
    enable_yield: bool = False
    annual_yield: float = 0.04
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class BacktestResult(BaseModel):
    """回測結果"""
    total_return: float
    cagr: float
    mdd: float
    mdd_start: Optional[str]
    mdd_end: Optional[str]
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    total_trades: int
    win_rate: float
    profit_factor: float
    equity_curve: List[Dict]
    trades: List[Dict]
    yearly_returns: List[Dict]
    yearly_mdd: List[Dict]

class BacktestEngine:
    """回測引擎"""
    
    def __init__(self, df: pd.DataFrame, date_col: str, close_col: str):
        self.df = df.copy()
        self.date_col = date_col
        self.close_col = close_col
        
    def run(self, params: BacktestParams) -> BacktestResult:
        """執行回測"""
        df = self.df.copy()
        
        if params.start_date:
            df = df[df[self.date_col] >= pd.to_datetime(params.start_date)]
        if params.end_date:
            df = df[df[self.date_col] <= pd.to_datetime(params.end_date)]
        
        df = df.reset_index(drop=True)
        
        if len(df) < 30:
            raise ValueError("資料不足，至少需要 30 筆")
        
        df['MA_Fast'] = df[self.close_col].rolling(window=params.ma_fast).mean()
        if params.strategy_mode == "dual_ma":
            df['MA_Slow'] = df[self.close_col].rolling(window=params.ma_slow).mean()
        
        df = self._generate_signals(df, params)
        equity_curve, trades = self._simulate_trades(df, params)
        result = self._calculate_metrics(equity_curve, trades, params.initial_cash)
        
        return result
    
    def _generate_signals(self, df: pd.DataFrame, params: BacktestParams) -> pd.DataFrame:
        """產生交易信號"""
        if params.strategy_mode == "buy_and_hold":
            df['Signal_Buy'] = False
            df.loc[df.index[0], 'Signal_Buy'] = True
            df['Signal_Sell'] = False
            df['start_idx'] = 0
        elif params.strategy_mode == "dual_ma":
            df['Signal_Buy'] = (df['MA_Fast'] > df['MA_Slow']) & (df['MA_Fast'].shift(1) <= df['MA_Slow'].shift(1))
            df['Signal_Sell'] = (df['MA_Fast'] < df['MA_Slow']) & (df['MA_Fast'].shift(1) >= df['MA_Slow'].shift(1))
            df['start_idx'] = params.ma_slow
        else:
            df['Signal_Buy'] = (df[self.close_col] > df['MA_Fast']) & (df[self.close_col].shift(1) <= df['MA_Fast'].shift(1))
            df['Signal_Sell'] = (df[self.close_col] < df['MA_Fast']) & (df[self.close_col].shift(1) >= df['MA_Fast'].shift(1))
            df['start_idx'] = params.ma_fast
        return df
    
    def _simulate_trades(self, df: pd.DataFrame, params: BacktestParams) -> Tuple[List[Dict], List[Dict]]:
        """模擬交易"""
        start_idx = int(df['start_idx'].iloc[0]) if 'start_idx' in df.columns else 0
        df = df.iloc[start_idx:].reset_index(drop=True)
        
        cash = float(params.initial_cash)
        pos = 0
        entry_price = 0.0
        entry_date = None
        units = 0.0
        equity_curve = []
        trades = []
        
        for i in range(len(df)):
            price = df[self.close_col].iloc[i]
            current_date = df[self.date_col].iloc[i]
            prev_date = df[self.date_col].iloc[i-1] if i > 0 else current_date
            
            current_equity = cash
            if pos != 0:
                unrealized_pnl = (price - entry_price) * units * pos
                
                if params.enable_yield and pos == 1 and i > 0:
                    prev_price = df[self.close_col].iloc[i-1]
                    daily_yield_rate = params.annual_yield / 252
                    yield_pnl = prev_price * daily_yield_rate * units
                    cash += yield_pnl
                
                current_equity = cash + unrealized_pnl
                
                if current_equity < (params.initial_cash * 0.15):
                    equity_curve.append({"date": current_date.strftime("%Y-%m-%d"), "value": 0})
                    break
            
            equity_curve.append({"date": current_date.strftime("%Y-%m-%d"), "value": round(current_equity, 2)})
            
            # 每月再平衡
            if params.enable_rebalance and i > 0 and current_date.month != prev_date.month and pos != 0 and cash > 0:
                realized_pnl = (price - entry_price) * units * pos
                cash = cash + realized_pnl
                target_units = (cash * params.leverage) / price
                diff_units = abs(target_units - units)
                rebalance_fee = diff_units * price * params.fee_rate
                cash = cash - rebalance_fee
                trades.append({
                    "direction": "再平衡",
                    "entry_date": current_date.strftime("%Y-%m-%d"),
                    "exit_date": current_date.strftime("%Y-%m-%d"),
                    "entry_price": round(price, 2),
                    "exit_price": round(price, 2),
                    "units": round(target_units, 4),
                    "pnl": round(-rebalance_fee, 2),
                    "pnl_pct": round(-rebalance_fee / current_equity * 100, 2) if current_equity > 0 else 0,
                    "note": f"槓桿校正: {units:.2f} -> {target_units:.2f}"
                })
                units = target_units
                entry_price = price
            
            sig_buy = df['Signal_Buy'].iloc[i]
            sig_sell = df['Signal_Sell'].iloc[i]
            
            if pos == 1 and sig_sell:
                exit_p = price * (1 - params.slippage)
                pnl = (exit_p - entry_price) * units
                fee = exit_p * units * params.fee_rate
                net_pnl = pnl - fee
                cash_before = cash  # 記錄進場時的資產
                trades.append({
                    "direction": "做多",
                    "entry_date": entry_date.strftime("%Y-%m-%d") if entry_date else "",
                    "exit_date": current_date.strftime("%Y-%m-%d"),
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(exit_p, 2),
                    "units": round(units, 4),
                    "pnl": round(net_pnl, 2),
                    "pnl_pct": round(net_pnl / cash * 100, 2) if cash > 0 else 0,
                    "cash_before": round(cash_before, 2),  # 進場時資產
                    "cash_after": round(cash_before + net_pnl, 2),  # 出場後資產
                    "note": ""
                })
                cash += net_pnl
                pos, units = 0, 0
                
                if params.trade_direction == "long_short" and cash > 0:
                    pos = -1
                    entry_price = price * (1 - params.slippage)
                    position_value = cash * params.leverage
                    units = position_value / entry_price / (1 + params.fee_rate)
                    entry_date = current_date
            
            elif pos == -1 and sig_buy:
                exit_p = price * (1 + params.slippage)
                pnl = (entry_price - exit_p) * units
                fee = exit_p * units * params.fee_rate
                net_pnl = pnl - fee
                cash_before = cash
                trades.append({
                    "direction": "做空",
                    "entry_date": entry_date.strftime("%Y-%m-%d") if entry_date else "",
                    "exit_date": current_date.strftime("%Y-%m-%d"),
                    "entry_price": round(entry_price, 2),
                    "exit_price": round(exit_p, 2),
                    "units": round(units, 4),
                    "pnl": round(net_pnl, 2),
                    "pnl_pct": round(net_pnl / cash * 100, 2) if cash > 0 else 0,
                    "cash_before": round(cash_before, 2),
                    "cash_after": round(cash_before + net_pnl, 2),
                    "note": ""
                })
                cash += net_pnl
                pos, units = 0, 0
                
                if cash > 0:
                    pos = 1
                    entry_price = price * (1 + params.slippage)
                    position_value = cash * params.leverage
                    units = position_value / entry_price / (1 + params.fee_rate)
                    entry_date = current_date
            
            elif pos == 0 and cash > 0:
                if sig_buy:
                    pos = 1
                    entry_price = price * (1 + params.slippage)
                    position_value = cash * params.leverage
                    units = position_value / entry_price / (1 + params.fee_rate)
                    entry_date = current_date
                elif sig_sell and params.trade_direction == "long_short":
                    pos = -1
                    entry_price = price * (1 - params.slippage)
                    position_value = cash * params.leverage
                    units = position_value / entry_price / (1 + params.fee_rate)
                    entry_date = current_date
        
        return equity_curve, trades
    
    def _calculate_metrics(self, equity_curve: List[Dict], trades: List[Dict], initial_cash: float) -> BacktestResult:
        """計算績效指標"""
        if not equity_curve:
            return BacktestResult(
                total_return=0, cagr=0, mdd=0, mdd_start=None, mdd_end=None,
                sharpe_ratio=0, sortino_ratio=0, calmar_ratio=0,
                total_trades=0, win_rate=0, profit_factor=0,
                equity_curve=[], trades=[], yearly_returns=[], yearly_mdd=[]
            )
        
        eq_df = pd.DataFrame(equity_curve)
        eq_df['date'] = pd.to_datetime(eq_df['date'])
        
        final_value = eq_df['value'].iloc[-1]
        total_return = (final_value / initial_cash - 1) * 100
        
        days = (eq_df['date'].iloc[-1] - eq_df['date'].iloc[0]).days
        cagr = ((1 + total_return / 100) ** (365 / days) - 1) * 100 if days > 0 else 0
        
        mdd, mdd_start, mdd_end = self._calc_max_drawdown(eq_df)
        
        returns = eq_df['value'].pct_change().dropna()
        sharpe = self._calc_sharpe(returns)
        sortino = self._calc_sortino(returns)
        calmar = cagr / (mdd * 100) if mdd > 0 else 0
        
        pure_trades = [t for t in trades if t['direction'] != '再平衡']
        wins = [t for t in pure_trades if t['pnl'] > 0]
        losses = [t for t in pure_trades if t['pnl'] <= 0]
        
        total_trades = len(pure_trades)
        win_rate = (len(wins) / total_trades * 100) if total_trades > 0 else 0
        
        total_profit = sum(t['pnl'] for t in wins)
        total_loss = abs(sum(t['pnl'] for t in losses))
        profit_factor = total_profit / total_loss if total_loss > 0 else 0
        
        eq_df['year'] = eq_df['date'].dt.year
        yearly_returns = []
        for year, group in eq_df.groupby('year'):
            start_val = group['value'].iloc[0]
            end_val = group['value'].iloc[-1]
            ret = (end_val / start_val - 1) * 100
            yearly_returns.append({"year": int(year), "return": round(ret, 2)})
        
        yearly_mdd = []
        for year, group in eq_df.groupby('year'):
            mdd_y, _, _ = self._calc_max_drawdown(group)
            yearly_mdd.append({"year": int(year), "mdd": round(mdd_y * 100, 2)})
        
        return BacktestResult(
            total_return=round(total_return, 2),
            cagr=round(cagr, 2),
            mdd=round(mdd * 100, 2),
            mdd_start=mdd_start,
            mdd_end=mdd_end,
            sharpe_ratio=round(sharpe, 2),
            sortino_ratio=round(sortino, 2),
            calmar_ratio=round(calmar, 2),
            total_trades=total_trades,
            win_rate=round(win_rate, 2),
            profit_factor=round(profit_factor, 2),
            equity_curve=equity_curve,
            trades=trades,
            yearly_returns=yearly_returns,
            yearly_mdd=yearly_mdd
        )
    
    def _calc_max_drawdown(self, df: pd.DataFrame) -> Tuple[float, Optional[str], Optional[str]]:
        values = df['value'].values
        dates = df['date'].values
        
        peak = values[0]
        peak_date = dates[0]
        max_dd = 0
        dd_start, dd_end = dates[0], dates[0]
        
        for i, val in enumerate(values):
            if val > peak:
                peak = val
                peak_date = dates[i]
            
            dd = (val - peak) / peak if peak > 0 else 0
            if dd < max_dd:
                max_dd = dd
                dd_start = peak_date
                dd_end = dates[i]
        
        return abs(max_dd), pd.Timestamp(dd_start).strftime("%Y-%m-%d"), pd.Timestamp(dd_end).strftime("%Y-%m-%d")
    
    def _calc_sharpe(self, returns: pd.Series, risk_free: float = 0.02) -> float:
        if returns.std() == 0:
            return 0
        avg_return = returns.mean() * 252
        std_dev = returns.std() * np.sqrt(252)
        return (avg_return - risk_free) / std_dev
    
    def _calc_sortino(self, returns: pd.Series, risk_free: float = 0.02) -> float:
        excess = returns - (risk_free / 252)
        downside = excess[excess < 0]
        if downside.empty or downside.std() == 0:
            return 0
        avg_excess = excess.mean() * 252
        downside_std = downside.std() * np.sqrt(252)
        return avg_excess / downside_std
