import React from 'react';
import { BrowserRouter, Routes, Route, Navigate }
    from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AppLayout from './components/Layout';
import authService from './services/authService';
import Interventions from './pages/Interventions';
import Clients from './pages/Clients';
import Techniciens from './pages/Techniciens';
import Pieces from './pages/Pieces';

const ProtectedRoute = ({ children }) => {
    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" />;
    }
    return <AppLayout>{children}</AppLayout>;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                
                <Route path="/" element={
                    <Navigate to="/dashboard" />
                } />
                <Route path="/interventions" element={<ProtectedRoute><Interventions /></ProtectedRoute>} />
                <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                <Route path="/techniciens" element={<ProtectedRoute><Techniciens /></ProtectedRoute>} /> 
                <Route path="/pieces" element={<ProtectedRoute><Pieces /></ProtectedRoute>} />              
            </Routes>
        </BrowserRouter>
    );
}

export default App;