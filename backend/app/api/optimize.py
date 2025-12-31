# 參數優化 API
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import os

from app.core.backtest_engine import BacktestEngine, BacktestParams

router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

class OptimizeRequest(BaseModel):
    file_id: str
    strategy_modes: List[str] = ["buy_and_hold", "single_ma", "dual_ma"]
    ma_fast_range: List[int] = [5, 10, 20, 30, 60]
    ma_slow_range: List[int] = [60, 120, 200]
    leverage_range: List[float] = [1.0, 2.0, 3.0]
    directions: List[str] = ["long_only", "long_short"]
    initial_cash: float = 100000
    fee_rate: float = 0.001
    slippage: float = 0.0005
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    top_n: int = 10
    sort_by: str = "sharpe_ratio"

class OptimizeResult(BaseModel):
    strategy_type: str
    direction: str
    ma_fast: int
    ma_slow: Optional[int]
    leverage: float
    total_return: float
    cagr: float
    mdd: float
    sharpe_ratio: float
    calmar_ratio: float
    total_trades: int
    win_rate: float

@router.post("/run")
async def run_optimization(request: OptimizeRequest) -> List[OptimizeResult]:
    """執行參數優化"""
    file_path = os.path.join(DATA_DIR, request.file_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="資料檔案不存在")
    
    try:
        df = pd.read_excel(file_path)
        lower_cols = [c.lower() for c in df.columns]
        date_candidates = ["date", "日期", "data", "time"]
        close_candidates = ["close", "收盤價", "price", "價格"]
        
        date_col = next((df.columns[lower_cols.index(c)] for c in date_candidates if c in lower_cols), None)
        close_col = next((df.columns[lower_cols.index(c)] for c in close_candidates if c in lower_cols), None)
        
        if not date_col or not close_col:
            raise HTTPException(status_code=400, detail="找不到日期或價格欄位")
        
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        df = df.dropna(subset=[date_col, close_col]).sort_values(date_col).reset_index(drop=True)
        
        engine = BacktestEngine(df, date_col, close_col)
        results = []
        
        for strategy_mode in request.strategy_modes:
            for direction in request.directions:
                for leverage in request.leverage_range:
                    if strategy_mode == "buy_and_hold":
                        params = BacktestParams(
                            initial_cash=request.initial_cash, leverage=leverage,
                            fee_rate=request.fee_rate, slippage=request.slippage,
                            strategy_mode=strategy_mode, ma_fast=20, ma_slow=60,
                            trade_direction="long_only",
                            start_date=request.start_date, end_date=request.end_date
                        )
                        try:
                            result = engine.run(params)
                            results.append(OptimizeResult(
                                strategy_type=strategy_mode, direction="long_only",
                                ma_fast=0, ma_slow=None, leverage=leverage,
                                total_return=result.total_return, cagr=result.cagr,
                                mdd=result.mdd, sharpe_ratio=result.sharpe_ratio,
                                calmar_ratio=result.calmar_ratio,
                                total_trades=result.total_trades, win_rate=result.win_rate
                            ))
                        except:
                            pass
                    elif strategy_mode == "single_ma":
                        for ma_fast in request.ma_fast_range:
                            params = BacktestParams(
                                initial_cash=request.initial_cash, leverage=leverage,
                                fee_rate=request.fee_rate, slippage=request.slippage,
                                strategy_mode=strategy_mode, ma_fast=ma_fast, ma_slow=ma_fast,
                                trade_direction=direction,
                                start_date=request.start_date, end_date=request.end_date
                            )
                            try:
                                result = engine.run(params)
                                results.append(OptimizeResult(
                                    strategy_type=strategy_mode, direction=direction,
                                    ma_fast=ma_fast, ma_slow=None, leverage=leverage,
                                    total_return=result.total_return, cagr=result.cagr,
                                    mdd=result.mdd, sharpe_ratio=result.sharpe_ratio,
                                    calmar_ratio=result.calmar_ratio,
                                    total_trades=result.total_trades, win_rate=result.win_rate
                                ))
                            except:
                                pass
                    else:
                        for ma_fast in request.ma_fast_range:
                            for ma_slow in request.ma_slow_range:
                                if ma_slow <= ma_fast:
                                    continue
                                params = BacktestParams(
                                    initial_cash=request.initial_cash, leverage=leverage,
                                    fee_rate=request.fee_rate, slippage=request.slippage,
                                    strategy_mode=strategy_mode, ma_fast=ma_fast, ma_slow=ma_slow,
                                    trade_direction=direction,
                                    start_date=request.start_date, end_date=request.end_date
                                )
                                try:
                                    result = engine.run(params)
                                    results.append(OptimizeResult(
                                        strategy_type=strategy_mode, direction=direction,
                                        ma_fast=ma_fast, ma_slow=ma_slow, leverage=leverage,
                                        total_return=result.total_return, cagr=result.cagr,
                                        mdd=result.mdd, sharpe_ratio=result.sharpe_ratio,
                                        calmar_ratio=result.calmar_ratio,
                                        total_trades=result.total_trades, win_rate=result.win_rate
                                    ))
                                except:
                                    pass
        
        results.sort(key=lambda x: getattr(x, request.sort_by), reverse=True)
        return results[:request.top_n]
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"優化失敗: {str(e)}")
