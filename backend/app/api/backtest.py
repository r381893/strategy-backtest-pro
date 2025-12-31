# 回測 API
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import os

from app.core.backtest_engine import BacktestEngine, BacktestParams, BacktestResult

router = APIRouter()
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

class BacktestRequest(BaseModel):
    file_id: str
    params: BacktestParams

@router.post("/run")
async def run_backtest(request: BacktestRequest) -> BacktestResult:
    """執行回測"""
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
        return engine.run(request.params)
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"回測執行失敗: {str(e)}")
