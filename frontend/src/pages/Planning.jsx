import React, { useState, useEffect } from 'react';
import {
    Card, Table, Tag, Space, message,
    Badge, Button
} from 'antd';
import {
    CalendarOutlined, ReloadOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const Planning = () => {
    const [planning, setPlanning] = useState([]);
    const [nomTech, setNomTech] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        chargerPlanning();
    }, []);

    const chargerPlanning = async () => {
        setLoading(true);
        try {
            const res = await api.get(
                '/technicien/planning/');
            setPlanning(res.data.interventions);
            setNomTech(res.data.technicien);
        } catch (error) {
            message.error('Erreur chargement planning');
        } finally {
            setLoading(false);
        }
    };

    const couleurStatut = {
        'assigne':        '#722ed1',
        'en_cours':       '#fa8c16',
        'attente_pieces': '#faad14',
        'termine':        '#52c41a',
    };

    const typesService = {
        'reparation':    'Réparation',
        'installation':  'Installation',
        'configuration': 'Configuration',
        'maintenance':   'Maintenance',
        'depannage':     'Dépannage'
    };

    const colonnes = [
        {
            title: 'Numéro',
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
            title: 'Appareil',
            dataIndex: 'appareil_info',
            render: (text) => text || (
                <span style={{ color: '#ccc' }}>
                    N/A
                </span>
            )
        },
        {
            title: 'Type',
            dataIndex: 'type_service',
            render: (text) =>
                typesService[text] || text
        },
        {
            title: 'Urgence',
            dataIndex: 'urgence',
            render: (urgence) => {
                const config = {
                    'faible':   { color: '#52c41a',
                                  bg: '#f6ffed' },
                    'normale':  { color: '#1890ff',
                                  bg: '#e6f7ff' },
                    'haute':    { color: '#fa8c16',
                                  bg: '#fff7e6' },
                    'critique': { color: '#f5222d',
                                  bg: '#fff1f0' },
                };
                const c = config[urgence] ||
                          config['normale'];
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
            title: 'Date planifiée',
            dataIndex: 'date_planifiee',
            render: (date) => date ? (
                <Space>
                    <ClockCircleOutlined
                        style={{ color: '#1890ff' }} />
                    <span style={{
                        color: '#1890ff',
                        fontWeight: 600
                    }}>
                        {new Date(date)
                            .toLocaleDateString(
                                'fr-FR', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                }
                            )}
                    </span>
                </Space>
            ) : (
                <span style={{ color: '#ccc' }}>
                    Non planifiée
                </span>
            )
        },
        {
            title: 'Durée estimée',
            dataIndex: 'duree_estimee',
            render: (d) => d ? (
                <span style={{ color: '#666' }}>
                    {d}h
                </span>
            ) : 'N/A'
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => (
                <Tag
                    color={couleurStatut[statut]
                           || '#666'}
                    style={{ borderRadius: 6 }}
                >
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
    ];

    return (
        <div style={{ padding: 28 }}>

            {/* ─── TITRE ─── */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 24
            }}>
                <div>
                    <h1 style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: '#1A1A1A',
                        margin: 0
                    }}>
                        Mon Planning
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: '4px 0 0',
                        fontSize: 14
                    }}>
                        {nomTech && (
                            <span style={{
                                color: '#52c41a',
                                fontWeight: 600
                            }}>
                                {nomTech}
                            </span>
                        )} — {planning.length}
                        intervention(s) planifiée(s)
                    </p>
                </div>

                <Button
                    icon={<ReloadOutlined />}
                    onClick={chargerPlanning}
                    style={{ borderRadius: 10 }}
                >
                    Actualiser
                </Button>
            </div>

            {/* ─── TABLEAU ─── */}
            <Card
                title={
                    <Space>
                        <CalendarOutlined style={{
                            color: '#FF8C00'
                        }} />
                        <span style={{
                            fontWeight: 700
                        }}>
                            Interventions planifiées
                        </span>
                    </Space>
                }
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow:
                        '0 2px 12px rgba(0,0,0,0.06)'
                }}
            >
                <Table
                    columns={colonnes}
                    dataSource={planning}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) =>
                            `${total} interventions`
                    }}
                />
            </Card>
        </div>
    );
};

export default Planning;