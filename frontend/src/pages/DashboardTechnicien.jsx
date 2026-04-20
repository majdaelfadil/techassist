import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tag, Space, message, Badge, Spin, Progress, Divider, Button, Modal, Form, Input, Select, Tooltip, Alert, Popconfirm } from 'antd';
import {
    ToolOutlined, ClockCircleOutlined,
    CheckCircleOutlined, WarningOutlined,
    CalendarOutlined, AppstoreOutlined,
    FileTextOutlined, UserOutlined,
    RiseOutlined, ArrowRightOutlined,
    SwapOutlined, PlusOutlined, EditOutlined,
    EyeOutlined, StarOutlined, TrophyOutlined,
    PercentageOutlined, FieldTimeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import authService from '../services/authService';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

const { Option } = Select;
const { TextArea } = Input;

const DashboardTechnicien = () => {
    const [stats, setStats] = useState(null);
    const [mesInterventions, setMesInterventions] = useState([]);
    const [planning, setPlanning] = useState([]);
    const [piecesEnRupture, setPiecesEnRupture] = useState([]);
    const [piecesRecentes, setPiecesRecentes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalStatut, setModalStatut] = useState(false);
    const [modalNotes, setModalNotes] = useState(false);
    const [interventionSelectionnee, setInterventionSelectionnee] = useState(null);
    const [transitions, setTransitions] = useState([]);
    const [formStatut] = Form.useForm();
    const [formNotes] = Form.useForm();
    const navigate = useNavigate();
    const nomTech = authService.getNom();

    useEffect(() => {
        chargerDonnees();
    }, []);

    const chargerDonnees = async () => {
        setLoading(true);
        try {
            const [statsRes, interRes, planRes, piecesRes] = await Promise.all([
                api.get('/dashboard/stats/'),
                api.get('/interventions/'),
                api.get('/technicien/planning/'),
                api.get('/pieces/')
            ]);
            setStats(statsRes.data);
            setMesInterventions(interRes.data.slice(0, 8));
            setPlanning(planRes.data.interventions || []);
            const pieces = piecesRes.data || [];
            setPiecesEnRupture(pieces.filter(p => p.quantite_stock <= p.seuil_minimum));
            setPiecesRecentes(pieces.slice(0, 5));
        } catch (error) {
            console.error('Erreur chargement:', error);
            message.error('Erreur chargement du tableau de bord');
        } finally {
            setLoading(false);
        }
    };

    const chargerTransitions = async (id) => {
        try {
            const res = await api.get(`/interventions/${id}/transitions/`);
            setTransitions(res.data.transitions_possibles);
        } catch (error) {
            message.error('Erreur chargement transitions');
        }
    };

    const changerStatut = async (values) => {
        try {
            await api.post(`/interventions/${interventionSelectionnee.id}/changer-statut/`, {
                statut: values.statut
            });
            message.success('Statut mis à jour avec succès !');
            setModalStatut(false);
            formStatut.resetFields();
            chargerDonnees();
        } catch (error) {
            if (error.response?.data?.erreur) {
                message.error(error.response.data.erreur);
            } else {
                message.error('Erreur lors du changement de statut');
            }
        }
    };

    const ajouterNotes = async (values) => {
        try {
            await api.patch(`/interventions/${interventionSelectionnee.id}/`, {
                notes_technicien: values.notes_technicien
            });
            message.success('Notes ajoutées avec succès !');
            setModalNotes(false);
            formNotes.resetFields();
            chargerDonnees();
        } catch (error) {
            message.error('Erreur lors de l\'ajout des notes');
        }
    };

    const ouvrirModalStatut = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerTransitions(intervention.id);
        setModalStatut(true);
    };

    const ouvrirModalNotes = (intervention) => {
        setInterventionSelectionnee(intervention);
        formNotes.setFieldsValue({ notes_technicien: intervention.notes_technicien || '' });
        setModalNotes(true);
    };

    const couleurStatut = {
        'nouveau':        { color: '#1890ff', bg: '#e6f7ff', icon: '🆕' },
        'diagnostique':   { color: '#13c2c2', bg: '#e6fffb', icon: '🔍' },
        'assigne':        { color: '#722ed1', bg: '#f9f0ff', icon: '👤' },
        'en_cours':       { color: '#fa8c16', bg: '#fff7e6', icon: '⚡' },
        'attente_pieces': { color: '#faad14', bg: '#fffbe6', icon: '⏳' },
        'termine':        { color: '#52c41a', bg: '#f6ffed', icon: '✅' },
        'valide':         { color: '#a0d911', bg: '#fcffe6', icon: '✔️' },
        'facture':        { color: '#eb2f96', bg: '#fff0f6', icon: '💰' },
        'cloture':        { color: '#8c8c8c', bg: '#fafafa', icon: '🔒' },
    };

    const couleurUrgence = {
        'faible':   { color: '#52c41a', bg: '#f6ffed', label: 'Faible' },
        'normale':  { color: '#1890ff', bg: '#e6f7ff', label: 'Normale' },
        'haute':    { color: '#fa8c16', bg: '#fff7e6', label: 'Haute' },
        'critique': { color: '#f5222d', bg: '#fff1f0', label: 'Critique' },
    };

    const typesService = {
        'reparation':    { icon: '🔧', label: 'Réparation' },
        'installation':  { icon: '💿', label: 'Installation' },
        'configuration': { icon: '⚙️', label: 'Configuration' },
        'maintenance':   { icon: '🔩', label: 'Maintenance' },
        'depannage':     { icon: '🛠️', label: 'Dépannage' }
    };

    const aujourd_hui = dayjs().format('YYYY-MM-DD');
    const interventionsAujourdhui = (planning || []).filter(i =>
        i.date_planifiee &&
        dayjs(i.date_planifiee).format('YYYY-MM-DD') === aujourd_hui
    );

    // Calcul des stats personnalisées pour le technicien
    const mesStats = {
        total: mesInterventions.length,
        en_cours: mesInterventions.filter(i => i.statut === 'en_cours').length,
        termine: mesInterventions.filter(i => i.statut === 'termine').length,
        attente: mesInterventions.filter(i => i.statut === 'attente_pieces').length,
        taux_succes: mesInterventions.length > 0 
            ? Math.round((mesInterventions.filter(i => i.statut === 'termine').length / mesInterventions.length) * 100)
            : 0
    };

    if (loading) return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '80vh',
            flexDirection: 'column',
            gap: 16
        }}>
            <Spin size="large" />
            <span style={{ color: '#999', fontSize: 14 }}>
                Chargement du tableau de bord...
            </span>
        </div>
    );

    return (
        <div style={{
            padding: 28,
            background: '#f8f9fa',
            minHeight: '100vh'
        }}>

            {/* ─── HEADER BIENVENUE ─── */}
            <div style={{
                background: 'linear-gradient(135deg, #1A1A1A 0%, #2d2d2d 100%)',
                borderRadius: 20,
                padding: '28px 32px',
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    right: -40,
                    top: -40,
                    width: 200,
                    height: 200,
                    background: 'rgba(255,140,0,0.08)',
                    borderRadius: '50%'
                }} />
                <div style={{
                    position: 'absolute',
                    right: 60,
                    bottom: -60,
                    width: 150,
                    height: 150,
                    background: 'rgba(255,140,0,0.05)',
                    borderRadius: '50%'
                }} />

                <div style={{ position: 'relative' }}>
                    <div style={{
                        color: '#FF8C00',
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 6,
                        letterSpacing: 1
                    }}>
                        TECHNICIEN
                    </div>
                    <h1 style={{
                        color: '#fff',
                        fontSize: 26,
                        fontWeight: 700,
                        margin: 0,
                        marginBottom: 6
                    }}>
                        Bonjour, {nomTech || 'Technicien'} 👋
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: 0,
                        fontSize: 14
                    }}>
                        {dayjs().format('dddd DD MMMM YYYY')}
                        {interventionsAujourdhui.length > 0 && (
                            <span style={{
                                marginLeft: 12,
                                background: '#FF8C0033',
                                color: '#FF8C00',
                                padding: '2px 10px',
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 600
                            }}>
                                {interventionsAujourdhui.length} intervention(s) aujourd'hui
                            </span>
                        )}
                    </p>
                </div>

                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: '12px 20px',
                    position: 'relative'
                }}>
                    <div style={{
                        color: '#FF8C00',
                        fontSize: 11,
                        fontWeight: 600,
                        marginBottom: 6,
                        letterSpacing: 1
                    }}>
                        HORAIRES DE TRAVAIL
                    </div>
                    <div style={{
                        color: '#fff',
                        fontSize: 13,
                        marginBottom: 4
                    }}>
                        🌅 <strong>08h30</strong> — 13h00
                    </div>
                    <div style={{ color: '#fff', fontSize: 13 }}>
                        🌇 <strong>15h00</strong> — 19h00
                    </div>
                </div>
            </div>

            {/* ─── STATS PERSONNALISÉES ─── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 16,
                marginBottom: 24
            }}>
                {[
                    {
                        label: 'Total interventions',
                        value: mesStats.total,
                        icon: <ToolOutlined />,
                        color: '#FF8C00',
                        bg: '#FFF3E0',
                        suffix: '',
                        onClick: () => navigate('/interventions')
                    },
                    {
                        label: 'En cours',
                        value: mesStats.en_cours,
                        icon: <FieldTimeOutlined />,
                        color: '#fa8c16',
                        bg: '#fff7e6',
                        suffix: '',
                        onClick: () => navigate('/interventions?statut=en_cours')
                    },
                    {
                        label: 'En attente pièces',
                        value: mesStats.attente,
                        icon: <ClockCircleOutlined />,
                        color: '#faad14',
                        bg: '#fffbe6',
                        suffix: '',
                        onClick: () => navigate('/interventions?statut=attente_pieces')
                    },
                    {
                        label: 'Terminées',
                        value: mesStats.termine,
                        icon: <CheckCircleOutlined />,
                        color: '#52c41a',
                        bg: '#f6ffed',
                        suffix: '',
                        onClick: () => navigate('/interventions?statut=termine')
                    },
                    {
                        label: 'Taux succès',
                        value: mesStats.taux_succes,
                        icon: <PercentageOutlined />,
                        color: '#722ed1',
                        bg: '#f9f0ff',
                        suffix: '%',
                        onClick: () => navigate('/interventions')
                    }
                ].map((stat, i) => (
                    <div
                        key={i}
                        onClick={stat.onClick}
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            padding: '18px 20px',
                            cursor: 'pointer',
                            border: '1px solid #f0f0f0',
                            transition: 'all 0.2s',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            width: 40,
                            height: 40,
                            background: stat.bg,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            color: stat.color
                        }}>
                            {stat.icon}
                        </div>
                        <div style={{
                            fontSize: 32,
                            fontWeight: 800,
                            color: stat.color,
                            lineHeight: 1,
                            marginBottom: 6
                        }}>
                            {stat.value}{stat.suffix}
                        </div>
                        <div style={{
                            fontSize: 12,
                            color: '#666',
                            fontWeight: 500
                        }}>
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── ACCÈS RAPIDES ─── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginBottom: 24
            }}>
                {[
                    {
                        label: 'Mes Interventions',
                        icon: <ToolOutlined />,
                        color: '#FF8C00',
                        path: '/interventions',
                        desc: 'Voir et gérer mes interventions'
                    },
                    {
                        label: 'Mon Planning',
                        icon: <CalendarOutlined />,
                        color: '#1890ff',
                        path: '/planning',
                        desc: 'Consulter mon calendrier'
                    },
                    {
                        label: 'Stock Pièces',
                        icon: <AppstoreOutlined />,
                        color: '#52c41a',
                        path: '/pieces',
                        desc: 'Voir les pièces disponibles'
                    },
                    {
                        label: 'Mes Rapports',
                        icon: <FileTextOutlined />,
                        color: '#722ed1',
                        path: '/interventions',
                        desc: 'Rédiger et valider rapports'
                    }
                ].map((item, i) => (
                    <div
                        key={i}
                        onClick={() => navigate(item.path)}
                        style={{
                            background: '#fff',
                            borderRadius: 14,
                            padding: '16px 20px',
                            cursor: 'pointer',
                            border: `2px solid transparent`,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = item.color;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{
                            width: 44,
                            height: 44,
                            background: item.color + '15',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            color: item.color,
                            flexShrink: 0
                        }}>
                            {item.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: '#1A1A1A',
                                marginBottom: 2
                            }}>
                                {item.label}
                            </div>
                            <div style={{
                                fontSize: 11,
                                color: '#999',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {item.desc}
                            </div>
                        </div>
                        <ArrowRightOutlined style={{ color: '#ccc', fontSize: 12 }} />
                    </div>
                ))}
            </div>

            {/* ─── CONTENU PRINCIPAL ─── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 20
            }}>

                {/* ─── INTERVENTIONS DU JOUR ─── */}
                <div style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        <div>
                            <h3 style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 700,
                                color: '#1A1A1A'
                            }}>
                                📅 Planning du jour
                            </h3>
                            <p style={{
                                margin: '4px 0 0',
                                color: '#999',
                                fontSize: 12
                            }}>
                                {dayjs().format('dddd DD MMMM')}
                            </p>
                        </div>
                        <span
                            onClick={() => navigate('/planning')}
                            style={{
                                color: '#FF8C00',
                                fontSize: 12,
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Voir tout →
                        </span>
                    </div>

                    {interventionsAujourdhui.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '30px 0',
                            color: '#ccc'
                        }}>
                            <CalendarOutlined style={{
                                fontSize: 32,
                                marginBottom: 8,
                                display: 'block'
                            }} />
                            <div style={{ fontSize: 13 }}>
                                Aucune intervention planifiée aujourd'hui
                            </div>
                        </div>
                    ) : (
                        interventionsAujourdhui.map((i, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 14px',
                                background: '#f8f9fa',
                                borderRadius: 10,
                                marginBottom: 8,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderLeft: `4px solid ${couleurStatut[i.statut]?.color || '#666'}`
                            }}
                            onClick={() => navigate('/interventions')}
                            onMouseEnter={e =>
                                e.currentTarget.style.background = '#f0f0f0'}
                            onMouseLeave={e =>
                                e.currentTarget.style.background = '#f8f9fa'}
                            >
                                <div style={{
                                    background: '#FF8C0015',
                                    borderRadius: 8,
                                    padding: '6px 10px',
                                    textAlign: 'center',
                                    minWidth: 48
                                }}>
                                    <div style={{
                                        color: '#FF8C00',
                                        fontWeight: 800,
                                        fontSize: 14
                                    }}>
                                        {dayjs(i.date_planifiee).format('HH:mm')}
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 600,
                                        fontSize: 13,
                                        color: '#1A1A1A'
                                    }}>
                                        {i.client_nom}
                                    </div>
                                    <div style={{
                                        fontSize: 11,
                                        color: '#666',
                                        marginTop: 2
                                    }}>
                                        {typesService[i.type_service]?.icon} {typesService[i.type_service]?.label}
                                        {i.duree_estimee && ` • ${i.duree_estimee}h`}
                                    </div>
                                </div>
                                <span style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: couleurStatut[i.statut]?.color,
                                    background: couleurStatut[i.statut]?.bg
                                }}>
                                    {couleurStatut[i.statut]?.icon} {i.statut?.toUpperCase()}
                                </span>
                            </div>
                        ))
                    )}

                    {planning?.filter(i =>
                        i.date_planifiee &&
                        dayjs(i.date_planifiee).isAfter(dayjs()) &&
                        dayjs(i.date_planifiee).format('YYYY-MM-DD') !== aujourd_hui
                    ).length > 0 && (
                        <>
                            <Divider style={{ margin: '12px 0' }}>
                                <span style={{ fontSize: 11, color: '#999' }}>
                                    Prochaines interventions
                                </span>
                            </Divider>
                            {planning
                                .filter(i =>
                                    i.date_planifiee &&
                                    dayjs(i.date_planifiee).isAfter(dayjs()) &&
                                    dayjs(i.date_planifiee)
                                        .format('YYYY-MM-DD') !== aujourd_hui
                                )
                                .slice(0, 2)
                                .map((i, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        marginBottom: 6,
                                        cursor: 'pointer',
                                        border: '1px solid #f0f0f0'
                                    }}
                                    onClick={() => navigate('/planning')}
                                    >
                                        <ClockCircleOutlined style={{
                                            color: '#1890ff', fontSize: 16
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontWeight: 500,
                                                fontSize: 12,
                                                color: '#1A1A1A'
                                            }}>
                                                {i.client_nom}
                                            </div>
                                            <div style={{
                                                fontSize: 11,
                                                color: '#1890ff',
                                                marginTop: 1
                                            }}>
                                                {dayjs(i.date_planifiee)
                                                    .format('ddd DD/MM à HH:mm')}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            }
                        </>
                    )}
                </div>

                {/* ─── MES INTERVENTIONS AVEC ACTIONS ─── */}
                <div style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        <div>
                            <h3 style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 700,
                                color: '#1A1A1A'
                            }}>
                                🔧 Mes interventions
                            </h3>
                            <p style={{
                                margin: '4px 0 0',
                                color: '#999',
                                fontSize: 12
                            }}>
                                Dernières assignées
                            </p>
                        </div>
                        <span
                            onClick={() => navigate('/interventions')}
                            style={{
                                color: '#FF8C00',
                                fontSize: 12,
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Voir tout →
                        </span>
                    </div>

                    {mesInterventions.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '30px 0',
                            color: '#ccc'
                        }}>
                            <ToolOutlined style={{
                                fontSize: 32,
                                marginBottom: 8,
                                display: 'block'
                            }} />
                            <div style={{ fontSize: 13 }}>
                                Aucune intervention assignée
                            </div>
                        </div>
                    ) : (
                        mesInterventions.map((i, idx) => (
                            <div
                                key={idx}
                                style={{
                                    padding: '12px 0',
                                    borderBottom: idx < mesInterventions.length - 1 ?
                                        '1px solid #f5f5f5' : 'none'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 12
                                }}>
                                    <div style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: couleurUrgence[i.urgence]?.color || '#1890ff',
                                        marginTop: 6,
                                        flexShrink: 0
                                    }} />

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: 4
                                        }}>
                                            <span style={{
                                                color: '#FF8C00',
                                                fontWeight: 700,
                                                fontSize: 12
                                            }}>
                                                {i.numero}
                                            </span>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: couleurStatut[i.statut]?.color,
                                                background: couleurStatut[i.statut]?.bg
                                            }}>
                                                {couleurStatut[i.statut]?.icon} {i.statut?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 4
                                        }}>
                                            <UserOutlined style={{ fontSize: 11, color: '#999' }} />
                                            <span style={{
                                                fontSize: 12,
                                                color: '#333',
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {i.client_nom}
                                            </span>
                                            <Badge 
                                                color={couleurUrgence[i.urgence]?.color}
                                                text={couleurUrgence[i.urgence]?.label}
                                                style={{ fontSize: 10 }}
                                            />
                                        </div>
                                        <div style={{
                                            fontSize: 11,
                                            color: '#999',
                                            marginBottom: 8
                                        }}>
                                            {typesService[i.type_service]?.icon} {typesService[i.type_service]?.label}
                                            {i.appareil_info && ` • ${i.appareil_info}`}
                                        </div>
                                        
                                        {/* Boutons d'action */}
                                        <Space size={8}>
                                            <Tooltip title="Changer statut">
                                                <Button
                                                    size="small"
                                                    icon={<SwapOutlined />}
                                                    onClick={() => ouvrirModalStatut(i)}
                                                    style={{ fontSize: 11 }}
                                                >
                                                    Statut
                                                </Button>
                                            </Tooltip>
                                            <Tooltip title="Ajouter/Modifier notes">
                                                <Button
                                                    size="small"
                                                    icon={<EditOutlined />}
                                                    onClick={() => ouvrirModalNotes(i)}
                                                    style={{ fontSize: 11 }}
                                                >
                                                    Notes
                                                </Button>
                                            </Tooltip>
                                            <Tooltip title="Voir détails">
                                                <Button
                                                    size="small"
                                                    icon={<EyeOutlined />}
                                                    onClick={() => navigate(`/interventions/${i.id}`)}
                                                    style={{ fontSize: 11 }}
                                                />
                                            </Tooltip>
                                        </Space>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ─── AVANCEMENT STATUTS ─── */}
                <div style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #f0f0f0'
                }}>
                    <h3 style={{
                        margin: '0 0 20px',
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#1A1A1A'
                    }}>
                        📊 Répartition de mes interventions
                    </h3>

                    {mesInterventions.length > 0 ? (
                        <>
                            {Object.entries(
                                mesInterventions.reduce((acc, i) => {
                                    acc[i.statut] = (acc[i.statut] || 0) + 1;
                                    return acc;
                                }, {})
                            ).map(([statut, count], idx) => (
                                <div key={idx} style={{ marginBottom: 14 }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: 6
                                    }}>
                                        <span style={{
                                            fontSize: 12,
                                            color: '#333',
                                            fontWeight: 500
                                        }}>
                                            {couleurStatut[statut]?.icon} {statut?.toUpperCase()}
                                        </span>
                                        <span style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: couleurStatut[statut]?.color || '#666'
                                        }}>
                                            {count}
                                        </span>
                                    </div>
                                    <Progress
                                        percent={Math.round((count / mesInterventions.length) * 100)}
                                        showInfo={false}
                                        strokeColor={couleurStatut[statut]?.color || '#666'}
                                        trailColor='#f5f5f5'
                                        size="small"
                                    />
                                </div>
                            ))}
                            
                            <Divider />
                            
                            <div style={{
                                background: '#f6ffed',
                                borderRadius: 12,
                                padding: '16px',
                                marginTop: 8,
                                textAlign: 'center'
                            }}>
                                <TrophyOutlined style={{
                                    fontSize: 24,
                                    color: '#52c41a',
                                    marginBottom: 8,
                                    display: 'block'
                                }} />
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#52c41a'
                                }}>
                                    Taux de complétion
                                </div>
                                <div style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    color: '#52c41a'
                                }}>
                                    {mesStats.taux_succes}%
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: '#666',
                                    marginTop: 4
                                }}>
                                    {mesStats.termine} interventions terminées sur {mesStats.total}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 0',
                            color: '#ccc',
                            fontSize: 13
                        }}>
                            Aucune donnée disponible
                        </div>
                    )}
                </div>

                {/* ─── ALERTE PIÈCES EN RUPTURE ─── */}
                <div style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20
                    }}>
                        <div>
                            <h3 style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 700,
                                color: '#1A1A1A'
                            }}>
                                🔩 Stock pièces
                            </h3>
                            <p style={{
                                margin: '4px 0 0',
                                color: '#999',
                                fontSize: 12
                            }}>
                                Alertes de rupture
                            </p>
                        </div>
                        <span
                            onClick={() => navigate('/pieces')}
                            style={{
                                color: '#FF8C00',
                                fontSize: 12,
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Gérer le stock →
                        </span>
                    </div>

                    {piecesEnRupture.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '30px 0'
                        }}>
                            <div style={{
                                width: 48,
                                height: 48,
                                background: '#f6ffed',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 12px',
                                fontSize: 22
                            }}>
                                ✅
                            </div>
                            <div style={{
                                fontSize: 13,
                                color: '#52c41a',
                                fontWeight: 600
                            }}>
                                Tout le stock est disponible
                            </div>
                        </div>
                    ) : (
                        <>
                            <Alert
                                type="warning"
                                showIcon
                                message={`${piecesEnRupture.length} pièce(s) en rupture de stock`}
                                style={{ marginBottom: 16, borderRadius: 10 }}
                            />
                            {piecesEnRupture.slice(0, 4).map((p, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px',
                                    background: '#fafafa',
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    borderLeft: '3px solid #f5222d'
                                }}>
                                    <div>
                                        <div style={{
                                            fontWeight: 600,
                                            fontSize: 13,
                                            color: '#333'
                                        }}>
                                            {p.nom}
                                        </div>
                                        <div style={{
                                            fontSize: 11,
                                            color: '#999',
                                            fontFamily: 'monospace'
                                        }}>
                                            {p.reference}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            fontWeight: 700,
                                            fontSize: 16,
                                            color: '#f5222d'
                                        }}>
                                            {p.quantite_stock}
                                        </div>
                                        <div style={{
                                            fontSize: 10,
                                            color: '#999'
                                        }}>
                                            min: {p.seuil_minimum}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* ─── MODAL CHANGER STATUT ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        🔄 Changer le statut
                    </span>
                }
                open={modalStatut}
                onCancel={() => {
                    setModalStatut(false);
                    formStatut.resetFields();
                }}
                footer={null}
                width={400}
            >
                {interventionSelectionnee && (
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ color: '#666' }}>
                            Intervention : <strong style={{ color: '#FF8C00' }}>
                                {interventionSelectionnee.numero}
                            </strong>
                        </p>
                        <p style={{ color: '#666' }}>
                            Statut actuel :
                            <Tag color={couleurStatut[interventionSelectionnee.statut]?.color} style={{ marginLeft: 8 }}>
                                {couleurStatut[interventionSelectionnee.statut]?.icon} {interventionSelectionnee.statut?.toUpperCase()}
                            </Tag>
                        </p>
                    </div>
                )}

                <Form form={formStatut} layout="vertical" onFinish={changerStatut}>
                    <Form.Item
                        label="Nouveau statut"
                        name="statut"
                        rules={[{ required: true, message: 'Choisissez un statut' }]}
                    >
                        <Select placeholder="Choisir le nouveau statut">
                            {transitions.map(t => (
                                <Option key={t} value={t}>
                                    <Tag color={couleurStatut[t]?.color}>
                                        {couleurStatut[t]?.icon} {t.toUpperCase()}
                                    </Tag>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => { setModalStatut(false); formStatut.resetFields(); }}>
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            style={{
                                background: '#722ed1',
                                borderColor: '#722ed1',
                                borderRadius: 8
                            }}
                        >
                            Confirmer
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL NOTES TECHNICIEN ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        📝 Notes du technicien
                    </span>
                }
                open={modalNotes}
                onCancel={() => {
                    setModalNotes(false);
                    formNotes.resetFields();
                }}
                footer={null}
                width={500}
            >
                {interventionSelectionnee && (
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ color: '#666' }}>
                            Intervention : <strong style={{ color: '#FF8C00' }}>
                                {interventionSelectionnee.numero}
                            </strong>
                        </p>
                        <p style={{ color: '#666' }}>
                            Client : <strong>{interventionSelectionnee.client_nom}</strong>
                        </p>
                    </div>
                )}

                <Form form={formNotes} layout="vertical" onFinish={ajouterNotes}>
                    <Form.Item
                        label="Notes techniques"
                        name="notes_technicien"
                        rules={[{ required: true, message: 'Veuillez saisir vos notes' }]}
                    >
                        <TextArea
                            rows={6}
                            placeholder="Décrivez les actions réalisées, le diagnostic, les pièces changées..."
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => { setModalNotes(false); formNotes.resetFields(); }}>
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            style={{
                                background: '#FF8C00',
                                borderColor: '#FF8C00',
                                borderRadius: 8
                            }}
                        >
                            Enregistrer les notes
                        </Button>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default DashboardTechnicien;