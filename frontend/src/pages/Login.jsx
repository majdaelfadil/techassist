import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined,
         ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

const Login = () => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onFinish = async (values) => {
        setLoading(true);
        try {
            await authService.login(
                values.username,
                values.password
            );
            message.success('Connexion réussie !');
            navigate('/dashboard');
        } catch (error) {
            message.error('Identifiants incorrects !');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            background: '#f8f9fa'
        }}>
            {/* ─── PANNEAU GAUCHE ─── */}
            <div style={{
                flex: 1,
                background: '#1A1A1A',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 60,
            }}>
                {/* Logo */}
                <div style={{
                    width: 80,
                    height: 80,
                    background: '#FF8C00',
                    borderRadius: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 32,
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: '#fff'
                }}>
                    MT
                </div>

                <h1 style={{
                    color: '#fff',
                    fontSize: 32,
                    fontWeight: 700,
                    marginBottom: 12,
                    textAlign: 'center'
                }}>
                    Media Telecom
                </h1>

                <p style={{
                    color: '#999',
                    fontSize: 16,
                    textAlign: 'center',
                    lineHeight: 1.6,
                    maxWidth: 300
                }}>
                    Votre partenaire des nouvelles technologies
                </p>

                {/* Décoration */}
                <div style={{
                    marginTop: 60,
                    display: 'flex',
                    gap: 12
                }}>
                    {['Interventions', 'Techniciens',
                      'Facturation', 'IA'].map((item) => (
                        <div key={item} style={{
                            padding: '6px 14px',
                            background: 'rgba(255,140,0,0.15)',
                            borderRadius: 20,
                            color: '#FF8C00',
                            fontSize: 12,
                            fontWeight: 500
                        }}>
                            {item}
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── PANNEAU DROIT ─── */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 60,
                background: '#fff'
            }}>
                <div style={{ width: '100%', maxWidth: 380 }}>

                    <h2 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#1A1A1A',
                        marginBottom: 8
                    }}>
                        Bon retour 👋
                    </h2>

                    <p style={{
                        color: '#666',
                        marginBottom: 40,
                        fontSize: 15
                    }}>
                        Connectez-vous à votre espace
                    </p>

                    <Form
                        name="login"
                        onFinish={onFinish}
                        layout="vertical"
                    >
                        <Form.Item
                            label={
                                <span style={{
                                    fontWeight: 600,
                                    color: '#1A1A1A'
                                }}>
                                    Nom d'utilisateur
                                </span>
                            }
                            name="username"
                            rules={[{
                                required: true,
                                message: 'Champ obligatoire'
                            }]}
                        >
                            <Input
                                prefix={
                                    <UserOutlined style={{
                                        color: '#FF8C00'
                                    }} />
                                }
                                placeholder="admin"
                                size="large"
                                style={{
                                    borderRadius: 10,
                                    border: '2px solid #E8E8E8',
                                    padding: '10px 14px'
                                }}
                            />
                        </Form.Item>

                        <Form.Item
                            label={
                                <span style={{
                                    fontWeight: 600,
                                    color: '#1A1A1A'
                                }}>
                                    Mot de passe
                                </span>
                            }
                            name="password"
                            rules={[{
                                required: true,
                                message: 'Champ obligatoire'
                            }]}
                        >
                            <Input.Password
                                prefix={
                                    <LockOutlined style={{
                                        color: '#FF8C00'
                                    }} />
                                }
                                placeholder="••••••••"
                                size="large"
                                style={{
                                    borderRadius: 10,
                                    border: '2px solid #E8E8E8',
                                    padding: '10px 14px'
                                }}
                            />
                        </Form.Item>

                        <Form.Item style={{ marginTop: 32 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                size="large"
                                block
                                icon={<ArrowRightOutlined />}
                                style={{
                                    height: 52,
                                    borderRadius: 10,
                                    fontSize: 16,
                                    fontWeight: 600,
                                    background: '#1A1A1A',
                                    borderColor: '#1A1A1A',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                Se connecter
                            </Button>
                        </Form.Item>
                    </Form>

                    <p style={{
                        textAlign: 'center',
                        color: '#999',
                        fontSize: 13,
                        marginTop: 24
                    }}>
                        TechAssist AI © 2026 — Media Telecom
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;