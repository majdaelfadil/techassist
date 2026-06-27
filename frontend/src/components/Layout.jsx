import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge }
    from 'antd';
import {
    DashboardOutlined, ToolOutlined,
    UserOutlined, TeamOutlined,
    AppstoreOutlined, FileTextOutlined,
    LogoutOutlined, BellOutlined,
    MenuFoldOutlined, MenuUnfoldOutlined,
    CalendarOutlined, CustomerServiceOutlined, LaptopOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation }
    from 'react-router-dom';
import authService from '../services/authService';

const { Header, Sider, Content } = Layout;

const AppLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const role = authService.getRole();
    const nom = authService.getNom();

    // Configuration des menus par rôle
    const getMenuItems = () => {
        const dashboard = { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' };
        const interventions = { key: '/interventions', icon: <ToolOutlined />, label: 'Interventions' };
        const clients = { key: '/clients', icon: <CustomerServiceOutlined />, label: 'Clients' };
        const appareils = { key: '/appareils', icon: <LaptopOutlined />, label: 'Appareils' };
        const pieces = { key: '/pieces', icon: <AppstoreOutlined />, label: 'Stock Pièces' };
        const factures = { key: '/factures', icon: <FileTextOutlined />, label: 'Factures' };
        const techniciens = { key: '/techniciens', icon: <TeamOutlined />, label: 'Techniciens' };
        const planning = { key: '/planning', icon: <CalendarOutlined />, label: 'Planning' };
        const rapports = { key: '/rapports', icon: <FileTextOutlined />, label: 'Rapports' };

        if (role === 'admin') {
            return [
                dashboard,
                { key: '/admin', icon: <SettingOutlined />, label: 'Administration' },
                interventions, clients, appareils, pieces, factures,
                techniciens, planning, rapports,
            ];
        }
        if (role === 'responsable') {
            // Supervision : interventions, planning, techniciens, pièces, rapports
            return [
                dashboard, interventions, planning, techniciens, pieces, rapports,
            ];
        }
        if (role === 'agent') {
            // Accueil : interventions, clients, appareils, factures
            return [
                dashboard, interventions, clients, appareils, factures,
            ];
        }
        if (role === 'technicien') {
            return [
                dashboard,
                { key: '/interventions', icon: <ToolOutlined />, label: 'Mes Interventions' },
                { key: '/planning', icon: <CalendarOutlined />, label: 'Mon Planning' },
                { key: '/pieces', icon: <AppstoreOutlined />, label: 'Pièces' },
                { key: '/mes-rapports', icon: <FileTextOutlined />, label: 'Mes Rapports' },
            ];
        }
        return [dashboard];
    };

    const menuItems = getMenuItems();

    const couleurRole = {
        'admin':       '#722ed1',
        'responsable': '#FF8C00',
        'agent':       '#1890ff',
        'technicien':  '#52c41a'
    };
    const labelRole = {
        'admin': 'Administrateur',
        'responsable': 'Responsable',
        'agent': 'Agent',
        'technicien': 'Technicien'
    };

    const userMenu = {
        items: [{
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Déconnexion',
            onClick: () => {
                authService.logout();
                navigate('/login');
            },
            danger: true
        }]
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                trigger={null}
                collapsible
                collapsed={collapsed}
                width={220}
                style={{
                    background: '#1A1A1A',
                    boxShadow: '2px 0 8px rgba(0,0,0,0.15)'
                }}
            >
                {/* LOGO */}
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    padding: collapsed ? '0 16px' : '0 20px',
                    borderBottom: '1px solid #2a2a2a',
                    gap: 12
                }}>
                    <div style={{
                        width: 34, height: 34,
                        background: '#FF8C00',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#fff',
                        flexShrink: 0
                    }}>
                        MT
                    </div>
                    {!collapsed && (
                        <div>
                            <div style={{
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 700,
                                lineHeight: 1.2
                            }}>
                                Media Telecom
                            </div>
                            <div style={{
                                color: '#666',
                                fontSize: 10
                            }}>
                                TechAssist AI
                            </div>
                        </div>
                    )}
                </div>

                {/* RÔLE */}
                {!collapsed && (
                    <div style={{
                        padding: '10px 20px',
                        borderBottom: '1px solid #2a2a2a'
                    }}>
                        <span style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            color: couleurRole[role],
                            background: `${couleurRole[role]}22`
                        }}>
                            {(labelRole[role] || role).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* MENU */}
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    onClick={({ key }) => navigate(key)}
                    style={{
                        background: '#1A1A1A',
                        border: 'none',
                        marginTop: 8
                    }}
                    theme="dark"
                    items={menuItems}
                />
            </Sider>

            <Layout>
                {/* HEADER */}
                <Header style={{
                    background: '#fff',
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    height: 64
                }}>
                    <div
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            cursor: 'pointer',
                            padding: 8,
                            borderRadius: 8,
                            color: '#666',
                            fontSize: 18
                        }}
                    >
                        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20
                    }}>
                        <Badge count={3} size="small">
                            <BellOutlined style={{
                                fontSize: 18,
                                color: '#666',
                                cursor: 'pointer'
                            }} />
                        </Badge>

                        <Dropdown
                            menu={userMenu}
                            placement="bottomRight"
                            arrow
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: 8
                            }}>
                                <Avatar style={{
                                    backgroundColor: couleurRole[role],
                                    fontSize: 14,
                                    fontWeight: 'bold'
                                }}>
                                    {nom?.charAt(0)?.toUpperCase()}
                                </Avatar>
                                <div>
                                    <div style={{
                                        fontWeight: 600,
                                        fontSize: 13,
                                        color: '#1A1A1A',
                                        lineHeight: 1.2
                                    }}>
                                        {nom}
                                    </div>
                                    <div style={{
                                        fontSize: 11,
                                        color: couleurRole[role]
                                    }}>
                                        {labelRole[role] || role}
                                    </div>
                                </div>
                            </div>
                        </Dropdown>
                    </div>
                </Header>

                {/* CONTENT */}
                <Content style={{
                    background: '#f8f9fa',
                    minHeight: 'calc(100vh - 64px)',
                    overflow: 'auto'
                }}>
                    {children}
                </Content>
            </Layout>
        </Layout>
    );
};

export default AppLayout;