import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge } from 'antd';
import {
    DashboardOutlined, ToolOutlined, UserOutlined,
    TeamOutlined, AppstoreOutlined, FileTextOutlined,
    LogoutOutlined, BellOutlined, MenuFoldOutlined,
    MenuUnfoldOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';

const { Header, Sider, Content } = Layout;

const AppLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
        },
        {
            key: '/interventions',
            icon: <ToolOutlined />,
            label: 'Interventions',
        },
        {
            key: '/clients',
            icon: <UserOutlined />,
            label: 'Clients',
        },
        {
            key: '/techniciens',
            icon: <TeamOutlined />,
            label: 'Techniciens',
        },
        {
            key: '/pieces',
            icon: <AppstoreOutlined />,
            label: 'Pièces',
        },
        {
            key: '/factures',
            icon: <FileTextOutlined />,
            label: 'Factures',
        },
    ];

    const userMenu = {
        items: [
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Déconnexion',
                onClick: () => authService.logout(),
                danger: true
            }
        ]
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>

            {/* ─── SIDEBAR ─── */}
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
                    justifyContent: collapsed
                        ? 'center' : 'flex-start',
                    padding: collapsed ? 0 : '0 20px',
                    borderBottom: '1px solid #2a2a2a',
                    gap: 12
                }}>
                    <div style={{
                        width: 34,
                        height: 34,
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
                {/* ─── HEADER ─── */}
                <Header style={{
                    background: '#fff',
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    height: 64
                }}>
                    {/* Bouton collapse */}
                    <div
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: 8,
                            color: '#666',
                            fontSize: 18,
                            transition: 'all 0.2s',
                        }}
                    >
                        {collapsed ?
                            <MenuUnfoldOutlined /> :
                            <MenuFoldOutlined />}
                    </div>

                    {/* Actions droite */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20
                    }}>
                        {/* Notifications */}
                        <Badge count={3} size="small">
                            <BellOutlined style={{
                                fontSize: 18,
                                color: '#666',
                                cursor: 'pointer'
                            }} />
                        </Badge>

                        {/* Avatar */}
                        <Dropdown menu={userMenu}
                                  placement="bottomRight"
                                  arrow>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: 8,
                                transition: 'all 0.2s'
                            }}>
                                <Avatar
                                    style={{
                                        backgroundColor: '#FF8C00',
                                        fontSize: 14,
                                        fontWeight: 'bold'
                                    }}
                                >
                                    A
                                </Avatar>
                                <span style={{
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color: '#1A1A1A'
                                }}>
                                    Admin
                                </span>
                            </div>
                        </Dropdown>
                    </div>
                </Header>

                {/* ─── CONTENT ─── */}
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