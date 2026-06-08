// frontend/src/services/api.js

import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8000/api',
});

// ─── Intercepteur requête ───
api.interceptors.request.use((config) => {

    // Ajouter token JWT
    const token = localStorage.getItem(
        'access_token');
    if (token) {
        config.headers['Authorization'] =
            `Bearer ${token}`;
    }

    // ✅ Pour FormData (upload images) :
    // Supprimer Content-Type pour qu'Axios
    // génère automatiquement le bon boundary
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    return config;
});

// ─── Intercepteur réponse ───
api.interceptors.response.use(
    (response) => response,

    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 &&
            !original._retry) {
            original._retry = true;

            try {
                const refresh =
                    localStorage.getItem(
                        'refresh_token');

                const res = await axios.post(
                    'http://localhost:8000/api'
                    + '/auth/refresh/',
                    { refresh }
                );

                const newAccess = res.data.access;
                localStorage.setItem(
                    'access_token', newAccess);

                original.headers['Authorization'] =
                    `Bearer ${newAccess}`;

                // ✅ FormData intact après refresh
                if (original.data instanceof
                        FormData) {
                    delete original.headers[
                        'Content-Type'];
                }

                return api(original);

            } catch {
                localStorage.clear();
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;