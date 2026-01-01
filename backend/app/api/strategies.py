# 策略管理 API
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import json
import os

# 嘗試載入 Firebase
try:
    from app.core.firebase_config import init_firebase, get_firebase_ref
    FIREBASE_AVAILABLE = init_firebase()
except ImportError:
    FIREBASE_AVAILABLE = False

router = APIRouter()
STRATEGIES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "strategies.json")

class Strategy(BaseModel):
    id: Optional[str] = None
    name: str
    asset: str
    strategy_type: str
    direction: str
    ma_period: int
    ma_fast: Optional[int] = None
    ma_slow: Optional[int] = None
    leverage: float
    total_return: float
    cagr: float
    mdd: float
    sharpe: float
    calmar: float
    backtest_period: str
    created_at: Optional[str] = None
    params: Optional[Dict] = None

def load_strategies() -> Dict:
    """載入策略 - 優先使用 Firebase，備用本地 JSON"""
    if FIREBASE_AVAILABLE:
        try:
            ref = get_firebase_ref('strategies')
            if ref:
                data = ref.get()
                return data if data else {}
        except Exception as e:
            print(f"Firebase 讀取失敗: {e}")
    
    # 備用：本地 JSON
    if os.path.exists(STRATEGIES_FILE):
        try:
            with open(STRATEGIES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_strategies(strategies: Dict):
    """儲存策略 - 同時寫入 Firebase 和本地 JSON"""
    # 寫入 Firebase
    if FIREBASE_AVAILABLE:
        try:
            ref = get_firebase_ref('strategies')
            if ref:
                ref.set(strategies)
                print("[OK] Strategy saved to Firebase")
        except Exception as e:
            print(f"Firebase 寫入失敗: {e}")
    
    # 同時寫入本地 JSON（備用）
    try:
        os.makedirs(os.path.dirname(STRATEGIES_FILE), exist_ok=True)
        with open(STRATEGIES_FILE, 'w', encoding='utf-8') as f:
            json.dump(strategies, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"本地 JSON 寫入失敗: {e}")

@router.get("")
async def list_strategies() -> List[Dict]:
    strategies = load_strategies()
    result = []
    for key, value in strategies.items():
        value['id'] = key
        result.append(value)
    return sorted(result, key=lambda x: x.get('created_at', ''), reverse=True)

@router.post("")
async def save_strategy(strategy: Strategy) -> Dict:
    strategies = load_strategies()
    # 生成 Firebase 相容的 ID（包含策略類型和參數，避免覆蓋）
    # 格式: asset_strategyType_maFast_maSlow_leverage_period
    ma_info = f"{strategy.ma_fast or 0}_{strategy.ma_slow or strategy.ma_period}"
    strategy_id = f"{strategy.asset}_{strategy.strategy_type}_{ma_info}_{strategy.leverage}x_{strategy.backtest_period}"
    # 移除 Firebase 非法字元
    strategy_id = strategy_id.replace(" ", "").replace("~", "_").replace("/", "-")
    strategy_id = strategy_id.replace(".", "_").replace("#", "").replace("$", "").replace("[", "").replace("]", "")
    strategy_data = strategy.dict()
    strategy_data['id'] = strategy_id
    strategy_data['created_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    strategies[strategy_id] = strategy_data
    save_strategies(strategies)
    return {"success": True, "id": strategy_id}

@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: str) -> Dict:
    strategies = load_strategies()
    if strategy_id not in strategies:
        raise HTTPException(status_code=404, detail="策略不存在")
    del strategies[strategy_id]
    save_strategies(strategies)
    return {"success": True}

