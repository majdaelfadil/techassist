import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api';

// ─── INSTANCE AXIOS ───
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── INTERCEPTEUR REQUEST ───
// Ajoute automatiquement le token JWT à chaque requête
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ─── INTERCEPTEUR RESPONSE ───
// Gère automatiquement le refresh du token
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 &&
            !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refresh = localStorage.getItem(
                    'refresh_token');
                const response = await axios.post(
                    `${API_URL}/auth/refresh/`,
                    { refresh }
                );
                localStorage.setItem(
                    'access_token',
                    response.data.access
                );
                originalRequest.headers.Authorization =
                    `Bearer ${response.data.access}`;
                return api(originalRequest);
            } catch (e) {
                localStorage.clear();
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;