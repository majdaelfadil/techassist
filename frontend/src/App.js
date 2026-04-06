import React from 'react';
import {
    BrowserRouter, Routes, Route, Navigate
} from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Interventions from './pages/Interventions';
import MesInterventions from './pages/MesInterventions';
import Techniciens from './pages/Techniciens';
import Pieces from './pages/Pieces';
import Factures from './pages/Factures';
import Planning from './pages/Planning';
import AppLayout from './components/Layout';
import authService from './services/authService';

const ProtectedRoute = ({ children, roles }) => {
    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" />;
    }
    if (roles && !roles.includes(
            authService.getRole())) {
        return <Navigate to="/dashboard" />;
    }
    return <AppLayout>{children}</AppLayout>;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/login"
                    element={<Login />}
                />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Interventions selon le rôle */}
                <Route
                    path="/interventions"
                    element={
                        <ProtectedRoute>
                            {authService.isTechnicien() ?
                                <MesInterventions /> :
                                <Interventions />
                            }
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/planning"
                    element={
                        <ProtectedRoute
                            roles={['technicien']}>
                            <Planning />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/techniciens"
                    element={
                        <ProtectedRoute
                            roles={['responsable']}>
                            <Techniciens />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/pieces"
                    element={
                        <ProtectedRoute
                            roles={['responsable',
                                    'technicien']}>
                            <Pieces />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/factures"
                    element={
                        <ProtectedRoute
                            roles={['responsable']}>
                            <Factures />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/"
                    element={
                        <Navigate to="/dashboard" />
                    }
                />
                <Route
                    path="*"
                    element={
                        <Navigate to="/dashboard" />
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;