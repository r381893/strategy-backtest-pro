# FastAPI Backend
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import files, backtest, strategies, optimize

app = FastAPI(
    title="高級回測系統 Pro API",
    description="策略回測系統後端 API",
    version="1.0.0"
)

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["Backtest"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])
app.include_router(optimize.router, prefix="/api/optimize", tags=["Optimize"])

@app.get("/")
async def root():
    return {"message": "高級回測系統 Pro API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
