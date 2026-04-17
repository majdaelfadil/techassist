import React, { useState, useEffect } from 'react';
import {
    Card, Table, Tag, Space, message,
    Button, Modal, Descriptions, Alert
} from 'antd';
import {
    CalendarOutlined, ReloadOutlined,
    ClockCircleOutlined, ToolOutlined,
    UserOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

const Planning = () => {
    const [planning, setPlanning] = useState([]);
    const [nomTech, setNomTech] = useState('');
    const [loading, setLoading] = useState(true);
    const [vue, setVue] = useState('liste');
    const [modalDetail, setModalDetail] = useState(false);
    const [interventionSelectionnee, setInterventionSelectionnee] = useState(null);

    useEffect(() => {
        chargerPlanning();
    }, []);

    const chargerPlanning = async () => {
        setLoading(true);
        try {
            const res = await api.get('/technicien/planning/');
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
        'nouveau':        '#1890ff',
        'diagnostique':   '#13c2c2',
    };

    const couleurUrgence = {
        'faible':   { color: '#52c41a', bg: '#f6ffed' },
        'normale':  { color: '#1890ff', bg: '#e6f7ff' },
        'haute':    { color: '#fa8c16', bg: '#fff7e6' },
        'critique': { color: '#f5222d', bg: '#fff1f0' },
    };

    const typesService = {
        'reparation':    '🔧 Réparation',
        'installation':  '💿 Installation',
        'configuration': '⚙️ Configuration',
        'maintenance':   '🔩 Maintenance',
        'depannage':     '🛠️ Dépannage'
    };

    const aujourd_hui = dayjs().format('YYYY-MM-DD');

    const interventionsAujourdhui = planning.filter(i =>
        i.date_planifiee &&
        dayjs(i.date_planifiee).format('YYYY-MM-DD') === aujourd_hui
    );

    // ─── RENDU CELLULE CALENDRIER ───
    const renduCellule = (value) => {
        const date = value.format('YYYY-MM-DD');
        const interventionsDuJour = planning.filter(i =>
            i.date_planifiee &&
            dayjs(i.date_planifiee).format('YYYY-MM-DD') === date
        );

        return (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {interventionsDuJour.map(i => (
                    <li
                        key={i.id}
                        onClick={(e) => {
                            e.stopPropagation();
                            setInterventionSelectionnee(i);
                            setModalDetail(true);
                        }}
                        style={{
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginBottom: 2,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: (couleurStatut[i.statut] || '#666') + '22',
                            color: couleurStatut[i.statut] || '#666',
                            borderLeft: `3px solid ${couleurStatut[i.statut] || '#666'}`,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%'
                        }}
                    >
                        {dayjs(i.date_planifiee).format('HH:mm')} {i.client_nom}
                    </li>
                ))}
            </ul>
        );
    };

    // ─── COLONNES ───
    const colonnes = [
        {
            title: 'Date et heure',
            dataIndex: 'date_planifiee',
            sorter: (a, b) =>
                new Date(a.date_planifiee) - new Date(b.date_planifiee),
            defaultSortOrder: 'ascend',
            render: (date) => {
                if (!date) return (
                    <span style={{ color: '#ccc' }}>Non planifiée</span>
                );
                const d = dayjs(date);
                const estAujourdhui = d.format('YYYY-MM-DD') === aujourd_hui;
                const estPasse = d.isBefore(dayjs()) && !estAujourdhui;
                return (
                    <div>
                        <div style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: estAujourdhui ? '#FF8C00' :
                                   estPasse ? '#f5222d' : '#1890ff'
                        }}>
                            {d.format('dddd DD/MM/YYYY')}
                        </div>
                        <div style={{
                            color: '#666',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2
                        }}>
                            <ClockCircleOutlined />
                            {d.format('HH:mm')}
                            {estAujourdhui && (
                                <span style={{
                                    background: '#FF8C0022',
                                    color: '#FF8C00',
                                    padding: '1px 6px',
                                    borderRadius: 10,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    marginLeft: 4
                                }}>
                                    AUJOURD'HUI
                                </span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Intervention',
            dataIndex: 'numero',
            render: (text, record) => (
                <div>
                    <div style={{
                        color: '#FF8C00',
                        fontWeight: 700,
                        fontSize: 13
                    }}>
                        {text}
                    </div>
                    <div style={{
                        color: '#666',
                        fontSize: 12,
                        marginTop: 2
                    }}>
                        {typesService[record.type_service]}
                    </div>
                </div>
            )
        },
        {
            title: 'Client',
            dataIndex: 'client_nom',
            render: (text) => (
                <Space>
                    <UserOutlined style={{ color: '#FF8C00' }} />
                    <span style={{ fontWeight: 500 }}>{text}</span>
                </Space>
            )
        },
        {
            title: 'Appareil',
            dataIndex: 'appareil_info',
            render: (text) => text || (
                <span style={{ color: '#ccc' }}>N/A</span>
            )
        },
        {
            title: 'Urgence',
            dataIndex: 'urgence',
            render: (urgence) => {
                const c = couleurUrgence[urgence] || couleurUrgence['normale'];
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
            title: 'Durée',
            dataIndex: 'duree_estimee',
            render: (d) => d ? (
                <Space>
                    <ClockCircleOutlined style={{ color: '#666' }} />
                    <span>{d}h</span>
                </Space>
            ) : 'N/A'
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => (
                <Tag
                    color={couleurStatut[statut] || '#666'}
                    style={{ borderRadius: 6 }}
                >
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: '',
            width: 50,
            render: (_, record) => (
                <Button
                    type="text"
                    size="small"
                    icon={<ToolOutlined />}
                    style={{ color: '#FF8C00' }}
                    onClick={() => {
                        setInterventionSelectionnee(record);
                        setModalDetail(true);
                    }}
                />
            )
        }
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
                        fontSize: 24, fontWeight: 700,
                        color: '#1A1A1A', margin: 0
                    }}>
                        Mon Planning
                    </h1>
                    <p style={{ color: '#999', margin: '4px 0 0', fontSize: 14 }}>
                        {nomTech && (
                            <span style={{ color: '#52c41a', fontWeight: 600 }}>
                                {nomTech}
                            </span>
                        )}
                        {' — '}
                        {planning.length} intervention(s) planifiée(s)
                    </p>
                </div>

                <Space>
                    <Button
                        type={vue === 'liste' ? 'primary' : 'default'}
                        onClick={() => setVue('liste')}
                        style={{
                            borderRadius: 8,
                            background: vue === 'liste' ? '#FF8C00' : '',
                            borderColor: vue === 'liste' ? '#FF8C00' : ''
                        }}
                    >
                        📋 Liste
                    </Button>
                    <Button
                        type={vue === 'calendrier' ? 'primary' : 'default'}
                        onClick={() => setVue('calendrier')}
                        style={{
                            borderRadius: 8,
                            background: vue === 'calendrier' ? '#FF8C00' : '',
                            borderColor: vue === 'calendrier' ? '#FF8C00' : ''
                        }}
                    >
                        📅 Calendrier
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={chargerPlanning}
                        style={{ borderRadius: 8 }}
                    >
                        Actualiser
                    </Button>
                </Space>
            </div>

            {/* ─── HORAIRES DE TRAVAIL ─── */}
            <Alert
                message="Horaires de travail"
                description={
                    <Space size={24}>
                        <span>
                            🌅 Matin :
                            <strong style={{ marginLeft: 6 }}>08h30 — 13h00</strong>
                        </span>
                        <span>
                            🌇 Après-midi :
                            <strong style={{ marginLeft: 6 }}>15h00 — 19h00</strong>
                        </span>
                    </Space>
                }
                type="info"
                showIcon
                icon={<ClockCircleOutlined />}
                style={{ borderRadius: 12, marginBottom: 16 }}
            />

            {/* ─── INTERVENTIONS DU JOUR ─── */}
            {interventionsAujourdhui.length > 0 && (
                <Alert
                    message={
                        <span style={{ fontWeight: 700 }}>
                            📅 Aujourd'hui — {interventionsAujourdhui.length} intervention(s)
                        </span>
                    }
                    description={
                        <Space wrap>
                            {interventionsAujourdhui.map(i => (
                                <Tag
                                    key={i.id}
                                    color={couleurStatut[i.statut]}
                                    style={{ borderRadius: 6, cursor: 'pointer' }}
                                    onClick={() => {
                                        setInterventionSelectionnee(i);
                                        setModalDetail(true);
                                    }}
                                >
                                    {dayjs(i.date_planifiee).format('HH:mm')}
                                    {' — '}{i.client_nom}
                                    {' ('}{i.numero}{')'}
                                </Tag>
                            ))}
                        </Space>
                    }
                    type="warning"
                    showIcon
                    style={{ borderRadius: 12, marginBottom: 16 }}
                />
            )}

            {/* ─── VUE LISTE ─── */}
            {vue === 'liste' && (
                <Card
                    title={
                        <Space>
                            <CalendarOutlined style={{ color: '#FF8C00' }} />
                            <span style={{ fontWeight: 700 }}>
                                Interventions planifiées
                            </span>
                        </Space>
                    }
                    bordered={false}
                    style={{
                        borderRadius: 16,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                    }}
                >
                    <Table
                        columns={colonnes}
                        dataSource={planning}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `${total} interventions`
                        }}
                    />
                </Card>
            )}

            {/* ─── VUE CALENDRIER ─── */}
            {vue === 'calendrier' && (
                <Card
                    bordered={false}
                    style={{
                        borderRadius: 16,
                        boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                    }}
                >
                    <div style={{ padding: 8 }}>
                        {/* Calendrier simplifié */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: 4,
                            marginBottom: 8
                        }}>
                            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
                                .map(j => (
                                <div key={j} style={{
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    color: '#666',
                                    fontSize: 12,
                                    padding: '8px 0'
                                }}>
                                    {j}
                                </div>
                            ))}
                        </div>

                        {/* Semaines du mois */}
                        {(() => {
                            const debut = dayjs().startOf('month').startOf('week');
                            const fin = dayjs().endOf('month').endOf('week');
                            const semaines = [];
                            let jour = debut;
                            while (jour.isBefore(fin)) {
                                const semaine = [];
                                for (let i = 0; i < 7; i++) {
                                    semaine.push(jour);
                                    jour = jour.add(1, 'day');
                                }
                                semaines.push(semaine);
                            }
                            return semaines.map((semaine, si) => (
                                <div key={si} style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(7, 1fr)',
                                    gap: 4,
                                    marginBottom: 4
                                }}>
                                    {semaine.map((j, ji) => {
                                        const dateStr = j.format('YYYY-MM-DD');
                                        const estCeMois = j.month() === dayjs().month();
                                        const estAujourdhui = dateStr === aujourd_hui;
                                        const intervsJour = planning.filter(i =>
                                            i.date_planifiee &&
                                            dayjs(i.date_planifiee)
                                                .format('YYYY-MM-DD') === dateStr
                                        );
                                        return (
                                            <div key={ji} style={{
                                                minHeight: 80,
                                                padding: '4px 6px',
                                                border: estAujourdhui ?
                                                    '2px solid #FF8C00' :
                                                    '1px solid #f0f0f0',
                                                borderRadius: 8,
                                                background: estAujourdhui ?
                                                    '#FFF3E0' :
                                                    estCeMois ? '#fff' : '#fafafa',
                                                opacity: estCeMois ? 1 : 0.5
                                            }}>
                                                <div style={{
                                                    fontWeight: estAujourdhui ?
                                                        700 : 500,
                                                    color: estAujourdhui ?
                                                        '#FF8C00' : '#333',
                                                    fontSize: 12,
                                                    marginBottom: 4
                                                }}>
                                                    {j.format('D')}
                                                </div>
                                                {intervsJour.map(i => (
                                                    <div
                                                        key={i.id}
                                                        onClick={() => {
                                                            setInterventionSelectionnee(i);
                                                            setModalDetail(true);
                                                        }}
                                                        style={{
                                                            padding: '2px 4px',
                                                            borderRadius: 4,
                                                            marginBottom: 2,
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            background: (couleurStatut[i.statut] || '#666') + '22',
                                                            color: couleurStatut[i.statut] || '#666',
                                                            borderLeft: `2px solid ${couleurStatut[i.statut] || '#666'}`,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {dayjs(i.date_planifiee).format('HH:mm')}
                                                        {' '}{i.client_nom}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            ));
                        })()}
                    </div>
                </Card>
            )}

            {/* ─── MODAL DÉTAIL ─── */}
            <Modal
                title={
                    <Space>
                        <ToolOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>Détail intervention</span>
                        {interventionSelectionnee && (
                            <Tag
                                color={couleurStatut[
                                    interventionSelectionnee.statut]}
                                style={{ borderRadius: 6 }}
                            >
                                {interventionSelectionnee.statut?.toUpperCase()}
                            </Tag>
                        )}
                    </Space>
                }
                open={modalDetail}
                onCancel={() => {
                    setModalDetail(false);
                    setInterventionSelectionnee(null);
                }}
                footer={[
                    <Button key="close" onClick={() => {
                        setModalDetail(false);
                        setInterventionSelectionnee(null);
                    }}>
                        Fermer
                    </Button>
                ]}
                width={500}
            >
                {interventionSelectionnee && (
                    <div>
                        {/* Heure planifiée */}
                        <div style={{
                            background: '#FF8C0011',
                            border: '1px solid #FF8C0033',
                            borderRadius: 12,
                            padding: '16px 20px',
                            marginBottom: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <ClockCircleOutlined style={{
                                fontSize: 24, color: '#FF8C00'
                            }} />
                            <div>
                                <div style={{
                                    fontWeight: 700,
                                    fontSize: 16,
                                    color: '#FF8C00'
                                }}>
                                    {dayjs(interventionSelectionnee.date_planifiee)
                                        .format('dddd DD MMMM YYYY')}
                                </div>
                                <div style={{ color: '#666', fontSize: 14 }}>
                                    {dayjs(interventionSelectionnee.date_planifiee)
                                        .format('HH:mm')}
                                    {interventionSelectionnee.duree_estimee &&
                                        ` — Durée estimée : ${interventionSelectionnee.duree_estimee}h`
                                    }
                                </div>
                            </div>
                        </div>

                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="N° Intervention">
                                <span style={{ color: '#FF8C00', fontWeight: 700 }}>
                                    {interventionSelectionnee.numero}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Client">
                                <Space>
                                    <UserOutlined />
                                    {interventionSelectionnee.client_nom}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Appareil">
                                {interventionSelectionnee.appareil_info || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Type">
                                {typesService[interventionSelectionnee.type_service]}
                            </Descriptions.Item>
                            <Descriptions.Item label="Urgence">
                                {(() => {
                                    const c = couleurUrgence[
                                        interventionSelectionnee.urgence
                                    ] || couleurUrgence['normale'];
                                    return (
                                        <span style={{
                                            padding: '3px 10px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: c.color,
                                            background: c.bg
                                        }}>
                                            {interventionSelectionnee.urgence?.toUpperCase()}
                                        </span>
                                    );
                                })()}
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Planning;