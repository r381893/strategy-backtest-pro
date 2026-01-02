# Yahoo Finance API
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timedelta
import pandas as pd
import yfinance as yf
import os

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

# 支援的幣種對應表
SYMBOL_MAPPING = {
    "btc_historical_data": "BTC-USD",
    "BTC_historical_data": "BTC-USD",
    "eth_historical_data": "ETH-USD",
    "ETH_historical_data": "ETH-USD",
    "doge": "DOGE-USD",
    "Doge": "DOGE-USD",
    "DOGE": "DOGE-USD",
    "加權指數資料": "^TWII",
}

def get_yahoo_symbol(file_name: str) -> Optional[str]:
    """根據檔案名稱取得對應的 Yahoo Finance symbol"""
    # 移除副檔名
    name = file_name.replace(".xlsx", "").replace(".xls", "")
    return SYMBOL_MAPPING.get(name)


@router.get("/symbols")
async def get_supported_symbols():
    """取得支援的幣種清單"""
    return {
        "symbols": SYMBOL_MAPPING,
        "description": "支援自動更新的資料檔案對應表"
    }


@router.post("/update/{file_id:path}")
async def update_file_from_yahoo(file_id: str):
    """從 Yahoo Finance 更新指定檔案的資料"""
    # 移除可能存在的副檔名
    clean_file_id = file_id.replace(".xlsx", "").replace(".xls", "")
    file_path = os.path.join(DATA_DIR, f"{clean_file_id}.xlsx")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"找不到檔案: {clean_file_id}")
    
    # 取得對應的 Yahoo symbol
    symbol = get_yahoo_symbol(clean_file_id)
    if not symbol:
        raise HTTPException(
            status_code=400, 
            detail=f"不支援此檔案的自動更新: {file_id}。支援的檔案: {list(SYMBOL_MAPPING.keys())}"
        )
    
    try:
        # 讀取現有資料
        df_existing = pd.read_excel(file_path)
        
        # 找出日期欄位
        date_col = None
        for col in df_existing.columns:
            if 'date' in col.lower() or '日期' in col:
                date_col = col
                break
        
        if date_col is None:
            date_col = df_existing.columns[0]
        
        # 找出收盤價欄位
        close_col = None
        for col in df_existing.columns:
            if 'close' in col.lower() or '收盤' in col or '價格' in col:
                close_col = col
                break
        
        if close_col is None:
            close_col = df_existing.columns[1] if len(df_existing.columns) > 1 else None
        
        # 取得最後一筆資料的日期
        df_existing[date_col] = pd.to_datetime(df_existing[date_col])
        last_date = df_existing[date_col].max()
        
        # 從最後一天開始下載（包含重疊一天以確保資料完整）
        start_date = last_date - timedelta(days=1)
        end_date = datetime.now() + timedelta(days=1)
        
        # 下載新資料
        ticker = yf.Ticker(symbol)
        df_new = ticker.history(start=start_date, end=end_date)
        
        if df_new.empty:
            return {
                "status": "no_update",
                "message": "沒有新資料可更新",
                "file_id": file_id,
                "symbol": symbol,
                "last_date": last_date.strftime("%Y-%m-%d")
            }
        
        # 整理新資料格式
        df_new = df_new.reset_index()
        df_new = df_new[['Date', 'Close']].copy()
        df_new.columns = [date_col, close_col]
        df_new[date_col] = pd.to_datetime(df_new[date_col]).dt.tz_localize(None)
        
        # 合併資料（移除重複日期）
        df_combined = pd.concat([df_existing, df_new], ignore_index=True)
        df_combined = df_combined.drop_duplicates(subset=[date_col], keep='last')
        df_combined = df_combined.sort_values(date_col).reset_index(drop=True)
        
        # 儲存更新後的檔案
        df_combined.to_excel(file_path, index=False)
        
        new_last_date = df_combined[date_col].max()
        rows_added = len(df_combined) - len(df_existing)
        
        return {
            "status": "success",
            "message": f"成功更新資料",
            "file_id": file_id,
            "symbol": symbol,
            "previous_last_date": last_date.strftime("%Y-%m-%d"),
            "new_last_date": new_last_date.strftime("%Y-%m-%d"),
            "rows_added": rows_added,
            "total_rows": len(df_combined)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失敗: {str(e)}")


@router.post("/download")
async def download_new_symbol(symbol: str, name: Optional[str] = None):
    """下載新的幣種資料"""
    try:
        # 使用預設名稱或自訂名稱
        file_name = name or symbol.replace("-", "_").replace("^", "")
        file_path = os.path.join(DATA_DIR, f"{file_name}.xlsx")
        
        # 下載完整歷史資料
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="max")
        
        if df.empty:
            raise HTTPException(status_code=404, detail=f"找不到 symbol: {symbol}")
        
        # 整理資料格式
        df = df.reset_index()
        df = df[['Date', 'Close']].copy()
        df.columns = ['date', 'close']
        df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)
        
        # 儲存檔案
        df.to_excel(file_path, index=False)
        
        return {
            "status": "success",
            "message": f"成功下載 {symbol} 資料",
            "file_name": file_name,
            "symbol": symbol,
            "total_rows": len(df),
            "start_date": df['date'].min().strftime("%Y-%m-%d"),
            "end_date": df['date'].max().strftime("%Y-%m-%d")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下載失敗: {str(e)}")
