import React from 'react';
import { BrowserRouter, Routes, Route, Navigate }
    from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AppLayout from './components/Layout';
import authService from './services/authService';
import Interventions from './pages/Interventions';


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
                
            </Routes>
        </BrowserRouter>
    );
}

export default App;