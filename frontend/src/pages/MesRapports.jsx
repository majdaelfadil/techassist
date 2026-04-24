import React, { useState, useEffect } from 'react';
import {
    Card, Table, Tag, Button, Space, Drawer,
    message, Tooltip, Alert, Divider,
    Empty, Input, Select
} from 'antd';
import {
    FileTextOutlined, CheckCircleOutlined,
    ClockCircleOutlined, ReloadOutlined,
    EyeOutlined, SearchOutlined, FilterOutlined,
    RobotOutlined, EditOutlined
} from '@ant-design/icons';
import api from '../services/api';
import authService from '../services/authService';

const { Option } = Select;

const MesRapports = () => {
    const [rapports, setRapports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [rapportSelectionne, setRapportSelectionne] = useState(null);
    const nomTech = authService.getNom();

    useEffect(() => {
        chargerRapports();
    }, []);

    // ✅ CHARGER MES RAPPORTS - CORRIGÉ
// ─── CHARGER MES RAPPORTS ───
const chargerRapports = async () => {
    setLoading(true);
    try {
        const res = await api.get('/rapports/');
        const rapportsFormates = res.data.map(rapport => ({
            ...rapport,
            // ✅ date_generation existe déjà dans rapport,
            // pas besoin de le recalculer
            intervention_numero: rapport.intervention_numero
                || rapport.intervention,
            client_nom: rapport.intervention_client_nom
        }));
        setRapports(rapportsFormates);
    } catch (error) {
        message.error('Erreur chargement rapports');
    } finally {
        setLoading(false);
    }
};

    // ✅ OUVRIR DÉTAIL
    const ouvrirDetail = (rapport) => {
        setRapportSelectionne(rapport);
        setDrawerDetail(true);
    };

    // ✅ FILTRAGE LOCAL - CORRIGÉ
    const rapportsFiltres = rapports.filter(r => {
        // Recherche par numéro d'intervention ou client
        const matchSearch = 
            search === '' ||
            (r.intervention_numero && r.intervention_numero.toString().toLowerCase().includes(search.toLowerCase())) ||
            (r.client_nom && r.client_nom.toLowerCase().includes(search.toLowerCase())) ||
            (r.intervention && r.intervention.toString().toLowerCase().includes(search.toLowerCase()));
        
        // Filtre par statut
        const matchStatut =
            filtreStatut === '' ||
            (filtreStatut === 'valide' && r.valide === true) ||
            (filtreStatut === 'en_attente' && r.valide === false);
        
        return matchSearch && matchStatut;
    });

    // ✅ STATS
    const totalRapports = rapports.length;
    const rapportsValides = rapports.filter(r => r.valide === true).length;
    const rapportsEnAttente = rapports.filter(r => r.valide === false).length;
    const rapportsIA = rapports.filter(r => r.genere_par_ia === true).length;

    // ✅ COLONNES - CORRIGÉES
    const colonnes = [
        {
            title: 'N° Intervention',
            dataIndex: 'intervention_numero',
            key: 'intervention_numero',
            render: (text, record) => (
                <div>
                    <span style={{
                        color: '#FF8C00',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        fontSize: 13
                    }}>
                        #{text || record.intervention || 'N/A'}
                    </span>
                    {record.client_nom && (
                        <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                            {record.client_nom}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Date génération',
            dataIndex: 'date_generation',
            key: 'date_generation',
            sorter: (a, b) => {
                const dateA = a.date_generation ? new Date(a.date_generation) : new Date(0);
                const dateB = b.date_generation ? new Date(b.date_generation) : new Date(0);
                return dateA - dateB;
            },
            defaultSortOrder: 'descend',
            render: (date) => (
                <span style={{ color: '#666', fontSize: 13 }}>
                    {date ? new Date(date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }) : '—'}
                </span>
            )
        },
        {
            title: 'Généré par',
            dataIndex: 'genere_par_ia',
            key: 'genere_par_ia',
            render: (ia) => ia ? (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: '#fff7e6',
                    color: '#fa8c16',
                    fontSize: 12,
                    fontWeight: 600
                }}>
                    <RobotOutlined /> IA Groq
                </span>
            ) : (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: '#f0f0f0',
                    color: '#666',
                    fontSize: 12,
                    fontWeight: 600
                }}>
                    <EditOutlined /> Manuel
                </span>
            )
        },
        {
            title: 'Statut',
            dataIndex: 'valide',
            key: 'valide',
            render: (valide, record) => valide === true ? (
                <div>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 12px',
                        borderRadius: 20,
                        background: '#f6ffed',
                        color: '#52c41a',
                        fontSize: 12,
                        fontWeight: 700
                    }}>
                        <CheckCircleOutlined /> Validé
                    </span>
                    {record.date_validation && (
                        <div style={{
                            fontSize: 11,
                            color: '#999',
                            marginTop: 3
                        }}>
                            le {new Date(record.date_validation).toLocaleDateString('fr-FR')}
                        </div>
                    )}
                </div>
            ) : (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: '#fffbe6',
                    color: '#faad14',
                    fontSize: 12,
                    fontWeight: 700
                }}>
                    <ClockCircleOutlined /> En attente
                </span>
            )
        },
        {
            title: 'Aperçu',
            dataIndex: 'contenu',
            key: 'contenu',
            render: (contenu) => (
                <span style={{
                    color: '#666',
                    fontSize: 12,
                    fontStyle: 'italic'
                }}>
                    {contenu ? contenu.substring(0, 60) + '...' : '—'}
                </span>
            )
        },
        {
            title: 'Action',
            key: 'action',
            width: 80,
            render: (_, record) => (
                <Tooltip title="Voir le rapport">
                    <Button
                        type="text"
                        icon={<EyeOutlined />}
                        style={{ color: '#FF8C00' }}
                        onClick={() => ouvrirDetail(record)}
                    />
                </Tooltip>
            )
        }
    ];

    return (
        <div style={{ padding: 28, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>

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
                        Mes Rapports
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: '4px 0 0',
                        fontSize: 14
                    }}>
                        <span style={{
                            color: '#FF8C00',
                            fontWeight: 600
                        }}>
                            {nomTech || 'Technicien'}
                        </span>
                        {' — '}
                        {totalRapports} rapport(s)
                    </p>
                </div>

                <Button
                    icon={<ReloadOutlined />}
                    onClick={chargerRapports}
                    style={{ borderRadius: 10 }}
                >
                    Actualiser
                </Button>
            </div>

            {/* ─── CARTES STATS ─── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                marginBottom: 24
            }}>
                {[
                    {
                        label: 'Total rapports',
                        value: totalRapports,
                        color: '#FF8C00',
                        bg: '#FFF3E0',
                        icon: <FileTextOutlined />
                    },
                    {
                        label: 'Validés',
                        value: rapportsValides,
                        color: '#52c41a',
                        bg: '#f6ffed',
                        icon: <CheckCircleOutlined />
                    },
                    {
                        label: 'En attente',
                        value: rapportsEnAttente,
                        color: '#faad14',
                        bg: '#fffbe6',
                        icon: <ClockCircleOutlined />
                    },
                    {
                        label: 'Générés par IA',
                        value: rapportsIA,
                        color: '#722ed1',
                        bg: '#f9f0ff',
                        icon: <RobotOutlined />
                    }
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: '#fff',
                        borderRadius: 14,
                        padding: '18px 20px',
                        border: '1px solid #f0f0f0',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: 14,
                            right: 14,
                            width: 36,
                            height: 36,
                            background: stat.bg,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            color: stat.color
                        }}>
                            {stat.icon}
                        </div>
                        <div style={{
                            fontSize: 28,
                            fontWeight: 800,
                            color: stat.color,
                            lineHeight: 1,
                            marginBottom: 4
                        }}>
                            {stat.value}
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

            {/* ─── ALERTE si rapports en attente ─── */}
            {rapportsEnAttente > 0 && (
                <Alert
                    message={
                        <span style={{ fontWeight: 600 }}>
                            ⏳ {rapportsEnAttente} rapport(s) en attente de validation
                        </span>
                    }
                    description="Le responsable doit valider vos rapports avant la validation finale de l'intervention."
                    type="warning"
                    showIcon
                    icon={<ClockCircleOutlined />}
                    style={{ borderRadius: 12, marginBottom: 20 }}
                    closable
                />
            )}

            {/* ─── FILTRES ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 14,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: 16
                }}
            >
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par n° intervention ou client..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 320, borderRadius: 8 }}
                    />
                    <Select
                        placeholder="Tous les statuts"
                        allowClear
                        value={filtreStatut || undefined}
                        style={{ width: 160 }}
                        onChange={setFiltreStatut}
                        suffixIcon={<FilterOutlined />}
                    >
                        <Option value="valide">✅ Validés</Option>
                        <Option value="en_attente">⏳ En attente</Option>
                    </Select>
                    {(search || filtreStatut) && (
                        <Button 
                            onClick={() => {
                                setSearch('');
                                setFiltreStatut('');
                            }}
                        >
                            Réinitialiser
                        </Button>
                    )}
                </Space>
            </Card>

            {/* ─── TABLEAU ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 14,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                }}
            >
                {rapportsFiltres.length === 0 && !loading ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <div>
                                <p style={{
                                    color: '#666',
                                    fontWeight: 500,
                                    marginBottom: 4
                                }}>
                                    Aucun rapport trouvé
                                </p>
                                <p style={{
                                    color: '#999',
                                    fontSize: 12
                                }}>
                                    {search || filtreStatut 
                                        ? "Aucun rapport ne correspond à vos critères de recherche"
                                        : "Générez vos rapports depuis la page 'Mes Interventions'"}
                                </p>
                            </div>
                        }
                        style={{ padding: '40px 0' }}
                    />
                ) : (
                    <Table
                        columns={colonnes}
                        dataSource={rapportsFiltres}
                        rowKey="id"
                        loading={loading}
                        pagination={{
                            pageSize: 10,
                            showTotal: (total) => `${total} rapport(s)`,
                            showSizeChanger: true,
                            pageSizeOptions: ['5', '10', '20', '50']
                        }}
                        rowClassName={(record) => 
                            record.valide ? 'row-valide' : 'row-en-attente'
                        }
                    />
                )}
            </Card>

            {/* ─── DRAWER DÉTAIL RAPPORT ─── */}
            <Drawer
                title={
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap'
                    }}>
                        <FileTextOutlined style={{
                            color: '#FF8C00', fontSize: 18
                        }} />
                        <span style={{ fontWeight: 700 }}>
                            Rapport — Intervention #{rapportSelectionne?.intervention_numero || rapportSelectionne?.intervention}
                        </span>
                        {rapportSelectionne?.valide === true ? (
                            <Tag
                                color="success"
                                icon={<CheckCircleOutlined />}
                                style={{ marginLeft: 8 }}
                            >
                                Validé
                            </Tag>
                        ) : (
                            <Tag
                                color="warning"
                                icon={<ClockCircleOutlined />}
                                style={{ marginLeft: 8 }}
                            >
                                En attente
                            </Tag>
                        )}
                    </div>
                }
                open={drawerDetail}
                onClose={() => {
                    setDrawerDetail(false);
                    setRapportSelectionne(null);
                }}
                width={680}
            >
                {rapportSelectionne && (
                    <div>
                        {/* Infos du rapport */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                            marginBottom: 20
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                background: '#f8f9fa',
                                borderRadius: 10
                            }}>
                                <div style={{
                                    fontSize: 11,
                                    color: '#999',
                                    marginBottom: 4,
                                    fontWeight: 600,
                                    textTransform: 'uppercase'
                                }}>
                                    Date de génération
                                </div>
                                <div style={{
                                    fontWeight: 600,
                                    color: '#333'
                                }}>
                                    {rapportSelectionne.date_generation 
                                        ? new Date(rapportSelectionne.date_generation).toLocaleDateString('fr-FR', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric'
                                        })
                                        : '—'}
                                </div>
                            </div>

                            <div style={{
                                padding: '12px 16px',
                                background: '#f8f9fa',
                                borderRadius: 10
                            }}>
                                <div style={{
                                    fontSize: 11,
                                    color: '#999',
                                    marginBottom: 4,
                                    fontWeight: 600,
                                    textTransform: 'uppercase'
                                }}>
                                    Généré par
                                </div>
                                <div style={{
                                    fontWeight: 600,
                                    color: rapportSelectionne.genere_par_ia ?
                                        '#fa8c16' : '#666',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5
                                }}>
                                    {rapportSelectionne.genere_par_ia ? (
                                        <><RobotOutlined /> IA Groq</>
                                    ) : (
                                        <><EditOutlined /> Manuel</>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Client info */}
                        {rapportSelectionne.client_nom && (
                            <div style={{
                                padding: '12px 16px',
                                background: '#e6f7ff',
                                borderRadius: 10,
                                marginBottom: 16,
                                border: '1px solid #91d5ff'
                            }}>
                                <div style={{
                                    fontSize: 11,
                                    color: '#1890ff',
                                    marginBottom: 4,
                                    fontWeight: 600,
                                    textTransform: 'uppercase'
                                }}>
                                    Client
                                </div>
                                <div style={{ fontWeight: 500 }}>
                                    {rapportSelectionne.client_nom}
                                </div>
                            </div>
                        )}

                        {/* Statut validation */}
                        {rapportSelectionne.valide === true ? (
                            <Alert
                                message="✅ Rapport validé par le responsable"
                                description={
                                    rapportSelectionne.date_validation
                                        ? `Validé le ${new Date(rapportSelectionne.date_validation).toLocaleDateString('fr-FR', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}`
                                        : "Ce rapport a été examiné et approuvé."
                                }
                                type="success"
                                showIcon
                                icon={<CheckCircleOutlined />}
                                style={{ borderRadius: 10, marginBottom: 16 }}
                            />
                        ) : (
                            <Alert
                                message="⏳ En attente de validation"
                                description="Ce rapport est enregistré et soumis au responsable. Il sera validé prochainement."
                                type="warning"
                                showIcon
                                icon={<ClockCircleOutlined />}
                                style={{ borderRadius: 10, marginBottom: 16 }}
                            />
                        )}

                        <Divider style={{ margin: '16px 0' }}>
                            <span style={{ fontSize: 12, color: '#999' }}>
                                Contenu du rapport
                            </span>
                        </Divider>

                        {/* Contenu */}
                        <div style={{
                            padding: 20,
                            background: '#fafafa',
                            borderRadius: 10,
                            border: '1px solid #f0f0f0',
                            fontFamily: 'monospace',
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.8,
                            color: '#333',
                            maxHeight: '55vh',
                            overflowY: 'auto'
                        }}>
                            {rapportSelectionne.contenu || 'Aucun contenu disponible'}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Styles CSS personnalisés */}
            <style jsx="true">{`
                .row-en-attente {
                    background-color: #fffbe6;
                }
                .row-valide {
                    background-color: #f6ffed;
                }
            `}</style>
        </div>
    );
};

export default MesRapports;