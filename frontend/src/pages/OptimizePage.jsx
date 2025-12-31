import { useState, useEffect } from 'react';
import { filesApi, optimizeApi } from '../services/api';
import { Search, Trophy } from 'lucide-react';

function OptimizePage() {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);

    const [config, setConfig] = useState({
        strategy_modes: ['buy_and_hold', 'single_ma', 'dual_ma'],
        ma_fast_range: [5, 10, 20, 30, 60],
        ma_slow_range: [60, 120, 200],
        leverage_range: [1.0, 2.0, 3.0],
        directions: ['long_only', 'long_short'],
        initial_cash: 100000,
        top_n: 10,
        sort_by: 'sharpe_ratio',
    });

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
        try {
            const res = await optimizeApi.run({ file_id: selectedFile, ...config });
            setResults(res.data);
        } catch (err) {
            alert('優化失敗: ' + (err.response?.data?.detail || err.message));
        }
        setLoading(false);
    };

    const sortOptions = [
        { value: 'sharpe_ratio', label: 'Sharpe Ratio' },
        { value: 'total_return', label: '總報酬率' },
        { value: 'cagr', label: 'CAGR' },
        { value: 'calmar_ratio', label: 'Calmar Ratio' },
    ];

    const getStrategyLabel = (mode) => {
        const labels = {
            'buy_and_hold': '永遠做多',
            'single_ma': '單均線',
            'dual_ma': '雙均線',
        };
        return labels[mode] || mode;
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">🔍 參數優化</h1>
                <p className="page-subtitle">自動尋找最佳策略參數組合</p>
            </div>

            <div className="card">
                <h3 className="card-title">⚙️ 優化設定</h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">資料檔案</label>
                        <select
                            className="form-select"
                            value={selectedFile}
                            onChange={(e) => setSelectedFile(e.target.value)}
                        >
                            {files.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">初始資金</label>
                        <input
                            type="number"
                            className="form-input"
                            value={config.initial_cash}
                            onChange={(e) => setConfig({ ...config, initial_cash: Number(e.target.value) })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">顯示前 N 名</label>
                        <input
                            type="number"
                            className="form-input"
                            value={config.top_n}
                            onChange={(e) => setConfig({ ...config, top_n: Number(e.target.value) })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">排序依據</label>
                        <select
                            className="form-select"
                            value={config.sort_by}
                            onChange={(e) => setConfig({ ...config, sort_by: e.target.value })}
                        >
                            {sortOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <button
                        className="btn btn-success"
                        onClick={handleOptimize}
                        disabled={loading}
                        style={{ padding: '0.875rem 2rem' }}
                    >
                        {loading ? (
                            <><div className="spinner" style={{ width: 20, height: 20 }}></div> 優化中...</>
                        ) : (
                            <><Search size={20} /> 開始優化</>
                        )}
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
                                    <th>排名</th>
                                    <th>策略</th>
                                    <th>方向</th>
                                    <th>均線</th>
                                    <th>槓桿</th>
                                    <th>總報酬</th>
                                    <th>CAGR</th>
                                    <th>MDD</th>
                                    <th>Sharpe</th>
                                    <th>Calmar</th>
                                    <th>勝率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i}>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                background: i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : i === 2 ? '#cd6133' : '#e0e6ed',
                                                color: i < 3 ? 'white' : '#2c3e50',
                                                fontWeight: 600,
                                                fontSize: '0.875rem',
                                            }}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td>{getStrategyLabel(r.strategy_type)}</td>
                                        <td>{r.direction === 'long_only' ? '僅做多' : '做多做空'}</td>
                                        <td>
                                            {r.strategy_type === 'buy_and_hold' ? '-' :
                                                r.ma_slow ? `${r.ma_fast}/${r.ma_slow}` : r.ma_fast}
                                        </td>
                                        <td>{r.leverage}x</td>
                                        <td style={{ color: r.total_return >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>
                                            {r.total_return}%
                                        </td>
                                        <td style={{ color: r.cagr >= 0 ? '#00b894' : '#ff7675', fontWeight: 600 }}>
                                            {r.cagr}%
                                        </td>
                                        <td style={{ color: '#ff7675' }}>{r.mdd}%</td>
                                        <td style={{ fontWeight: 600 }}>{r.sharpe_ratio.toFixed(2)}</td>
                                        <td>{r.calmar_ratio.toFixed(2)}</td>
                                        <td>{r.win_rate}%</td>
                                    </tr>
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
