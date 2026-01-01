import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { filesApi, optimizeApi } from '../services/api';
import { Search, Trophy, Settings, ChevronDown, ChevronUp, Play, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function OptimizePage() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // 圖表相關狀態
    const [expandedRow, setExpandedRow] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [chartLoading, setChartLoading] = useState(false);

    const [config, setConfig] = useState({
        strategy_modes: ['buy_and_hold', 'single_ma', 'dual_ma'],
        ma_fast_range: [5, 10, 20, 30, 60],
        ma_slow_range: [60, 120, 200],
        leverage_range: [1.0, 2.0, 3.0],
        directions: ['long_only', 'long_short'],
        initial_cash: 100000,
        fee_rate: 0.001,
        slippage: 0.0005,
        top_n: 10,
        sort_by: 'sharpe_ratio',
        start_date: '2015-01-01',
        end_date: new Date().toISOString().split('T')[0], // 今天
    });

    // 可選的值
    const allStrategies = [
        { value: 'buy_and_hold', label: '永遠做多' },
        { value: 'single_ma', label: '單均線策略' },
        { value: 'dual_ma', label: '雙均線策略' },
    ];

    const allDirections = [
        { value: 'long_only', label: '僅做多' },
        { value: 'long_short', label: '做多與做空' },
    ];

    const allMaFast = [5, 10, 20, 30, 60, 120];
    const allMaSlow = [60, 120, 200, 240];
    const allLeverage = [1.0, 1.5, 2.0, 2.5, 3.0];

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        try {
            const res = await filesApi.list();
            setFiles(res.data);
            if (res.data.length > 0) setSelectedFile(res.data[0].id);
        } catch (err) {
            console.error('載入檔案失敗');
        }
    };

    const handleOptimize = async () => {
        if (!selectedFile) {
            alert('請選擇資料檔案');
            return;
        }

        setLoading(true);
        setExpandedRow(null);
        setChartData(null);
        try {
            const res = await optimizeApi.run({ file_id: selectedFile, ...config });
            setResults(res.data);
        } catch (err) {
            alert('優化失敗: ' + (err.response?.data?.detail || err.message));
        }
        setLoading(false);
    };

    // 使用此策略 - 跳轉到回測頁面
    const handleUseStrategy = (result) => {
        const params = {
            strategy_mode: result.strategy_type,
            ma_fast: result.ma_fast || 20,
            ma_slow: result.ma_slow || 60,
            leverage: result.leverage,
            trade_direction: result.direction,
            initial_cash: config.initial_cash,
            fee_rate: config.fee_rate,
            slippage: config.slippage,
            start_date: config.start_date,
            end_date: config.end_date,
        };
        localStorage.setItem('optimizeParams', JSON.stringify(params));
        localStorage.setItem('optimizeFile', selectedFile);
        navigate('/backtest');
    };

    // 查看圖表
    const handleToggleChart = async (index, result) => {
        if (expandedRow === index) {
            setExpandedRow(null);
            setChartData(null);
            return;
        }

        setExpandedRow(index);
        setChartLoading(true);
        try {
            const res = await optimizeApi.getChart({
                file_id: selectedFile,
                ma_fast: result.ma_fast || 20,
                ma_slow: result.ma_slow || null,
                limit: 300
            });
            setChartData(res.data);
        } catch (err) {
            console.error('載入圖表失敗:', err);
        }
        setChartLoading(false);
    };

    const toggleStrategy = (value) => {
        const current = config.strategy_modes;
        if (current.includes(value)) {
            if (current.length > 1) {
                setConfig({ ...config, strategy_modes: current.filter(v => v !== value) });
            }
        } else {
            setConfig({ ...config, strategy_modes: [...current, value] });
        }
    };

    const toggleDirection = (value) => {
        const current = config.directions;
        if (current.includes(value)) {
            if (current.length > 1) {
                setConfig({ ...config, directions: current.filter(v => v !== value) });
            }
        } else {
            setConfig({ ...config, directions: [...current, value] });
        }
    };

    const toggleMaFast = (value) => {
        const current = config.ma_fast_range;
        if (current.includes(value)) {
            if (current.length > 1) {
                setConfig({ ...config, ma_fast_range: current.filter(v => v !== value) });
            }
        } else {
            setConfig({ ...config, ma_fast_range: [...current, value].sort((a, b) => a - b) });
        }
    };

    const toggleMaSlow = (value) => {
        const current = config.ma_slow_range;
        if (current.includes(value)) {
            if (current.length > 1) {
                setConfig({ ...config, ma_slow_range: current.filter(v => v !== value) });
            }
        } else {
            setConfig({ ...config, ma_slow_range: [...current, value].sort((a, b) => a - b) });
        }
    };

    const toggleLeverage = (value) => {
        const current = config.leverage_range;
        if (current.includes(value)) {
            if (current.length > 1) {
                setConfig({ ...config, leverage_range: current.filter(v => v !== value) });
            }
        } else {
            setConfig({ ...config, leverage_range: [...current, value].sort((a, b) => a - b) });
        }
    };

    const sortOptions = [
        { value: 'sharpe_ratio', label: 'Sharpe Ratio' },
        { value: 'total_return', label: '總報酬率' },
        { value: 'cagr', label: 'CAGR' },
        { value: 'calmar_ratio', label: 'Calmar Ratio' },
    ];

    const getStrategyLabel = (mode) => {
        const labels = { 'buy_and_hold': '永遠做多', 'single_ma': '單均線', 'dual_ma': '雙均線' };
        return labels[mode] || mode;
    };

    const chipStyle = (active) => ({
        padding: '0.5rem 1rem',
        borderRadius: '20px',
        border: active ? '2px solid #667eea' : '2px solid #e0e6ed',
        background: active ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
        color: active ? 'white' : '#2c3e50',
        cursor: 'pointer',
        fontWeight: 500,
        fontSize: '0.875rem',
        transition: 'all 0.2s ease',
    });

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔍 參數優化</h1>
                <p className="page-subtitle">自動尋找最佳策略參數組合</p>
            </div>

            <div className="card">
                <h3 className="card-title">⚙️ 基本設定</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">資料檔案</label>
                        <select className="form-select" value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
                            {files.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">初始資金</label>
                        <input type="number" className="form-input" value={config.initial_cash}
                            onChange={(e) => setConfig({ ...config, initial_cash: Number(e.target.value) })} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">顯示前 N 名</label>
                        <input type="number" className="form-input" value={config.top_n}
                            onChange={(e) => setConfig({ ...config, top_n: Number(e.target.value) })} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">排序依據</label>
                        <select className="form-select" value={config.sort_by} onChange={(e) => setConfig({ ...config, sort_by: e.target.value })}>
                            {sortOptions.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                        </select>
                    </div>
                </div>

                {/* 時間範圍設定 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">開始日期</label>
                        <input
                            type="date"
                            className="form-input"
                            value={config.start_date}
                            onChange={(e) => setConfig({ ...config, start_date: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">結束日期</label>
                        <input
                            type="date"
                            className="form-input"
                            value={config.end_date}
                            onChange={(e) => setConfig({ ...config, end_date: e.target.value })}
                        />
                    </div>
                </div>

                {/* 策略類型選擇 */}
                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                    <label className="form-label">策略類型</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {allStrategies.map(s => (
                            <span key={s.value} style={chipStyle(config.strategy_modes.includes(s.value))}
                                onClick={() => toggleStrategy(s.value)}>{s.label}</span>
                        ))}
                    </div>
                </div>

                {/* 交易方向選擇 */}
                <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">交易方向</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {allDirections.map(d => (
                            <span key={d.value} style={chipStyle(config.directions.includes(d.value))}
                                onClick={() => toggleDirection(d.value)}>{d.label}</span>
                        ))}
                    </div>
                </div>

                {/* 進階設定切換 */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e0e6ed', paddingTop: '1rem' }}>
                    <button onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#667eea', fontWeight: 600 }}>
                        <Settings size={18} />
                        進階參數設定
                        {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {showAdvanced && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                            {/* 快線範圍 */}
                            <div className="form-group">
                                <label className="form-label">快線 MA 天數</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {allMaFast.map(v => (
                                        <span key={v} style={chipStyle(config.ma_fast_range.includes(v))}
                                            onClick={() => toggleMaFast(v)}>{v}</span>
                                    ))}
                                </div>
                            </div>

                            {/* 慢線範圍 */}
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="form-label">慢線 MA 天數</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {allMaSlow.map(v => (
                                        <span key={v} style={chipStyle(config.ma_slow_range.includes(v))}
                                            onClick={() => toggleMaSlow(v)}>{v}</span>
                                    ))}
                                </div>
                            </div>

                            {/* 槓桿範圍 */}
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label className="form-label">槓桿倍數</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {allLeverage.map(v => (
                                        <span key={v} style={chipStyle(config.leverage_range.includes(v))}
                                            onClick={() => toggleLeverage(v)}>{v}x</span>
                                    ))}
                                </div>
                            </div>

                            {/* 手續費與滑價 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">手續費率 (%)</label>
                                    <input type="number" step="0.01" className="form-input" value={config.fee_rate * 100}
                                        onChange={(e) => setConfig({ ...config, fee_rate: Number(e.target.value) / 100 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">滑價 (%)</label>
                                    <input type="number" step="0.01" className="form-input" value={config.slippage * 100}
                                        onChange={(e) => setConfig({ ...config, slippage: Number(e.target.value) / 100 })} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <button className="btn btn-success" onClick={handleOptimize} disabled={loading} style={{ padding: '0.875rem 2rem' }}>
                        {loading ? (<><div className="spinner" style={{ width: 20, height: 20 }}></div> 優化中...</>) : (<><Search size={20} /> 開始優化</>)}
                    </button>
                </div>
            </div>

            {results.length > 0 && (
                <div className="card">
                    <h3 className="card-title">
                        <Trophy size={20} style={{ marginRight: '0.5rem', color: '#f39c12' }} />
                        Top {results.length} 最佳策略
                    </h3>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>排名</th><th>策略</th><th>方向</th><th>均線</th><th>槓桿</th>
                                    <th title="投資期間的總收益百分比">總報酬 ⓘ</th>
                                    <th title="複合年均成長率，將總報酬換算成每年平均報酬">年化報酬 ⓘ</th>
                                    <th title="從最高點到最低點的最大跌幅">最大回撤 ⓘ</th>
                                    <th title="風險調整後報酬，>1 表示每承擔 1 單位風險獲得 >1 單位報酬">夏普 ⓘ</th>
                                    <th title="年化報酬除以最大回撤，衡量報酬與風險的關係">卡瑪 ⓘ</th>
                                    <th title="獲利交易佔總交易的百分比">勝率 ⓘ</th>
                                    <th style={{ width: '140px' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <>
                                        <tr key={i}>
                                            <td>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    width: 28, height: 28, borderRadius: '50%',
                                                    background: i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : i === 2 ? '#cd6133' : '#e0e6ed',
                                                    color: i < 3 ? 'white' : '#2c3e50', fontWeight: 600, fontSize: '0.875rem',
                                                }}>{i + 1}</span>
                                            </td>
                                            <td>{getStrategyLabel(r.strategy_type)}</td>
                                            <td>{r.direction === 'long_only' ? '僅做多' : '做多做空'}</td>
                                            <td>{r.strategy_type === 'buy_and_hold' ? '-' : r.ma_slow ? `${r.ma_fast}/${r.ma_slow}` : r.ma_fast}</td>
                                            <td>{r.leverage}x</td>
                                            <td style={{ color: r.total_return >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>{r.total_return}%</td>
                                            <td style={{ color: r.cagr >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>{r.cagr}%</td>
                                            <td style={{ color: '#ff7675' }}>{r.mdd}%</td>
                                            <td style={{ fontWeight: 600 }}>{r.sharpe_ratio.toFixed(2)}</td>
                                            <td>{r.calmar_ratio.toFixed(2)}</td>
                                            <td>{r.win_rate}%</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                    <button
                                                        onClick={() => handleUseStrategy(r)}
                                                        style={{
                                                            padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                                                            background: '#00b894', color: 'white', border: 'none',
                                                            borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                        }}
                                                    >
                                                        <Play size={12} /> 使用
                                                    </button>
                                                    {r.strategy_type !== 'buy_and_hold' && (
                                                        <button
                                                            onClick={() => handleToggleChart(i, r)}
                                                            style={{
                                                                padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                                                                background: expandedRow === i ? '#667eea' : '#74b9ff', color: 'white', border: 'none',
                                                                borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem'
                                                            }}
                                                        >
                                                            <TrendingUp size={12} /> 圖表
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRow === i && (
                                            <tr key={`chart-${i}`}>
                                                <td colSpan={12} style={{ padding: '1rem', background: '#f8fafc' }}>
                                                    {chartLoading ? (
                                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                                            <div className="spinner"></div>
                                                        </div>
                                                    ) : chartData ? (
                                                        <div>
                                                            <h4 style={{ margin: '0 0 1rem 0' }}>
                                                                📈 價格走勢 + 均線 ({r.ma_slow ? `${r.ma_fast}/${r.ma_slow}` : r.ma_fast})
                                                            </h4>
                                                            <div style={{ height: 300 }}>
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <LineChart data={chartData.data}>
                                                                        <XAxis
                                                                            dataKey="date"
                                                                            tick={{ fontSize: 10 }}
                                                                            tickFormatter={(val) => val.slice(5)}
                                                                        />
                                                                        <YAxis
                                                                            tick={{ fontSize: 10 }}
                                                                            domain={['auto', 'auto']}
                                                                            tickFormatter={(val) => val.toLocaleString()}
                                                                        />
                                                                        <Tooltip
                                                                            formatter={(val) => val ? val.toLocaleString() : '-'}
                                                                            labelFormatter={(label) => `日期: ${label}`}
                                                                        />
                                                                        <Legend />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="price"
                                                                            stroke="#2c3e50"
                                                                            strokeWidth={1.5}
                                                                            dot={false}
                                                                            name="價格"
                                                                        />
                                                                        <Line
                                                                            type="monotone"
                                                                            dataKey="ma_fast"
                                                                            stroke="#e74c3c"
                                                                            strokeWidth={2}
                                                                            dot={false}
                                                                            name={`MA${chartData.ma_fast}`}
                                                                            connectNulls
                                                                        />
                                                                        {chartData.ma_slow && (
                                                                            <Line
                                                                                type="monotone"
                                                                                dataKey="ma_slow"
                                                                                stroke="#3498db"
                                                                                strokeWidth={2}
                                                                                dot={false}
                                                                                name={`MA${chartData.ma_slow}`}
                                                                                connectNulls
                                                                            />
                                                                        )}
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OptimizePage;

