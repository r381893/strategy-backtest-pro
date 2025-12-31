import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 檔案相關 API
export const filesApi = {
    list: () => api.get('/api/files'),
    upload: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/api/files/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    preview: (fileId, limit = 500) => api.get(`/api/files/${fileId}/preview?limit=${limit}`),
    delete: (fileId) => api.delete(`/api/files/${fileId}`),
};

// 回測相關 API
export const backtestApi = {
    run: (fileId, params) => api.post('/api/backtest/run', { file_id: fileId, params }),
};

// 策略相關 API
export const strategiesApi = {
    list: () => api.get('/api/strategies'),
    save: (strategy) => api.post('/api/strategies', strategy),
    delete: (strategyId) => api.delete(`/api/strategies/${strategyId}`),
};

// 優化相關 API
export const optimizeApi = {
    run: (request) => api.post('/api/optimize/run', request),
};

export default api;
