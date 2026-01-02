import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { strategiesApi } from '../services/api';
import { Trash2, RefreshCw, Bookmark, Play } from 'lucide-react';

function StrategiesPage() {
    const navigate = useNavigate();
    const [strategies, setStrategies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState('all');

    useEffect(() => {
        loadStrategies();
    }, []);

    const loadStrategies = async () => {
        setLoading(true);
        try {
            const res = await strategiesApi.list();
            setStrategies(res.data);
        } catch (err) {
            console.error('載入失敗');
        }
        setLoading(false);
    };

    // 取得所有不重複的資產名稱
    const assetList = useMemo(() => {
        const assets = [...new Set(strategies.map(s =>
            s.asset?.replace('.xlsx', '').replace('.xls', '') || '未知'
        ))];
        return assets.sort();
    }, [strategies]);

    // 根據選擇的資產過濾策略
    const filteredStrategies = useMemo(() => {
        if (selectedAsset === 'all') return strategies;
        return strategies.filter(s =>
            (s.asset?.replace('.xlsx', '').replace('.xls', '') || '未知') === selectedAsset
        );
    }, [strategies, selectedAsset]);

    const handleDelete = async (id) => {
        if (!window.confirm('確定要刪除這個策略嗎？')) return;
        try {
            await strategiesApi.delete(id);
            alert('刪除成功！');
            loadStrategies();
        } catch (err) {
            console.error('Delete error:', err);
            alert('刪除失敗: ' + (err.response?.data?.detail || err.message));
        }
    };

    const getStrategyLabel = (s) => {
        if (s.strategy_type === 'dual_ma') {
            return `雙均線 ${s.ma_fast || 20}/${s.ma_slow || 60}`;
        } else if (s.strategy_type === 'single_ma') {
            return `單均線 ${s.ma_fast || 20}`;
        } else if (s.strategy_type === 'buy_and_hold') {
            return '永遠做多';
        }
        return s.strategy_type || '未知';
    };

    // 計算回測時長 (幾年幾月)
    const getBacktestDuration = (period) => {
        if (!period) return '-';
        const parts = period.split(' ~ ');
        if (parts.length !== 2) return '-';

        const start = new Date(parts[0]);
        const end = new Date(parts[1]);
        if (isNaN(start) || isNaN(end)) return '-';

        const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;

        if (years === 0) return `${months}個月`;
        if (months === 0) return `${years}年`;
        return `${years}年${months}月`;
    };

    // 點擊策略重跑回測
    const handleRunStrategy = (s) => {
        // 解析回測期間
        const periodParts = s.backtest_period?.split(' ~ ') || [];
        const startDate = periodParts[0] || '2015-01-01';
        const endDate = periodParts[1] || new Date().toISOString().split('T')[0];

        // 構建參數
        const params = {
            strategy_mode: s.strategy_type,
            ma_fast: s.ma_fast || 20,
            ma_slow: s.ma_slow || 60,
            leverage: s.leverage || 2,
            trade_direction: s.direction || 'long_only',
            start_date: startDate,
            end_date: endDate,
            initial_cash: 100000,
            fee_rate: 0.001,
            slippage: 0.0005,
            ...s.params  // 如果有保存的完整參數，覆蓋上面的預設值
        };

        // 存入 localStorage
        localStorage.setItem('optimizeParams', JSON.stringify(params));
        localStorage.setItem('optimizeFile', s.asset);

        // 導航到回測頁面
        navigate('/backtest');
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">💾 已儲存策略</h1>
                <p className="page-subtitle">管理您儲存的策略配置</p>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>
                        <Bookmark size={20} style={{ marginRight: '0.5rem' }} />
                        策略列表
                    </h3>
                    <button className="btn btn-primary" onClick={loadStrategies}>
                        <RefreshCw size={18} /> 重新整理
                    </button>
                </div>

                {/* 資產分類 Tab */}
                {!loading && strategies.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap',
                        borderBottom: '2px solid #f0f0f0',
                        paddingBottom: '1rem'
                    }}>
                        <button
                            onClick={() => setSelectedAsset('all')}
                            style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: selectedAsset === 'all' ? '600' : '400',
                                background: selectedAsset === 'all' ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f0f0f0',
                                color: selectedAsset === 'all' ? 'white' : '#333',
                                transition: 'all 0.2s'
                            }}
                        >
                            全部 ({strategies.length})
                        </button>
                        {assetList.map(asset => {
                            const count = strategies.filter(s =>
                                (s.asset?.replace('.xlsx', '').replace('.xls', '') || '未知') === asset
                            ).length;
                            return (
                                <button
                                    key={asset}
                                    onClick={() => setSelectedAsset(asset)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: selectedAsset === asset ? '600' : '400',
                                        background: selectedAsset === asset ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f0f0f0',
                                        color: selectedAsset === asset ? 'white' : '#333',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {asset} ({count})
                                </button>
                            );
                        })}
                    </div>
                )}

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : filteredStrategies.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
                        {strategies.length === 0 ? '尚無儲存的策略' : `沒有 ${selectedAsset} 的策略`}
                    </p>
                ) : (
                    <>
                        {/* 桌面版表格 */}
                        <div className="table-container desktop-only">
                            <table>
                                <thead>
                                    <tr>
                                        <th>資產</th>
                                        <th>策略</th>
                                        <th>槓桿</th>
                                        <th title="投資期間的總收益百分比">總報酬</th>
                                        <th title="複合年均成長率">年化報酬</th>
                                        <th title="從最高點到最低點的最大跌幅">最大回撤</th>
                                        <th>回測時長</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStrategies.map((s) => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.asset?.replace('.xlsx', '').replace('.xls', '')}</td>
                                            <td>{getStrategyLabel(s)}</td>
                                            <td>{s.leverage}x</td>
                                            <td style={{ color: s.total_return >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>
                                                {s.total_return}%
                                            </td>
                                            <td style={{ color: s.cagr >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>
                                                {s.cagr}%
                                            </td>
                                            <td style={{ color: '#ff7675' }}>{s.mdd}%</td>
                                            <td style={{ fontWeight: 500, color: '#6c5ce7' }}>{getBacktestDuration(s.backtest_period)}</td>
                                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleRunStrategy(s)}
                                                    title="重跑回測"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'white',
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    <Play size={14} /> 回測
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(s.id)}
                                                    title="刪除策略"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#ff7675',
                                                        padding: '0.25rem'
                                                    }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 手機版卡片 */}
                        <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredStrategies.map((s) => (
                                <div key={s.id} style={{
                                    background: 'linear-gradient(135deg, #f8fafc, #fff)',
                                    borderRadius: '16px',
                                    padding: '1rem',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                                    border: '1px solid rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#2c3e50' }}>
                                                {getStrategyLabel(s)}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#7f8c8d' }}>
                                                {s.asset?.replace('.xlsx', '').replace('.xls', '')} · {s.leverage}x
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handleRunStrategy(s)}
                                                style={{
                                                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'white',
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                <Play size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                style={{
                                                    background: 'rgba(255,118,117,0.1)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#ff7675',
                                                    padding: '0.5rem',
                                                    borderRadius: '8px'
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                        <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(0,184,148,0.1)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#7f8c8d' }}>總報酬</div>
                                            <div style={{ fontWeight: 700, color: s.total_return >= 0 ? '#00b894' : '#ff7675' }}>
                                                {s.total_return}%
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(108,92,231,0.1)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#7f8c8d' }}>年化報酬</div>
                                            <div style={{ fontWeight: 700, color: s.cagr >= 0 ? '#00b894' : '#ff7675' }}>
                                                {s.cagr}%
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '0.5rem', background: 'rgba(255,118,117,0.1)', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#7f8c8d' }}>最大回撤</div>
                                            <div style={{ fontWeight: 700, color: '#ff7675' }}>{s.mdd}%</div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#7f8c8d', textAlign: 'right' }}>
                                        {getBacktestDuration(s.backtest_period)} · {s.backtest_period}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default StrategiesPage;
