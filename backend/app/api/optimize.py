# 參數優化 API
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.core.backtest_engine import BacktestEngine, BacktestParams

router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

# 平行處理的最大線程數
MAX_WORKERS = 4

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


def run_single_backtest(engine: BacktestEngine, params: BacktestParams, strategy_type: str, 
                        direction: str, ma_fast: int, ma_slow: Optional[int], leverage: float):
    """執行單次回測並返回結果"""
    try:
        result = engine.run(params)
        return OptimizeResult(
            strategy_type=strategy_type,
            direction=direction,
            ma_fast=ma_fast,
            ma_slow=ma_slow,
            leverage=leverage,
            total_return=result.total_return,
            cagr=result.cagr,
            mdd=result.mdd,
            sharpe_ratio=result.sharpe_ratio,
            calmar_ratio=result.calmar_ratio,
            total_trades=result.total_trades,
            win_rate=result.win_rate
        )
    except Exception:
        return None


@router.post("/run")
async def run_optimization(request: OptimizeRequest) -> List[OptimizeResult]:
    """執行參數優化 - 使用平行處理加速"""
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
        
        # 建立所有待執行的任務
        tasks = []
        
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
                        tasks.append((params, strategy_mode, "long_only", 0, None, leverage))
                        
                    elif strategy_mode == "single_ma":
                        for ma_fast in request.ma_fast_range:
                            params = BacktestParams(
                                initial_cash=request.initial_cash, leverage=leverage,
                                fee_rate=request.fee_rate, slippage=request.slippage,
                                strategy_mode=strategy_mode, ma_fast=ma_fast, ma_slow=ma_fast,
                                trade_direction=direction,
                                start_date=request.start_date, end_date=request.end_date
                            )
                            tasks.append((params, strategy_mode, direction, ma_fast, None, leverage))
                            
                    else:  # dual_ma
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
                                tasks.append((params, strategy_mode, direction, ma_fast, ma_slow, leverage))
        
        # 使用平行處理執行所有回測
        results = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(run_single_backtest, engine, *task): task 
                for task in tasks
            }
            
            for future in as_completed(futures):
                result = future.result()
                if result is not None:
                    results.append(result)
        
        # 過濾掉爆倉的策略（MDD >= 99% 表示幾乎全部虧損）
        results = [r for r in results if r.mdd < 99 and r.total_return > -99]
        
        results.sort(key=lambda x: getattr(x, request.sort_by), reverse=True)
        return results[:request.top_n]
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"優化失敗: {str(e)}")

# ==================== 圖表資料 API ====================

class ChartRequest(BaseModel):
    file_id: str
    ma_fast: int = 20
    ma_slow: Optional[int] = None
    limit: int = 500

@router.post("/chart")
async def get_chart_data(request: ChartRequest):
    """取得價格和均線資料用於圖表顯示"""
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
        
        # 計算均線
        df['ma_fast'] = df[close_col].rolling(window=request.ma_fast).mean()
        if request.ma_slow:
            df['ma_slow'] = df[close_col].rolling(window=request.ma_slow).mean()
        
        # 取最後 N 筆資料
        df = df.tail(request.limit)
        
        chart_data = []
        for _, row in df.iterrows():
            item = {
                "date": row[date_col].strftime("%Y-%m-%d"),
                "price": float(row[close_col]),
                "ma_fast": float(row['ma_fast']) if pd.notna(row['ma_fast']) else None,
            }
            if request.ma_slow:
                item["ma_slow"] = float(row['ma_slow']) if pd.notna(row['ma_slow']) else None
            chart_data.append(item)
        
        return {
            "file_id": request.file_id,
            "ma_fast": request.ma_fast,
            "ma_slow": request.ma_slow,
            "data": chart_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"取得圖表資料失敗: {str(e)}")
