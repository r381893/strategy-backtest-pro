import { useState, useEffect } from 'react';
import { filesApi } from '../services/api';
import { Upload, Trash2, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function DataPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [uploading, setUploading] = useState(false);

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
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff7675' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
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

            {previewData && (
                <div className="card">
                    <h2 className="card-title">📈 價格走勢預覽 - {previewData.name}</h2>
                    <p style={{ color: '#7f8c8d', marginBottom: '1rem' }}>
                        資料範圍：{previewData.start_date} ~ {previewData.end_date}（共 {previewData.total_rows.toLocaleString()} 筆）
                    </p>
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
        </div>
    );
}

export default DataPage;
