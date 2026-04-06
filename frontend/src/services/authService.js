import api from './api';

const authService = {
    login: async (username, password) => {
        const response = await api.post(
            '/auth/login/',
            { username, password }
        );
        localStorage.setItem(
            'access_token',
            response.data.access);
        localStorage.setItem(
            'refresh_token',
            response.data.refresh);

        const profil = await api.get('/auth/profil/');
        localStorage.setItem(
            'user_role', profil.data.role);
        localStorage.setItem(
            'user_nom', profil.data.nom);
        localStorage.setItem(
            'user_id', profil.data.id);

        if (profil.data.technicien_id) {
            localStorage.setItem(
                'technicien_id',
                profil.data.technicien_id);
        }
        if (profil.data.agent_id) {
            localStorage.setItem(
                'agent_id',
                profil.data.agent_id);
        }

        return profil.data;
    },

    logout: () => {
        localStorage.clear();
        window.location.href = '/login';
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('access_token');
    },

    getRole: () => {
        return localStorage.getItem('user_role')
               || 'responsable';
    },

    getNom: () => {
        return localStorage.getItem('user_nom')
               || 'Utilisateur';
    },

    isResponsable: () => {
        return authService.getRole() ===
               'responsable';
    },

    isAgent: () => {
        return ['agent', 'responsable'].includes(
            authService.getRole());
    },

    isTechnicien: () => {
        return authService.getRole() ===
               'technicien';
    },

    getTechnicienId: () => {
        return localStorage.getItem('technicien_id');
    },

    getAgentId: () => {
        return localStorage.getItem('agent_id');
    }
};

export default authService;