import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin } from 'antd';
import {
    ToolOutlined, CheckCircleOutlined,
    ClockCircleOutlined, WarningOutlined,
    RiseOutlined, TeamOutlined
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, PieChart,
         Pie, Cell, Legend } from 'recharts';
import api from '../services/api';



const COLORS = ['#FF8C00', '#1A1A1A', '#4CAF50',
                '#2196F3', '#9C27B0', '#F44336',
                '#00BCD4', '#FFB347', '#666'];

const StatCard = ({ title, value, icon, color, bg }) => (
    <Card
        bordered={false}
        style={{
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            background: '#fff',
            overflow: 'hidden',
            position: 'relative'
        }}
    >
        <div style={{
            position: 'absolute',
            top: 0, right: 0,
            width: 80, height: 80,
            background: bg,
            borderRadius: '0 16px 0 80px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '12px 12px 0 0'
        }}>
            {React.cloneElement(icon, {
                style: { fontSize: 22, color: color }
            })}
        </div>
        <Statistic
            title={
                <span style={{
                    color: '#666',
                    fontSize: 13,
                    fontWeight: 500
                }}>
                    {title}
                </span>
            }
            value={value}
            valueStyle={{
                color: color,
                fontSize: 32,
                fontWeight: 700
            }}
        />
    </Card>
);

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        chargerDonnees();
    }, []);

    const chargerDonnees = async () => {
        try {
            const [statsRes, interventionsRes] =
                await Promise.all([
                    api.get('/dashboard/stats/'),
                    api.get('/interventions/')
                ]);
            setStats(statsRes.data);
            setInterventions(
                interventionsRes.data.slice(0, 6));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };



    const colonnes = [
        {
            title: 'N° Intervention',
            dataIndex: 'numero',
            render: (text) => (
                <span style={{
                    color: '#FF8C00',
                    fontWeight: 700,
                    fontSize: 13
                }}>
                    {text}
                </span>
            )
        },
        {
            title: 'Client',
            dataIndex: 'client_nom',
            render: (text) => (
                <span style={{ fontWeight: 500 }}>
                    {text}
                </span>
            )
        },
        {
            title: 'Urgence',
            dataIndex: 'urgence',
            render: (urgence) => {
                const config = {
                    'faible':    { color: '#52c41a', bg: '#f6ffed' },
                    'normale':   { color: '#1890ff', bg: '#e6f7ff' },
                    'haute':     { color: '#fa8c16', bg: '#fff7e6' },
                    'critique':  { color: '#f5222d', bg: '#fff1f0' },
                };
                const c = config[urgence] || config['normale'];
                return (
                    <span style={{
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        color: c.color,
                        background: c.bg
                    }}>
                        {urgence?.toUpperCase()}
                    </span>
                );
            }
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => {
                const config = {
                    'nouveau':        '#1890ff',
                    'diagnostique':   '#13c2c2',
                    'assigne':        '#722ed1',
                    'en_cours':       '#fa8c16',
                    'attente_pieces': '#faad14',
                    'termine':        '#52c41a',
                    'valide':         '#a0d911',
                    'facture':        '#eb2f96',
                    'cloture':        '#8c8c8c',
                };
                return (
                    <Tag
                        color={config[statut]}
                        style={{
                            borderRadius: 6,
                            fontWeight: 500
                        }}
                    >
                        {statut?.toUpperCase()}
                    </Tag>
                );
            }
        },
    ];

    if (loading) return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '80vh'
        }}>
            <Spin size="large" />
        </div>
    );

    return (
        <div style={{ padding: 28 }}>

            {/* ─── TITRE ─── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#1A1A1A',
                    margin: 0
                }}>
                    Tableau de bord
                </h1>
                <p style={{
                    color: '#999',
                    margin: '4px 0 0',
                    fontSize: 14
                }}>
                    Vue d'ensemble de l'activité
                </p>
            </div>

            {/* ─── CARTES STATS ─── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} xl={6}>
                    <StatCard
                        title="Aujourd'hui"
                        value={stats?.stats
                            ?.interventions_aujourd_hui || 0}
                        icon={<ToolOutlined />}
                        color="#FF8C00"
                        bg="rgba(255,140,0,0.08)"
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <StatCard
                        title="En cours"
                        value={stats?.stats
                            ?.interventions_en_cours || 0}
                        icon={<ClockCircleOutlined />}
                        color="#1890ff"
                        bg="rgba(24,144,255,0.08)"
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <StatCard
                        title="Terminées"
                        value={stats?.stats
                            ?.interventions_terminees || 0}
                        icon={<CheckCircleOutlined />}
                        color="#52c41a"
                        bg="rgba(82,196,26,0.08)"
                    />
                </Col>
                <Col xs={24} sm={12} xl={6}>
                    <StatCard
                        title="En retard"
                        value={stats?.stats
                            ?.interventions_en_retard || 0}
                        icon={<WarningOutlined />}
                        color="#f5222d"
                        bg="rgba(245,34,45,0.08)"
                    />
                </Col>
            </Row>

            {/* ─── GRAPHIQUES ─── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={15}>
                    <Card
                        title={
                            <span style={{ fontWeight: 700 }}>
                                Interventions par statut
                            </span>
                        }
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow:
                                '0 2px 12px rgba(0,0,0,0.06)'
                        }}
                    >
                        <ResponsiveContainer
                            width="100%" height={240}>
                            <BarChart
                                data={stats?.par_statut || []}
                                margin={{ top: 5, right: 10,
                                          left: -20, bottom: 5 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#f0f0f0"
                                />
                                <XAxis
                                    dataKey="statut"
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                />
                                <Tooltip />
                                <Bar
                                    dataKey="count"
                                    fill="#FF8C00"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={40}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>

                <Col xs={24} lg={9}>
                    <Card
                        title={
                            <span style={{ fontWeight: 700 }}>
                                Par type de service
                            </span>
                        }
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow:
                                '0 2px 12px rgba(0,0,0,0.06)'
                        }}
                    >
                        <ResponsiveContainer
                            width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={stats?.par_type || []}
                                    dataKey="count"
                                    nameKey="type_service"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={3}
                                >
                                    {(stats?.par_type || [])
                                        .map((_, index) => (
                                        <Cell
                                            key={index}
                                            fill={COLORS[
                                                index %
                                                COLORS.length
                                            ]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(value) => (
                                        <span style={{
                                            fontSize: 11,
                                            color: '#666'
                                        }}>
                                            {value}
                                        </span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* ─── DERNIÈRES INTERVENTIONS ─── */}
            <Card
                title={
                    <span style={{ fontWeight: 700 }}>
                        Dernières interventions
                    </span>
                }
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                }}
            >
                <Table
                    columns={colonnes}
                    dataSource={interventions}
                    rowKey="id"
                    pagination={false}
                    style={{ borderRadius: 8 }}
                    rowClassName={() => 'table-row'}
                />
            </Card>
        </div>
    );
};

export default Dashboard;
