import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { filesApi, backtestApi } from '../services/api';
import { Play, Settings } from 'lucide-react';

function BacktestPage() {
    const navigate = useNavigate();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState('');
    const [fromOptimize, setFromOptimize] = useState(false);
    const [optimizeInfo, setOptimizeInfo] = useState(null);
    const [presetFileId, setPresetFileId] = useState(null); // 新增：追蹤預設檔案

    const [params, setParams] = useState({
        initial_cash: 100000,
        leverage: 2.0,
        fee_rate: 0.001,
        slippage: 0.0005,
        strategy_mode: 'buy_and_hold',
        ma_fast: 20,
        ma_slow: 60,
        trade_direction: 'long_only',
        enable_rebalance: true,
        enable_yield: false,
        annual_yield: 0.04,
        start_date: '2015-01-01',
        end_date: new Date().toISOString().split('T')[0], // 今天
    });

    // 載入 localStorage 中的優化參數
    useEffect(() => {
        const optimizeParams = localStorage.getItem('optimizeParams');
        const optimizeFile = localStorage.getItem('optimizeFile');

        if (optimizeParams) {
            try {
                const parsed = JSON.parse(optimizeParams);
                console.log('=== 從優化頁面帶入的參數 ===', parsed);

                setFromOptimize(true);
                setOptimizeInfo({
                    strategy_mode: parsed.strategy_mode,
                    ma_fast: parsed.ma_fast,
                    ma_slow: parsed.ma_slow,
                    leverage: parsed.leverage,
                    start_date: parsed.start_date,
                    end_date: parsed.end_date,
                });

                setParams(prev => ({
                    ...prev,
                    strategy_mode: parsed.strategy_mode || prev.strategy_mode,
                    ma_fast: parsed.ma_fast || prev.ma_fast,
                    ma_slow: parsed.ma_slow || prev.ma_slow,
                    leverage: parsed.leverage || prev.leverage,
                    trade_direction: parsed.trade_direction || prev.trade_direction,
                    initial_cash: parsed.initial_cash || prev.initial_cash,
                    fee_rate: parsed.fee_rate !== undefined ? parsed.fee_rate : prev.fee_rate,
                    slippage: parsed.slippage !== undefined ? parsed.slippage : prev.slippage,
                    start_date: parsed.start_date || prev.start_date,
                    end_date: parsed.end_date || prev.end_date,
                }));
                localStorage.removeItem('optimizeParams');
            } catch (e) {
                console.error('解析優化參數失敗:', e);
            }
        }

        if (optimizeFile) {
            console.log('=== 從優化頁面帶入的檔案 ===', optimizeFile);
            setPresetFileId(optimizeFile);
            localStorage.removeItem('optimizeFile');
        }

        // 載入檔案列表
        loadFiles();
    }, []);

    // 當 files 載入後，根據 presetFileId 設定 selectedFile
    useEffect(() => {
        if (files.length === 0) return;

        if (presetFileId) {
            const fileExists = files.some(f => f.id === presetFileId);
            console.log('=== 設定預設檔案 ===', presetFileId, '存在:', fileExists);
            if (fileExists) {
                setSelectedFile(presetFileId);
                setPresetFileId(null); // 清除以避免重複設定
                return;
            }
        }

        // 若無預設檔案或找不到，且目前沒有選擇，則選第一個
        if (!selectedFile && files.length > 0) {
            setSelectedFile(files[0].id);
        }
    }, [files, presetFileId, selectedFile]);

    const loadFiles = async () => {
        try {
            const res = await filesApi.list();
            console.log('=== 載入檔案列表 ===', res.data.map(f => f.id));
            setFiles(res.data);
        } catch (err) {
            console.error('載入檔案失敗:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            alert('請選擇資料檔案');
            return;
        }

        setLoading(true);
        try {
            const res = await backtestApi.run(selectedFile, params);
            // 儲存結果到 localStorage 供結果頁面使用
            localStorage.setItem('backtestResult', JSON.stringify(res.data));
            localStorage.setItem('backtestParams', JSON.stringify(params));
            localStorage.setItem('backtestFile', selectedFile);
            navigate('/results');
        } catch (err) {
            alert('回測失敗: ' + (err.response?.data?.detail || err.message));
        }
        setLoading(false);
    };

    const strategyModes = [
        { value: 'buy_and_hold', label: '永遠做多 (Buy & Hold)' },
        { value: 'single_ma', label: '單均線策略' },
        { value: 'dual_ma', label: '雙均線策略' },
    ];

    const directions = [
        { value: 'long_only', label: '僅做多' },
        { value: 'long_short', label: '做多與做空' },
    ];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">⚙️ 策略設定</h1>
                <p className="page-subtitle">配置回測參數並執行策略回測</p>
            </div>

            {/* 從優化頁面帶入參數的提示 */}
            {fromOptimize && optimizeInfo && (
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <strong>📊 從優化結果帶入的參數：</strong>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.9 }}>
                            策略: {optimizeInfo.strategy_mode === 'dual_ma' ? `雙均線 ${optimizeInfo.ma_fast}/${optimizeInfo.ma_slow}` :
                                optimizeInfo.strategy_mode === 'single_ma' ? `單均線 ${optimizeInfo.ma_fast}` : '永遠做多'} |
                            槓桿: {optimizeInfo.leverage}x |
                            日期: {optimizeInfo.start_date || '(未設定)'} ~ {optimizeInfo.end_date || '(未設定)'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFromOptimize(false)}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        ✕ 關閉
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>

                    {/* 資料選擇 */}
                    <div className="card">
                        <h3 className="card-title">📁 資料選擇</h3>
                        <div className="form-group">
                            <label className="form-label">選擇資料檔案</label>
                            <select
                                className="form-select"
                                value={selectedFile}
                                onChange={(e) => setSelectedFile(e.target.value)}
                            >
                                <option value="">請選擇...</option>
                                {files.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.name} ({f.start_date} ~ {f.latest_date})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">起始日期</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={params.start_date}
                                    onChange={(e) => setParams({ ...params, start_date: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">結束日期</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={params.end_date}
                                    onChange={(e) => setParams({ ...params, end_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 核心參數 */}
                    <div className="card">
                        <h3 className="card-title">💰 核心參數</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">初始資金</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={params.initial_cash}
                                    onChange={(e) => setParams({ ...params, initial_cash: Number(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">槓桿倍數</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="form-input"
                                    value={params.leverage}
                                    onChange={(e) => setParams({ ...params, leverage: Number(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">手續費率 (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    value={params.fee_rate * 100}
                                    onChange={(e) => setParams({ ...params, fee_rate: Number(e.target.value) / 100 })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">滑價 (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-input"
                                    value={params.slippage * 100}
                                    onChange={(e) => setParams({ ...params, slippage: Number(e.target.value) / 100 })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 策略設定 */}
                    <div className="card">
                        <h3 className="card-title">📈 策略設定</h3>
                        <div className="form-group">
                            <label className="form-label">策略類型</label>
                            <select
                                className="form-select"
                                value={params.strategy_mode}
                                onChange={(e) => setParams({ ...params, strategy_mode: e.target.value })}
                            >
                                {strategyModes.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {params.strategy_mode !== 'buy_and_hold' && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">快線天數 (MA Fast)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={params.ma_fast}
                                            onChange={(e) => setParams({ ...params, ma_fast: Number(e.target.value) })}
                                        />
                                    </div>
                                    {params.strategy_mode === 'dual_ma' && (
                                        <div className="form-group">
                                            <label className="form-label">慢線天數 (MA Slow)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={params.ma_slow}
                                                onChange={(e) => setParams({ ...params, ma_slow: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">操作方向</label>
                                    <select
                                        className="form-select"
                                        value={params.trade_direction}
                                        onChange={(e) => setParams({ ...params, trade_direction: e.target.value })}
                                    >
                                        {directions.map(d => (
                                            <option key={d.value} value={d.value}>{d.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 進階設定 */}
                    <div className="card">
                        <h3 className="card-title">🔧 進階設定</h3>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={params.enable_rebalance}
                                    onChange={(e) => setParams({ ...params, enable_rebalance: e.target.checked })}
                                />
                                每月月初自動再平衡（維持目標槓桿）
                            </label>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={params.enable_yield}
                                    onChange={(e) => setParams({ ...params, enable_yield: e.target.checked })}
                                />
                                啟用逆價差收益
                            </label>
                        </div>

                        {params.enable_yield && (
                            <div className="form-group">
                                <label className="form-label">年化收益率 (%)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    className="form-input"
                                    value={params.annual_yield * 100}
                                    onChange={(e) => setParams({ ...params, annual_yield: Number(e.target.value) / 100 })}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        type="submit"
                        className="btn btn-success"
                        disabled={loading || !selectedFile}
                        style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}
                    >
                        {loading ? (
                            <><div className="spinner" style={{ width: 20, height: 20 }}></div> 執行中...</>
                        ) : (
                            <><Play size={20} /> 執行回測</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default BacktestPage;
