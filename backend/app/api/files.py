# 檔案管理 API
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Dict
import pandas as pd
import os
from datetime import datetime

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")

def get_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    return DATA_DIR

@router.get("")
async def list_files() -> List[Dict]:
    """取得所有資料檔案列表"""
    data_dir = get_data_dir()
    files = []
    date_candidates = ["date", "日期", "data", "time"]
    
    for filename in os.listdir(data_dir):
        if filename.endswith('.xlsx') or filename.endswith('.xls'):
            file_path = os.path.join(data_dir, filename)
            try:
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
    
    return sorted(files, key=lambda x: x['name'])

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
    return {"success": True, "message": f"已刪除 {file_id}"}
