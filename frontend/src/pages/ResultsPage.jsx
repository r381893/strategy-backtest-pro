import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Save } from 'lucide-react';
import { strategiesApi } from '../services/api';

function ResultsPage() {
    const [result, setResult] = useState(null);
    const [params, setParams] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const savedResult = localStorage.getItem('backtestResult');
        const savedParams = localStorage.getItem('backtestParams');
        if (savedResult) setResult(JSON.parse(savedResult));
        if (savedParams) setParams(JSON.parse(savedParams));
    }, []);

    const handleSave = async () => {
        if (!result || !params) return;

        setSaving(true);
        try {
            await strategiesApi.save({
                name: `策略_${new Date().toISOString().slice(0, 10)}`,
                asset: localStorage.getItem('backtestFile') || 'Unknown',
                strategy_type: params.strategy_mode,
                direction: params.trade_direction,
                ma_period: params.ma_fast,
                leverage: params.leverage,
                total_return: result.total_return,
                cagr: result.cagr,
                mdd: result.mdd,
                sharpe: result.sharpe_ratio,
                calmar: result.calmar_ratio,
                backtest_period: `${result.equity_curve[0]?.date || ''} ~ ${result.equity_curve[result.equity_curve.length - 1]?.date || ''}`,
                params,
            });
            alert('策略已儲存！');
        } catch (err) {
            alert('儲存失敗: ' + err.message);
        }
        setSaving(false);
    };

    if (!result) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">📊 回測報表</h1>
                    <p className="page-subtitle">查看回測結果與績效指標</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#7f8c8d' }}>尚無回測結果，請先執行回測</p>
                </div>
            </div>
        );
    }

    const metrics = [
        { label: '總報酬率', value: `${result.total_return}%`, positive: result.total_return >= 0, tooltip: '投資期間的總收益百分比' },
        { label: '年化報酬率 (CAGR)', value: `${result.cagr}%`, positive: result.cagr >= 0, tooltip: '複合年均成長率，將總報酬換算成每年平均報酬' },
        { label: '最大回撤 (MDD)', value: `${result.mdd}%`, positive: false, tooltip: '從最高點到最低點的最大跌幅，衡量最壞情況的虧損' },
        { label: '夏普比率', value: result.sharpe_ratio.toFixed(2), positive: result.sharpe_ratio >= 1, tooltip: '風險調整後報酬，>1 表示每承擔 1 單位風險獲得 >1 單位報酬' },
        { label: '索提諾比率', value: result.sortino_ratio.toFixed(2), positive: result.sortino_ratio >= 1, tooltip: '只考慮下行風險的報酬比率，比夏普更關注虧損' },
        { label: '卡瑪比率', value: result.calmar_ratio.toFixed(2), positive: result.calmar_ratio >= 1, tooltip: '年化報酬除以最大回撤，衡量報酬與風險的關係' },
        { label: '總交易筆數', value: result.total_trades, positive: true, tooltip: '回測期間的總交易次數' },
        { label: '勝率', value: `${result.win_rate}%`, positive: result.win_rate >= 50, tooltip: '獲利交易佔總交易的百分比' },
        { label: '獲利因子', value: result.profit_factor.toFixed(2), positive: result.profit_factor >= 1, tooltip: '總獲利除以總虧損，>1 表示賺的比虧的多' },
    ];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📊 回測報表</h1>
                <p className="page-subtitle">
                    回測區間：{result.equity_curve[0]?.date} ~ {result.equity_curve[result.equity_curve.length - 1]?.date}
                </p>
            </div>

            {/* 績效指標 */}
            <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
                {metrics.map((m, i) => (
                    <div key={i} className="metric-card" title={m.tooltip} style={{ cursor: 'help' }}>
                        <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {m.label}
                            <span style={{ fontSize: '0.7rem', color: '#95a5a6' }}>ⓘ</span>
                        </div>
                        <div className={`metric-value ${m.positive ? 'positive' : 'negative'}`}>
                            {m.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* 權益曲線 */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>📈 權益曲線</h3>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={18} /> {saving ? '儲存中...' : '儲存策略'}
                    </button>
                </div>
                <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={result.equity_curve}>
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 12 }}
                                tickFormatter={(val) => val.slice(5)}
                            />
                            <YAxis
                                tick={{ fontSize: 12 }}
                                tickFormatter={(val) => val.toLocaleString()}
                            />
                            <Tooltip
                                formatter={(val) => [`$${val.toLocaleString()}`, '淨值']}
                                labelFormatter={(label) => `日期: ${label}`}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#667eea"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 年度報酬 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="card">
                    <h3 className="card-title">📊 年度報酬率</h3>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={result.yearly_returns}>
                                <XAxis dataKey="year" />
                                <YAxis tickFormatter={(val) => `${val}%`} />
                                <Tooltip formatter={(val) => [`${val}%`, '報酬率']} />
                                <Bar dataKey="return">
                                    {result.yearly_returns.map((entry, index) => (
                                        <Cell key={index} fill={entry.return >= 0 ? '#00b894' : '#ff7675'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h3 className="card-title">📉 年度最大回撤</h3>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={result.yearly_mdd}>
                                <XAxis dataKey="year" />
                                <YAxis tickFormatter={(val) => `${val}%`} />
                                <Tooltip formatter={(val) => [`${val}%`, '最大回撤']} />
                                <Bar dataKey="mdd" fill="#ff7675" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ResultsPage;
