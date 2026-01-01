import { useState, useEffect } from 'react';
import { strategiesApi } from '../services/api';
import { Trash2, RefreshCw, Bookmark } from 'lucide-react';

function StrategiesPage() {
    const [strategies, setStrategies] = useState([]);
    const [loading, setLoading] = useState(true);

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

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : strategies.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
                        尚無儲存的策略
                    </p>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>資產</th>
                                    <th>策略</th>
                                    <th>方向</th>
                                    <th>槓桿</th>
                                    <th title="投資期間的總收益百分比">總報酬 ⓘ</th>
                                    <th title="複合年均成長率">年化報酬 ⓘ</th>
                                    <th title="從最高點到最低點的最大跌幅">最大回撤 ⓘ</th>
                                    <th title="風險調整後報酬">夏普比率 ⓘ</th>
                                    <th>回測區間</th>
                                    <th>儲存時間</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {strategies.map((s) => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600 }}>{s.asset?.replace('.xlsx', '').replace('.xls', '')}</td>
                                        <td>{getStrategyLabel(s)}</td>
                                        <td>{s.direction === 'long_only' ? '僅做多' : '做多做空'}</td>
                                        <td>{s.leverage}x</td>
                                        <td style={{ color: s.total_return >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>
                                            {s.total_return}%
                                        </td>
                                        <td style={{ color: s.cagr >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>
                                            {s.cagr}%
                                        </td>
                                        <td style={{ color: '#ff7675' }}>{s.mdd}%</td>
                                        <td>{s.sharpe?.toFixed(2)}</td>
                                        <td style={{ fontSize: '0.875rem' }}>{s.backtest_period}</td>
                                        <td style={{ fontSize: '0.875rem', color: '#7f8c8d' }}>{s.created_at}</td>
                                        <td>
                                            <button
                                                onClick={() => handleDelete(s.id)}
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
                )}
            </div>
        </div>
    );
}

export default StrategiesPage;
