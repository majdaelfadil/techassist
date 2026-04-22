import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge }
    from 'antd';
import {
    DashboardOutlined, ToolOutlined,
    UserOutlined, TeamOutlined,
    AppstoreOutlined, FileTextOutlined,
    LogoutOutlined, BellOutlined,
    MenuFoldOutlined, MenuUnfoldOutlined,
    CalendarOutlined, CustomerServiceOutlined
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
        // Menu de base commun à tous
        const baseItems = [
            {
                key: '/dashboard',
                icon: <DashboardOutlined />,
                label: 'Dashboard',
            },
        ];
        
        // Ajouter les items spécifiques selon le rôle
        if (role === 'agent') {
            baseItems.push(
                { key: '/clients', icon: <CustomerServiceOutlined />, label: 'Clients' },
                { key: '/appareils', icon: <AppstoreOutlined />, label: 'Appareils' },
                { key: '/interventions', icon: <ToolOutlined />, label: 'Interventions' },
                { key: '/pieces', icon: <AppstoreOutlined />, label: 'Stock Pièces' },
                { key: '/factures', icon: <FileTextOutlined />, label: 'Factures' }
            );
        } else if (role === 'responsable') {
            // ✅ Responsable : Dashboard, Interventions, Techniciens, Rapports, Stock Pièces
            baseItems.push(
                { key: '/interventions', icon: <ToolOutlined />, label: 'Interventions' },
                { key: '/pieces', icon: <AppstoreOutlined />, label: 'Stock Pièces' },
                { key: '/techniciens', icon: <TeamOutlined />, label: 'Techniciens' },
                { key: '/rapports', icon: <FileTextOutlined />, label: 'Rapports' }
                // ❌ Pas de Clients
                // ❌ Pas d'Agents
                // ❌ Pas de Factures
                // ❌ Pas de Planning
            );
        } else if (role === 'technicien') {
            baseItems.push(
                { key: '/interventions', icon: <ToolOutlined />, label: 'Mes Interventions' },
                { key: '/planning', icon: <CalendarOutlined />, label: 'Mon Planning' },
                { key: '/pieces', icon: <AppstoreOutlined />, label: 'Pièces' },
                { key: '/rapports', icon: <FileTextOutlined />, label: 'Mes Rapports' }
            );
        }
        
        return baseItems;
    };

    const menuItems = getMenuItems();

    const couleurRole = {
        'responsable': '#FF8C00',
        'agent':       '#1890ff',
        'technicien':  '#52c41a'
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
                            {role === 'responsable' ? 'RESPONSABLE' : 
                             role === 'agent' ? 'AGENT' : 'TECHNICIEN'}
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
                                        {role === 'responsable' ? 'Responsable' : 
                                         role === 'agent' ? 'Agent' : 'Technicien'}
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