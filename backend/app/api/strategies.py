# 策略管理 API
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime
import json
import os

router = APIRouter()
STRATEGIES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "strategies.json")

class Strategy(BaseModel):
    id: Optional[str] = None
    name: str
    asset: str
    strategy_type: str
    direction: str
    ma_period: int
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
    if os.path.exists(STRATEGIES_FILE):
        try:
            with open(STRATEGIES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_strategies(strategies: Dict):
    os.makedirs(os.path.dirname(STRATEGIES_FILE), exist_ok=True)
    with open(STRATEGIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(strategies, f, ensure_ascii=False, indent=2)

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
    strategy_id = f"{strategy.asset}_{strategy.backtest_period}".replace(" ", "").replace("~", "_").replace("/", "-")
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
