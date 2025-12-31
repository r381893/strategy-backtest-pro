import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

function TradesPage() {
    const [result, setResult] = useState(null);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const savedResult = localStorage.getItem('backtestResult');
        if (savedResult) setResult(JSON.parse(savedResult));
    }, []);

    if (!result || !result.trades) {
        return (
            <div>
                <div className="page-header">
                    <h1 className="page-title">📋 交易明細</h1>
                    <p className="page-subtitle">查看所有交易記錄</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#7f8c8d' }}>尚無交易記錄，請先執行回測</p>
                </div>
            </div>
        );
    }

    const filteredTrades = filter === 'all'
        ? result.trades
        : result.trades.filter(t => t.direction === filter);

    const handleExport = () => {
        const headers = ['方向', '進場日', '出場日', '進場價', '出場價', '單位', '進場資產', '出場資產', '損益', '損益%', '備註'];
        const rows = filteredTrades.map(t => [
            t.direction, t.entry_date, t.exit_date, t.entry_price, t.exit_price,
            t.units, t.cash_before || '', t.cash_after || '', t.pnl, t.pnl_pct, t.note
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'trades.csv';
        link.click();
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📋 交易明細</h1>
                <p className="page-subtitle">共 {result.trades.length} 筆交易記錄</p>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div className="tabs">
                        {['all', '做多', '做空', '再平衡'].map(f => (
                            <button
                                key={f}
                                className={`tab ${filter === f ? 'active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? '全部' : f}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn-primary" onClick={handleExport}>
                        <Download size={18} /> 匯出 CSV
                    </button>
                </div>

                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>方向</th>
                                <th>進場日</th>
                                <th>出場日</th>
                                <th>進場價</th>
                                <th>出場價</th>
                                <th>單位</th>
                                <th>進場資產</th>
                                <th>出場資產</th>
                                <th>損益</th>
                                <th>損益 %</th>
                                <th>備註</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTrades.map((trade, i) => (
                                <tr key={i}>
                                    <td>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            background: trade.direction === '做多' ? '#d4edda' :
                                                trade.direction === '做空' ? '#f8d7da' : '#fff3cd',
                                            color: trade.direction === '做多' ? '#155724' :
                                                trade.direction === '做空' ? '#721c24' : '#856404',
                                        }}>
                                            {trade.direction}
                                        </span>
                                    </td>
                                    <td>{trade.entry_date}</td>
                                    <td>{trade.exit_date}</td>
                                    <td>${trade.entry_price?.toLocaleString()}</td>
                                    <td>${trade.exit_price?.toLocaleString()}</td>
                                    <td>{trade.units?.toFixed(4)}</td>
                                    <td style={{ color: '#3498db', fontWeight: 500 }}>
                                        ${trade.cash_before?.toLocaleString() || '-'}
                                    </td>
                                    <td style={{
                                        color: trade.cash_after > trade.cash_before ? '#00b894' : '#ff7675',
                                        fontWeight: 500
                                    }}>
                                        ${trade.cash_after?.toLocaleString() || '-'}
                                    </td>
                                    <td style={{
                                        color: trade.pnl >= 0 ? '#00b894' : '#ff7675',
                                        fontWeight: 600
                                    }}>
                                        ${trade.pnl?.toLocaleString()}
                                    </td>
                                    <td style={{
                                        color: trade.pnl_pct >= 0 ? '#00b894' : '#ff7675',
                                        fontWeight: 600
                                    }}>
                                        {trade.pnl_pct}%
                                    </td>
                                    <td style={{ fontSize: '0.875rem', color: '#7f8c8d' }}>{trade.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredTrades.length === 0 && (
                    <p style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d' }}>
                        沒有符合條件的交易記錄
                    </p>
                )}
            </div>
        </div>
    );
}

export default TradesPage;
