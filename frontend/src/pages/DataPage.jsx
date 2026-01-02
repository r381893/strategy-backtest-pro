import { useState, useEffect } from 'react';
import { filesApi, yahooApi } from '../services/api';
import { Upload, Trash2, RefreshCw, FileSpreadsheet, Edit3, Plus, Save, X, ClipboardPaste, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function DataPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [uploading, setUploading] = useState(false);

    // 編輯模式相關狀態
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState([]);
    const [newRows, setNewRows] = useState([]);
    const [deletedIndices, setDeletedIndices] = useState([]);
    const [saving, setSaving] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState('');

    // Yahoo Finance 更新狀態
    const [updating, setUpdating] = useState({});
    const [updateAllLoading, setUpdateAllLoading] = useState(false);

    useEffect(() => {
        loadFiles();
    }, []);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const res = await filesApi.list();
            setFiles(res.data);
        } catch (err) {
            console.error('載入檔案失敗:', err);
        }
        setLoading(false);
    };

    const handleFileSelect = async (file) => {
        setSelectedFile(file);
        setEditMode(false);
        setEditData([]);
        setNewRows([]);
        setDeletedIndices([]);
        try {
            const res = await filesApi.preview(file.id);
            setPreviewData(res.data);
        } catch (err) {
            console.error('預覽失敗:', err);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            await filesApi.upload(file);
            loadFiles();
        } catch (err) {
            alert('上傳失敗: ' + (err.response?.data?.detail || err.message));
        }
        setUploading(false);
        e.target.value = '';
    };

    const handleDelete = async (fileId) => {
        if (!confirm('確定要刪除這個檔案嗎？')) return;
        try {
            await filesApi.delete(fileId);
            loadFiles();
            if (selectedFile?.id === fileId) {
                setSelectedFile(null);
                setPreviewData(null);
            }
        } catch (err) {
            alert('刪除失敗');
        }
    };

    // 從 Yahoo Finance 更新單一檔案
    const handleUpdateFromYahoo = async (fileId, e) => {
        if (e) e.stopPropagation();
        setUpdating(prev => ({ ...prev, [fileId]: true }));
        try {
            const res = await yahooApi.updateFile(fileId);
            if (res.data.status === 'success') {
                alert(`✅ 更新成功！\n新增 ${res.data.rows_added} 筆資料\n最新日期：${res.data.new_last_date}`);
                loadFiles();
                if (selectedFile?.id === fileId) {
                    handleFileSelect(selectedFile);
                }
            } else {
                alert(`ℹ️ ${res.data.message}`);
            }
        } catch (err) {
            const detail = err.response?.data?.detail || err.message;
            if (detail.includes('不支援')) {
                alert(`⚠️ 此檔案不支援自動更新\n\n支援的檔案：BTC、ETH、Doge、加權指數`);
            } else {
                alert(`❌ 更新失敗: ${detail}`);
            }
        }
        setUpdating(prev => ({ ...prev, [fileId]: false }));
    };

    // 更新所有支援的檔案
    const handleUpdateAll = async () => {
        if (!confirm('確定要更新所有支援的資料檔案嗎？\n\n這會從 Yahoo Finance 下載最新資料。')) return;
        setUpdateAllLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
            try {
                const res = await yahooApi.updateFile(file.id);
                if (res.data.status === 'success' || res.data.status === 'no_update') {
                    successCount++;
                }
            } catch (err) {
                // 忽略不支援的檔案
                if (!err.response?.data?.detail?.includes('不支援')) {
                    failCount++;
                }
            }
        }

        setUpdateAllLoading(false);
        loadFiles();
        alert(`✅ 更新完成！\n成功：${successCount} 個檔案\n失敗：${failCount} 個檔案`);
    };

    // 進入編輯模式
    const enterEditMode = async () => {
        if (!selectedFile) return;
        try {
            const res = await filesApi.getData(selectedFile.id, 50);
            setEditData(res.data.rows);
            setNewRows([]);
            setDeletedIndices([]);
            setEditMode(true);
        } catch (err) {
            alert('載入資料失敗: ' + (err.response?.data?.detail || err.message));
        }
    };

    // 退出編輯模式
    const exitEditMode = () => {
        setEditMode(false);
        setEditData([]);
        setNewRows([]);
        setDeletedIndices([]);
    };

    // 更新現有資料
    const handleEditRow = (index, field, value) => {
        setEditData(prev => prev.map((row, i) =>
            i === index ? { ...row, [field]: value, modified: true } : row
        ));
    };

    // 標記刪除
    const handleMarkDelete = (dataIndex) => {
        const row = editData[dataIndex];
        if (row.index !== undefined) {
            setDeletedIndices(prev => [...prev, row.index]);
        }
        setEditData(prev => prev.filter((_, i) => i !== dataIndex));
    };

    // 新增一列
    const addNewRow = () => {
        const lastDate = newRows.length > 0
            ? newRows[newRows.length - 1].date
            : editData.length > 0
                ? editData[editData.length - 1].date
                : new Date().toISOString().split('T')[0];

        // 計算下一個日期
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        setNewRows(prev => [...prev, { date: nextDateStr, close: '' }]);
    };

    // 更新新增的列
    const handleNewRowChange = (index, field, value) => {
        setNewRows(prev => prev.map((row, i) =>
            i === index ? { ...row, [field]: value } : row
        ));
    };

    // 刪除新增的列
    const removeNewRow = (index) => {
        setNewRows(prev => prev.filter((_, i) => i !== index));
    };

    // 批次貼上
    const handlePaste = () => {
        const lines = pasteText.trim().split('\n').filter(l => l.trim());
        const parsed = [];

        for (const line of lines) {
            // 支援 Tab 或空格分隔
            const parts = line.split(/[\t,\s]+/).filter(p => p.trim());
            if (parts.length >= 2) {
                const date = parts[0].trim();
                const close = parseFloat(parts[1].replace(/,/g, ''));
                if (date && !isNaN(close)) {
                    parsed.push({ date, close });
                }
            }
        }

        if (parsed.length > 0) {
            setNewRows(prev => [...prev, ...parsed]);
            setShowPasteModal(false);
            setPasteText('');
        } else {
            alert('無法解析貼上的資料，請確認格式為：日期<Tab>價格');
        }
    };

    // 儲存變更
    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. 刪除標記的列
            if (deletedIndices.length > 0) {
                await filesApi.deleteRows(selectedFile.id, deletedIndices);
            }

            // 2. 更新修改的列
            const modifiedRows = editData.filter(r => r.modified && r.index !== undefined);
            if (modifiedRows.length > 0) {
                await filesApi.update(selectedFile.id, modifiedRows.map(r => ({
                    index: r.index,
                    date: r.date,
                    close: parseFloat(r.close)
                })));
            }

            // 3. 追加新列
            const validNewRows = newRows.filter(r => r.date && r.close);
            if (validNewRows.length > 0) {
                await filesApi.append(selectedFile.id, validNewRows.map(r => ({
                    date: r.date,
                    close: parseFloat(r.close)
                })));
            }

            alert('儲存成功！');
            exitEditMode();
            loadFiles();
            handleFileSelect(selectedFile);
        } catch (err) {
            alert('儲存失敗: ' + (err.response?.data?.detail || err.message));
        }
        setSaving(false);
    };

    const getStatusClass = (status) => {
        if (status === 'fresh') return 'status-fresh';
        if (status === 'recent') return 'status-recent';
        return 'status-old';
    };

    const getStatusText = (file) => {
        if (file.days_ago === 0) return '今日最新';
        if (file.days_ago <= 7) return `${file.days_ago} 天前`;
        return `${file.days_ago} 天前`;
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">📁 資料管理</h1>
                <p className="page-subtitle">上傳和管理您的交易資料檔案</p>
            </div>

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 className="card-title" style={{ margin: 0 }}>本地資料檔案</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-primary" onClick={loadFiles}>
                            <RefreshCw size={18} /> 重新整理
                        </button>
                        <button
                            className="btn"
                            onClick={handleUpdateAll}
                            disabled={updateAllLoading}
                            style={{ background: '#6c5ce7', color: 'white' }}
                        >
                            <Download size={18} /> {updateAllLoading ? '更新中...' : '📡 更新全部'}
                        </button>
                        <label className="btn btn-success" style={{ cursor: 'pointer' }}>
                            <Upload size={18} /> 上傳檔案
                            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: 'none' }} />
                        </label>
                    </div>
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : files.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#7f8c8d', padding: '2rem' }}>
                        尚無資料檔案，請上傳 Excel 檔案
                    </p>
                ) : (
                    <div className="file-grid">
                        {files.map(file => (
                            <div
                                key={file.id}
                                className={`file-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                                onClick={() => handleFileSelect(file)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div className="file-name">
                                        <FileSpreadsheet size={18} style={{ marginRight: '0.5rem', color: '#667eea' }} />
                                        {file.name}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button
                                            onClick={(e) => handleUpdateFromYahoo(file.id, e)}
                                            disabled={updating[file.id]}
                                            title="從 Yahoo Finance 更新"
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: updating[file.id] ? '#b2bec3' : '#6c5ce7',
                                                animation: updating[file.id] ? 'spin 1s linear infinite' : 'none'
                                            }}
                                        >
                                            <Download size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff7675' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="file-info">
                                    <span>📅 {file.latest_date || 'N/A'}</span>
                                    <span className={`status-badge ${getStatusClass(file.status)}`}>
                                        {getStatusText(file)}
                                    </span>
                                </div>
                                <div className="file-info">
                                    <span>📊 {file.row_count?.toLocaleString()} 筆資料</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {previewData && !editMode && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h2 className="card-title" style={{ margin: 0 }}>📈 價格走勢預覽 - {previewData.name}</h2>
                            <p style={{ color: '#7f8c8d', margin: '0.5rem 0 0 0' }}>
                                資料範圍：{previewData.start_date} ~ {previewData.end_date}（共 {previewData.total_rows.toLocaleString()} 筆）
                            </p>
                        </div>
                        <button className="btn btn-primary" onClick={enterEditMode}>
                            <Edit3 size={18} /> 編輯資料
                        </button>
                    </div>
                    <div style={{ height: 400 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={previewData.chart_data}>
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(val) => val.slice(5)}
                                />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(val) => val.toLocaleString()}
                                />
                                <Tooltip
                                    formatter={(val) => [val.toLocaleString(), '價格']}
                                    labelFormatter={(label) => `日期: ${label}`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#667eea"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {editMode && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 className="card-title" style={{ margin: 0 }}>✏️ 編輯資料 - {selectedFile?.name}</h2>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn" onClick={() => setShowPasteModal(true)} style={{ background: '#00b894', color: 'white' }}>
                                <ClipboardPaste size={18} /> 批次貼上
                            </button>
                            <button className="btn" onClick={addNewRow} style={{ background: '#0984e3', color: 'white' }}>
                                <Plus size={18} /> 新增一筆
                            </button>
                            <button className="btn" onClick={exitEditMode} style={{ background: '#636e72', color: 'white' }}>
                                <X size={18} /> 取消
                            </button>
                            <button className="btn btn-success" onClick={handleSave} disabled={saving}>
                                <Save size={18} /> {saving ? '儲存中...' : '儲存變更'}
                            </button>
                        </div>
                    </div>

                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>日期</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>收盤價</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6', width: '80px' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {editData.map((row, index) => (
                                    <tr key={`existing-${index}`} style={{ background: row.modified ? '#fff3cd' : 'white' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #dee2e6' }}>
                                            <input
                                                type="date"
                                                value={row.date}
                                                onChange={(e) => handleEditRow(index, 'date', e.target.value)}
                                                style={{ padding: '0.25rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #dee2e6', textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                value={row.close}
                                                onChange={(e) => handleEditRow(index, 'close', e.target.value)}
                                                style={{ padding: '0.25rem', border: '1px solid #ced4da', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleMarkDelete(index)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff7675' }}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {newRows.map((row, index) => (
                                    <tr key={`new-${index}`} style={{ background: '#d4edda' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #dee2e6' }}>
                                            <input
                                                type="date"
                                                value={row.date}
                                                onChange={(e) => handleNewRowChange(index, 'date', e.target.value)}
                                                style={{ padding: '0.25rem', border: '1px solid #28a745', borderRadius: '4px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #dee2e6', textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                value={row.close}
                                                onChange={(e) => handleNewRowChange(index, 'close', e.target.value)}
                                                placeholder="輸入價格"
                                                style={{ padding: '0.25rem', border: '1px solid #28a745', borderRadius: '4px', textAlign: 'right', width: '120px' }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #dee2e6', textAlign: 'center' }}>
                                            <button
                                                onClick={() => removeNewRow(index)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff7675' }}
                                            >
                                                <X size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.875rem', color: '#666' }}>
                        💡 提示：黃色背景 = 已修改 | 綠色背景 = 新增資料
                    </div>
                </div>
            )}

            {/* 批次貼上對話框 */}
            {showPasteModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '500px', maxWidth: '90%' }}>
                        <h3 style={{ margin: '0 0 1rem 0' }}>📋 批次貼上資料</h3>
                        <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            從 Excel 複製資料後貼在下方，格式：日期[Tab]價格（每行一筆）
                        </p>
                        <textarea
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder="2025-12-20&#9;27000&#10;2025-12-21&#9;27150&#10;2025-12-22&#9;27300"
                            style={{
                                width: '100%', height: '200px', padding: '0.75rem',
                                border: '1px solid #ced4da', borderRadius: '8px',
                                fontFamily: 'monospace', fontSize: '0.875rem'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn" onClick={() => setShowPasteModal(false)} style={{ background: '#636e72', color: 'white' }}>
                                取消
                            </button>
                            <button className="btn btn-success" onClick={handlePaste}>
                                確認貼上
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DataPage;

