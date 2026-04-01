import api from './api';

const authService = {
    // ─── LOGIN ───
    login: async (username, password) => {
        const response = await api.post('/auth/login/', {
            username,
            password
        });
        localStorage.setItem('access_token',
                             response.data.access);
        localStorage.setItem('refresh_token',
                             response.data.refresh);
        return response.data;
    },

    // ─── LOGOUT ───
    logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
    },

    // ─── VÉRIFIER SI CONNECTÉ ───
    isAuthenticated: () => {
        return !!localStorage.getItem('access_token');
    }
};

export default authService;