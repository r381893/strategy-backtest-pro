# 檔案管理 API
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict
import pandas as pd
import os
from datetime import datetime
import time

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

# 快取機制
_file_cache: Dict = {}
_cache_timestamp: float = 0
CACHE_TTL_SECONDS = 300  # 快取 5 分鐘

def get_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    return DATA_DIR

def invalidate_cache():
    """清除快取"""
    global _file_cache, _cache_timestamp
    _file_cache = {}
    _cache_timestamp = 0

@router.get("")
async def list_files() -> List[Dict]:
    """取得所有資料檔案列表（含快取）"""
    global _file_cache, _cache_timestamp
    
    # 檢查快取是否有效
    if _file_cache and (time.time() - _cache_timestamp) < CACHE_TTL_SECONDS:
        return _file_cache.get("files", [])
    
    data_dir = get_data_dir()
    files = []
    date_candidates = ["date", "日期", "data", "time"]
    
    for filename in os.listdir(data_dir):
        if filename.endswith('.xlsx') or filename.endswith('.xls'):
            file_path = os.path.join(data_dir, filename)
            try:
                # 優化：只讀取前100列和後100列來判斷日期範圍
                df = pd.read_excel(file_path)
                lower_cols = [c.lower() for c in df.columns]
                date_col = next((df.columns[lower_cols.index(c)] for c in date_candidates if c in lower_cols), None)
                
                if date_col:
                    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
                    latest_date = df[date_col].max()
                    min_date = df[date_col].min()
                    
                    if pd.notna(latest_date):
                        days_ago = (datetime.now().date() - latest_date.date()).days
                        files.append({
                            "id": filename,
                            "name": filename.replace('.xlsx', '').replace('.xls', ''),
                            "latest_date": latest_date.strftime("%Y-%m-%d"),
                            "start_date": min_date.strftime("%Y-%m-%d") if pd.notna(min_date) else None,
                            "row_count": len(df),
                            "days_ago": days_ago,
                            "status": "fresh" if days_ago == 0 else "recent" if days_ago <= 7 else "old"
                        })
            except Exception as e:
                files.append({
                    "id": filename, "name": filename.replace('.xlsx', '').replace('.xls', ''),
                    "latest_date": None, "start_date": None, "row_count": 0,
                    "days_ago": None, "status": "error", "error": str(e)
                })
    
    result = sorted(files, key=lambda x: x['name'])
    
    # 儲存快取
    _file_cache = {"files": result}
    _cache_timestamp = time.time()
    
    return result

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> Dict:
    """上傳新 Excel 檔案"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支援 Excel 檔案")
    
    data_dir = get_data_dir()
    file_path = os.path.join(data_dir, file.filename)
    
    try:
        contents = await file.read()
        with open(file_path, 'wb') as f:
            f.write(contents)
        df = pd.read_excel(file_path)
        invalidate_cache()  # 清除快取
        return {"success": True, "filename": file.filename, "row_count": len(df), "columns": list(df.columns)}
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"檔案處理失敗: {str(e)}")

@router.get("/{file_id}/preview")
async def get_file_preview(file_id: str, limit: int = 500) -> Dict:
    """取得檔案預覽資料"""
    data_dir = get_data_dir()
    file_path = os.path.join(data_dir, file_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在")
    
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
        df = df.dropna(subset=[date_col, close_col]).sort_values(date_col)
        
        chart_data = [{"date": row[date_col].strftime("%Y-%m-%d"), "price": float(row[close_col])} for _, row in df.iterrows()]
        
        return {
            "file_id": file_id,
            "name": file_id.replace('.xlsx', '').replace('.xls', ''),
            "date_column": date_col, "price_column": close_col,
            "total_rows": len(df),
            "start_date": df[date_col].min().strftime("%Y-%m-%d"),
            "end_date": df[date_col].max().strftime("%Y-%m-%d"),
            "chart_data": chart_data[-limit:] if len(chart_data) > limit else chart_data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取失敗: {str(e)}")

@router.delete("/{file_id}")
async def delete_file(file_id: str) -> Dict:
    """刪除檔案"""
    file_path = os.path.join(get_data_dir(), file_id)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在")
    os.remove(file_path)
    invalidate_cache()  # 清除快取
    return {"success": True, "message": f"已刪除 {file_id}"}

# ==================== 資料編輯 API ====================

def get_date_and_close_columns(df):
    """取得日期和價格欄位名稱"""
    lower_cols = [c.lower() for c in df.columns]
    date_candidates = ["date", "日期", "data", "time"]
    close_candidates = ["close", "收盤價", "price", "價格"]
    
    date_col = next((df.columns[lower_cols.index(c)] for c in date_candidates if c in lower_cols), None)
    close_col = next((df.columns[lower_cols.index(c)] for c in close_candidates if c in lower_cols), None)
    
    return date_col, close_col

@router.get("/{file_id}/data")
async def get_file_data(file_id: str, limit: int = 100) -> Dict:
    """取得檔案完整資料用於編輯"""
    file_path = os.path.join(get_data_dir(), file_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    try:
        df = pd.read_excel(file_path)
        date_col, close_col = get_date_and_close_columns(df)
        
        if not date_col or not close_col:
            raise HTTPException(status_code=400, detail="找不到日期或價格欄位")
        
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        df = df.dropna(subset=[date_col, close_col]).sort_values(date_col)
        
        # 回傳最後 N 筆資料
        recent_df = df.tail(limit)
        rows = [
            {"index": int(idx), "date": row[date_col].strftime("%Y-%m-%d"), "close": float(row[close_col])}
            for idx, row in recent_df.iterrows()
        ]
        
        return {
            "file_id": file_id,
            "date_column": date_col,
            "close_column": close_col,
            "total_rows": len(df),
            "rows": rows
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取失敗: {str(e)}")

from pydantic import BaseModel
from typing import List

class DataRow(BaseModel):
    date: str
    close: float

class AppendDataRequest(BaseModel):
    rows: List[DataRow]

@router.post("/{file_id}/append")
async def append_data(file_id: str, request: AppendDataRequest) -> Dict:
    """追加新資料到 Excel 檔案"""
    file_path = os.path.join(get_data_dir(), file_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    try:
        df = pd.read_excel(file_path)
        date_col, close_col = get_date_and_close_columns(df)
        
        if not date_col or not close_col:
            raise HTTPException(status_code=400, detail="找不到日期或價格欄位")
        
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        
        # 建立新資料 DataFrame
        new_rows = []
        for row in request.rows:
            new_date = pd.to_datetime(row.date)
            # 檢查日期是否已存在
            if new_date in df[date_col].values:
                raise HTTPException(status_code=400, detail=f"日期 {row.date} 已存在")
            new_rows.append({date_col: new_date, close_col: row.close})
        
        new_df = pd.DataFrame(new_rows)
        df = pd.concat([df, new_df], ignore_index=True)
        df = df.sort_values(date_col).reset_index(drop=True)
        
        # 儲存檔案
        df.to_excel(file_path, index=False)
        
        return {"success": True, "message": f"已新增 {len(request.rows)} 筆資料", "total_rows": len(df)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"新增失敗: {str(e)}")

class UpdateDataRequest(BaseModel):
    rows: List[dict]  # [{"index": 123, "date": "2025-01-01", "close": 100.0}, ...]

@router.put("/{file_id}/update")
async def update_data(file_id: str, request: UpdateDataRequest) -> Dict:
    """更新現有資料"""
    file_path = os.path.join(get_data_dir(), file_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    try:
        df = pd.read_excel(file_path)
        date_col, close_col = get_date_and_close_columns(df)
        
        if not date_col or not close_col:
            raise HTTPException(status_code=400, detail="找不到日期或價格欄位")
        
        for row in request.rows:
            idx = row.get("index")
            if idx is not None and idx in df.index:
                df.at[idx, date_col] = pd.to_datetime(row["date"])
                df.at[idx, close_col] = float(row["close"])
        
        df = df.sort_values(date_col).reset_index(drop=True)
        df.to_excel(file_path, index=False)
        
        return {"success": True, "message": f"已更新 {len(request.rows)} 筆資料"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失敗: {str(e)}")

class DeleteRowsRequest(BaseModel):
    indices: List[int]

@router.delete("/{file_id}/rows")
async def delete_rows(file_id: str, request: DeleteRowsRequest) -> Dict:
    """刪除指定資料列"""
    file_path = os.path.join(get_data_dir(), file_id)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="檔案不存在")
    
    try:
        df = pd.read_excel(file_path)
        
        # 刪除指定的列
        df = df.drop(index=[i for i in request.indices if i in df.index])
        df = df.reset_index(drop=True)
        df.to_excel(file_path, index=False)
        
        return {"success": True, "message": f"已刪除 {len(request.indices)} 筆資料", "total_rows": len(df)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"刪除失敗: {str(e)}")
