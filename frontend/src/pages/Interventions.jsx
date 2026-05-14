import React, { useState, useEffect, useCallback } from 'react';
import {
    Table, Card, Button, Tag, Input, Select,
    Space, Modal, Form, message, Tooltip,
    Popconfirm, DatePicker, Drawer, Descriptions,
    InputNumber, Divider, Alert, Result, Steps,
    Spin, Badge
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined,
    DeleteOutlined, FilterOutlined, SwapOutlined,
    UserAddOutlined, ReloadOutlined, CheckCircleOutlined,
    RobotOutlined, BulbOutlined, ToolOutlined,
    ThunderboltOutlined, UserOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

const Interventions = () => {
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');
    const [filtreUrgence, setFiltreUrgence] = useState('');
    const [filtreType, setFiltreType] = useState('');
    const [modalCreer, setModalCreer] = useState(false);
    const [modalStatut, setModalStatut] = useState(false);
    const [modalAssigner, setModalAssigner] = useState(false);
    const [modalValidation, setModalValidation] = useState(false);
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [interventionSelectionnee, setInterventionSelectionnee] = useState(null);
    const [clients, setClients] = useState([]);
    const [techniciens, setTechniciens] = useState([]);
    const [appareils, setAppareils] = useState([]);
    const [transitions, setTransitions] = useState([]);
    const [validationResult, setValidationResult] = useState(null);
    const [validating, setValidating] = useState(false);
    const [disponibilite, setDisponibilite] = useState(null);
    const [checkingDispo, setCheckingDispo] = useState(false);

    // ─── ÉTATS DIAGNOSTIC IA ───
    const [descriptionIA, setDescriptionIA] = useState('');
    const [loadingIA, setLoadingIA] = useState(false);
    const [diagnosticResult, setDiagnosticResult] = useState(null);
    const [etapeCreation, setEtapeCreation] = useState(0);
    // 0 = saisie description + IA
    // 1 = formulaire pré-rempli

    const [form] = Form.useForm();
    const [formStatut] = Form.useForm();
    const [formAssigner] = Form.useForm();

    // ════════════════════════════════
    // ─── CHARGEMENT DONNÉES ───
    // ════════════════════════════════

    const chargerInterventions = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/interventions/?';
            if (filtreStatut)  url += `statut=${filtreStatut}&`;
            if (filtreUrgence) url += `urgence=${filtreUrgence}&`;
            if (filtreType)    url += `type_service=${filtreType}&`;
            const res = await api.get(url);
            setInterventions(res.data);
        } catch {
            message.error('Erreur chargement interventions');
        } finally {
            setLoading(false);
        }
    }, [filtreStatut, filtreUrgence, filtreType]);

    const chargerClients = useCallback(async () => {
        try {
            const res = await api.get('/clients/');
            setClients(res.data);
        } catch {}
    }, []);

    const chargerTechniciens = useCallback(async () => {
        try {
            const res = await api.get('/techniciens/');
            setTechniciens(res.data);
        } catch {}
    }, []);

    useEffect(() => {
        chargerInterventions();
        chargerClients();
        chargerTechniciens();
    }, [chargerInterventions, chargerClients, chargerTechniciens]);

    const chargerAppareils = async (clientId) => {
        try {
            const res = await api.get(`/appareils/?client_id=${clientId}`);
            setAppareils(res.data);
        } catch {}
    };

    const chargerTransitions = async (id) => {
        try {
            const res = await api.get(`/interventions/${id}/transitions/`);
            setTransitions(res.data.transitions_possibles);
        } catch {}
    };

    // ════════════════════════════════
    // ─── DIAGNOSTIC IA ───
    // ════════════════════════════════

    const lancerDiagnostic = async () => {
        if (descriptionIA.trim().length < 10) {
            message.warning('Décrivez le problème en au moins 10 caractères');
            return;
        }
        setLoadingIA(true);
        setDiagnosticResult(null);
        try {
            const res = await api.post('/diagnostic/ia/', {
                description: descriptionIA
            });

            setDiagnosticResult(res.data);

            // ── Remplir automatiquement le formulaire ──
            form.setFieldsValue({
                description:  descriptionIA,
                type_service: res.data.type_service   || undefined,
                urgence:      res.data.urgence         || 'normale',
            });

            // Passer à l'étape 2 : formulaire
            setEtapeCreation(1);

            message.success('Diagnostic IA effectué ! Champs pré-remplis.');
        } catch (e) {
            message.error(
                e.response?.data?.erreur ||
                'Erreur lors du diagnostic IA'
            );
        } finally {
            setLoadingIA(false);
        }
    };

    const reinitialiserModal = () => {
        setModalCreer(false);
        setEtapeCreation(0);
        setDescriptionIA('');
        setDiagnosticResult(null);
        form.resetFields();
    };

    // ════════════════════════════════
    // ─── CRÉER INTERVENTION ───
    // ════════════════════════════════

    const creerIntervention = async (values) => {
        try {
            await api.post('/interventions/', values);
            message.success('Intervention créée !');
            reinitialiserModal();
            chargerInterventions();
        } catch {
            message.error('Erreur création');
        }
    };

    // ════════════════════════════════
    // ─── AUTRES ACTIONS ───
    // ════════════════════════════════

    const supprimerIntervention = async (id) => {
        try {
            await api.delete(`/interventions/${id}/`);
            message.success('Intervention supprimée !');
            chargerInterventions();
        } catch {
            message.error('Erreur suppression');
        }
    };

    const changerStatut = async (values) => {
        try {
            await api.post(
                `/interventions/${interventionSelectionnee.id}/changer-statut/`,
                { statut: values.statut }
            );
            message.success('Statut mis à jour !');
            setModalStatut(false);
            formStatut.resetFields();
            chargerInterventions();
        } catch {
            message.error('Transition non autorisée');
        }
    };

    const validerInterventionAvecFacture = async () => {
        setValidating(true);
        try {
            const res = await api.post(
                `/interventions/${interventionSelectionnee.id}/valider-generer-facture/`
            );
            setValidationResult(res.data);
            message.success('Intervention validée et facture générée !');
            chargerInterventions();
        } catch (e) {
            message.error(
                e.response?.data?.erreur || 'Erreur lors de la validation'
            );
        } finally {
            setValidating(false);
        }
    };

    const verifierDisponibilite = async (values) => {
        if (!values.technicien_id || !values.date_planifiee) return;
        setCheckingDispo(true);
        setDisponibilite(null);
        try {
            const res = await api.post('/techniciens/verifier-disponibilite/', {
                technicien_id: values.technicien_id,
                date_planifiee: values.date_planifiee.toISOString(),
                duree_estimee: values.duree_estimee || 1,
                intervention_id: interventionSelectionnee?.id
            });
            setDisponibilite(res.data);
        } catch {
            setDisponibilite(null);
        } finally {
            setCheckingDispo(false);
        }
    };

    const assignerTechnicien = async (values) => {
        if (!disponibilite?.disponible) {
            message.warning('Vérifiez d\'abord la disponibilité !');
            return;
        }
        try {
            await api.post(
                `/interventions/${interventionSelectionnee.id}/assigner-technicien/`,
                {
                    technicien_id: values.technicien_id,
                    date_planifiee: values.date_planifiee?.toISOString(),
                    duree_estimee: values.duree_estimee
                }
            );
            message.success('Technicien assigné !');
            setModalAssigner(false);
            setDisponibilite(null);
            formAssigner.resetFields();
            chargerInterventions();
        } catch (e) {
            message.error(
                e.response?.data?.message || 'Erreur assignation'
            );
        }
    };

    const ouvrirModalStatut = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerTransitions(intervention.id);
        setModalStatut(true);
    };

    const ouvrirDetail = async (intervention) => {
        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            setInterventionSelectionnee(res.data);
            setDrawerDetail(true);
        } catch {}
    };

    // ════════════════════════════════
    // ─── CONSTANTES UI ───
    // ════════════════════════════════

    const couleurUrgence = {
        'faible':   { color: '#52c41a', bg: '#f6ffed' },
        'normale':  { color: '#1890ff', bg: '#e6f7ff' },
        'haute':    { color: '#fa8c16', bg: '#fff7e6' },
        'critique': { color: '#f5222d', bg: '#fff1f0' },
    };

    const couleurStatut = {
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

    const couleurCategorie = {
        'hardware': '#722ed1',
        'software': '#1890ff',
        'reseau':   '#13c2c2',
    };

    const typesService = {
        'reparation':    'Réparation',
        'installation':  'Installation',
        'configuration': 'Configuration',
        'maintenance':   'Maintenance',
        'depannage':     'Dépannage'
    };

    const interventionsFiltrees = interventions.filter(i =>
        i.numero?.toLowerCase().includes(search.toLowerCase()) ||
        i.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
        i.technicien_nom?.toLowerCase().includes(search.toLowerCase())
    );

    // ════════════════════════════════
    // ─── COLONNES ───
    // ════════════════════════════════

    const colonnes = [
        {
            title: 'Numéro',
            dataIndex: 'numero',
            width: 140,
            render: (text) => (
                <span style={{
                    color: '#FF8C00', fontWeight: 700, fontSize: 13
                }}>
                    {text}
                </span>
            )
        },
        {
            title: 'Client',
            dataIndex: 'client_nom',
            render: (text) => (
                <span style={{ fontWeight: 500 }}>{text}</span>
            )
        },
        {
            title: 'Technicien',
            dataIndex: 'technicien_nom',
            render: (text) => text ? (
                <span style={{ fontWeight: 500 }}>{text}</span>
            ) : (
                <span style={{ color: '#ccc', fontSize: 12 }}>Non assigné</span>
            )
        },
        {
            title: 'Type',
            dataIndex: 'type_service',
            render: (text) => typesService[text] || text
        },
        {
            title: 'Urgence',
            dataIndex: 'urgence',
            render: (urgence) => {
                const c = couleurUrgence[urgence] || couleurUrgence['normale'];
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 20,
                        fontSize: 12, fontWeight: 600,
                        color: c.color, background: c.bg
                    }}>
                        {urgence?.toUpperCase()}
                    </span>
                );
            }
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => (
                <Tag color={couleurStatut[statut]}
                     style={{ borderRadius: 6, fontWeight: 500 }}>
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Canal',
            dataIndex: 'canal_entree',
            render: (canal) => ({
                'telephone': '📞 Téléphone',
                'boutique':  '🏪 Boutique',
                'email':     '✉️ Email'
            }[canal] || canal)
        },
        {
            title: 'Date',
            dataIndex: 'date_creation',
            render: (date) => new Date(date).toLocaleDateString('fr-FR')
        },
        {
            title: 'Actions',
            width: 240,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir détail">
                        <Button type="text" icon={<EyeOutlined />}
                            style={{ color: '#FF8C00' }}
                            onClick={() => ouvrirDetail(record)} />
                    </Tooltip>
                    <Tooltip title="Changer statut">
                        <Button type="text" icon={<SwapOutlined />}
                            style={{ color: '#722ed1' }}
                            onClick={() => ouvrirModalStatut(record)} />
                    </Tooltip>
                    <Tooltip title="Assigner technicien">
                        <Button type="text" icon={<UserAddOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => {
                                setInterventionSelectionnee(record);
                                setModalAssigner(true);
                            }} />
                    </Tooltip>
                    {record.statut === 'termine' && (
                        <Tooltip title="Valider et générer facture">
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                style={{
                                    background: '#52c41a',
                                    borderColor: '#52c41a',
                                    fontWeight: 500
                                }}
                                onClick={() => {
                                    setInterventionSelectionnee(record);
                                    setValidationResult(null);
                                    setModalValidation(true);
                                }}
                            >
                                Valider
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip title="Supprimer">
                        <Popconfirm
                            title="Supprimer cette intervention ?"
                            description="Cette action est irréversible."
                            onConfirm={() => supprimerIntervention(record.id)}
                            okText="Oui" cancelText="Non"
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="text" icon={<DeleteOutlined />}
                                style={{ color: '#f5222d' }} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            )
        },
    ];

    // ════════════════════════════════
    // ─── RENDER ───
    // ════════════════════════════════

    return (
        <div style={{ padding: 28 }}>

            {/* ─── TITRE ─── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 24
            }}>
                <div>
                    <h1 style={{
                        fontSize: 24, fontWeight: 700,
                        color: '#1A1A1A', margin: 0
                    }}>
                        Interventions
                    </h1>
                    <p style={{ color: '#999', margin: '4px 0 0', fontSize: 14 }}>
                        {interventionsFiltrees.length} résultat(s)
                    </p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />}
                        onClick={chargerInterventions}
                        style={{ borderRadius: 10 }}>
                        Actualiser
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="large"
                        onClick={() => setModalCreer(true)}
                        style={{
                            background: '#FF8C00',
                            borderColor: '#FF8C00',
                            borderRadius: 10,
                            fontWeight: 600, height: 44
                        }}
                    >
                        Nouvelle intervention
                    </Button>
                </Space>
            </div>

            {/* ─── FILTRES ─── */}
            <Card bordered={false} style={{
                borderRadius: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                marginBottom: 16
            }}>
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par numéro, client ou technicien..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 320, borderRadius: 8 }}
                    />
                    <Select placeholder="Statut" allowClear
                        style={{ width: 160 }} onChange={setFiltreStatut}
                        suffixIcon={<FilterOutlined />}>
                        {['nouveau','diagnostique','assigne','en_cours',
                          'attente_pieces','termine','valide','facture','cloture']
                            .map(s => (
                            <Option key={s} value={s}>
                                <Tag color={couleurStatut[s]} style={{ borderRadius: 4 }}>
                                    {s.toUpperCase()}
                                </Tag>
                            </Option>
                        ))}
                    </Select>
                    <Select placeholder="Urgence" allowClear
                        style={{ width: 140 }} onChange={setFiltreUrgence}>
                        {['faible','normale','haute','critique'].map(u => (
                            <Option key={u} value={u}>{u.toUpperCase()}</Option>
                        ))}
                    </Select>
                    <Select placeholder="Type de service" allowClear
                        style={{ width: 180 }} onChange={setFiltreType}>
                        {Object.entries(typesService).map(([k, v]) => (
                            <Option key={k} value={k}>{v}</Option>
                        ))}
                    </Select>
                </Space>
            </Card>

            {/* ─── TABLEAU ─── */}
            <Card bordered={false} style={{
                borderRadius: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
            }}>
                <Table
                    columns={colonnes}
                    dataSource={interventionsFiltrees}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1300 }}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) => `${total} interventions`,
                        showSizeChanger: true,
                    }}
                />
            </Card>

            {/* ════════════════════════════════════════
                ─── MODAL CRÉER AVEC DIAGNOSTIC IA ───
                ════════════════════════════════════════ */}
            <Modal
                title={
                    <Space>
                        <RobotOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>
                            Nouvelle intervention
                        </span>
                    </Space>
                }
                open={modalCreer}
                onCancel={reinitialiserModal}
                footer={null}
                width={700}
                destroyOnClose
            >
                {/* ─── STEPS ─── */}
                <Steps
                    current={etapeCreation}
                    size="small"
                    style={{ marginBottom: 24, marginTop: 8 }}
                    items={[
                        {
                            title: 'Diagnostic IA',
                            icon: <RobotOutlined />,
                            description: 'Analyse du problème'
                        },
                        {
                            title: 'Formulaire',
                            icon: <CheckCircleOutlined />,
                            description: 'Champs pré-remplis'
                        }
                    ]}
                />

                {/* ══════════════════════════
                    ÉTAPE 0 — DIAGNOSTIC IA
                    ══════════════════════════ */}
                {etapeCreation === 0 && (
                    <div>
                        {/* Zone de saisie description */}
                        <div style={{
                            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
                            borderRadius: 12,
                            padding: 20,
                            marginBottom: 16
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 12
                            }}>
                                <RobotOutlined style={{
                                    color: '#FF8C00', fontSize: 18
                                }} />
                                <span style={{
                                    color: '#fff', fontWeight: 600,
                                    fontSize: 14
                                }}>
                                    Décrivez le problème du client
                                </span>
                                <Tag color="#FF8C00" style={{
                                    marginLeft: 'auto', fontSize: 11
                                }}>
                                    Analyse IA
                                </Tag>
                            </div>
                            <TextArea
                                rows={5}
                                placeholder={
                                    "Exemple :\n" +
                                    "« L'ordinateur ne démarre plus, " +
                                    "l'écran reste noir après allumage. »\n" +
                                    "« Le WiFi est très lent et se déconnecte " +
                                    "toutes les 5 minutes. »"
                                }
                                value={descriptionIA}
                                onChange={(e) => setDescriptionIA(e.target.value)}
                                style={{
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.08)',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    fontSize: 14,
                                    resize: 'none'
                                }}
                            />
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: 12
                            }}>
                                <span style={{
                                    color: 'rgba(255,255,255,0.4)',
                                    fontSize: 12
                                }}>
                                    {descriptionIA.length} caractères
                                    {descriptionIA.length < 10 &&
                                     descriptionIA.length > 0 &&
                                        ' (minimum 10)'}
                                </span>
                                <Button
                                    type="primary"
                                    icon={loadingIA
                                        ? <Spin size="small" />
                                        : <RobotOutlined />}
                                    loading={loadingIA}
                                    disabled={descriptionIA.trim().length < 10}
                                    onClick={lancerDiagnostic}
                                    style={{
                                        background: '#FF8C00',
                                        borderColor: '#FF8C00',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        height: 40,
                                        paddingInline: 20
                                    }}
                                >
                                    {loadingIA
                                        ? 'Analyse en cours...'
                                        : 'Analyser avec l\'IA'}
                                </Button>
                            </div>
                        </div>

                        {/* Résultat diagnostic */}
                        {diagnosticResult && (
                            <div style={{ marginBottom: 16 }}>
                                <Divider style={{ margin: '16px 0 12px' }}>
                                    <Space>
                                        <BulbOutlined style={{ color: '#FF8C00' }} />
                                        <span style={{ fontSize: 13, color: '#666' }}>
                                            Résultats du diagnostic
                                        </span>
                                    </Space>
                                </Divider>

                                {/* Catégorie + Urgence */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr 1fr',
                                    gap: 10, marginBottom: 12
                                }}>
                                    {[
                                        {
                                            label: 'Catégorie',
                                            value: diagnosticResult.categorie?.toUpperCase(),
                                            color: couleurCategorie[diagnosticResult.categorie] || '#666',
                                            conf: diagnosticResult.confiance?.categorie,
                                            icon: <ToolOutlined />
                                        },
                                        {
                                            label: 'Urgence',
                                            value: diagnosticResult.urgence?.toUpperCase(),
                                            color: couleurUrgence[diagnosticResult.urgence]?.color || '#666',
                                            bg: couleurUrgence[diagnosticResult.urgence]?.bg,
                                            conf: diagnosticResult.confiance?.urgence,
                                            icon: <ThunderboltOutlined />
                                        },
                                        {
                                            label: 'Type de service',
                                            value: typesService[diagnosticResult.type_service] || diagnosticResult.type_service,
                                            color: '#FF8C00',
                                            conf: diagnosticResult.confiance?.type_service,
                                            icon: <ArrowRightOutlined />
                                        }
                                    ].map((item, i) => (
                                        <div key={i} style={{
                                            padding: '10px 14px',
                                            background: item.bg || '#f8f9fa',
                                            borderRadius: 10,
                                            borderLeft: `3px solid ${item.color}`
                                        }}>
                                            <div style={{
                                                fontSize: 10, color: '#999',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                marginBottom: 4,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4
                                            }}>
                                                {item.icon} {item.label}
                                            </div>
                                            <div style={{
                                                fontWeight: 700,
                                                color: item.color,
                                                fontSize: 13
                                            }}>
                                                {item.value}
                                            </div>
                                            {item.conf && (
                                                <div style={{
                                                    fontSize: 10,
                                                    color: '#999',
                                                    marginTop: 2
                                                }}>
                                                    Confiance : {item.conf}%
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Origine */}
                                <div style={{
                                    padding: '10px 14px',
                                    background: '#fffbe6',
                                    borderRadius: 10,
                                    border: '1px solid #ffe58f',
                                    marginBottom: 10
                                }}>
                                    <div style={{
                                        fontSize: 10, color: '#ad6800',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        marginBottom: 4
                                    }}>
                                        <BulbOutlined /> Origine identifiée
                                    </div>
                                    <div style={{
                                        fontWeight: 600, color: '#333', fontSize: 13
                                    }}>
                                        {diagnosticResult.origine_probleme}
                                    </div>
                                </div>

                                {/* Pièces + Technicien */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 10, marginBottom: 16
                                }}>
                                    {/* Pièces suggérées */}
                                    <div style={{
                                        padding: '10px 14px',
                                        background: '#f6ffed',
                                        borderRadius: 10,
                                        border: '1px solid #b7eb8f'
                                    }}>
                                        <div style={{
                                            fontSize: 10, color: '#389e0d',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            marginBottom: 6
                                        }}>
                                            <ToolOutlined /> Pièces suggérées
                                        </div>
                                        {diagnosticResult.pieces_suggerees?.length > 0 ? (
                                            <Space wrap size={4}>
                                                {diagnosticResult.pieces_suggerees.map(
                                                    (p, i) => (
                                                    <Tag key={i} color="green"
                                                         style={{ fontSize: 11 }}>
                                                        {p}
                                                    </Tag>
                                                ))}
                                            </Space>
                                        ) : (
                                            <span style={{
                                                color: '#999', fontSize: 12
                                            }}>
                                                Aucune pièce nécessaire
                                            </span>
                                        )}
                                    </div>

                                    {/* Technicien recommandé */}
                                    <div style={{
                                        padding: '10px 14px',
                                        background: '#e6f7ff',
                                        borderRadius: 10,
                                        border: '1px solid #91d5ff'
                                    }}>
                                        <div style={{
                                            fontSize: 10, color: '#0050b3',
                                            fontWeight: 600,
                                            textTransform: 'uppercase',
                                            marginBottom: 6
                                        }}>
                                            <UserOutlined /> Technicien recommandé
                                        </div>
                                        {diagnosticResult.technicien_recommande ? (
                                            <div>
                                                <div style={{
                                                    fontWeight: 700,
                                                    color: '#003a8c',
                                                    fontSize: 13
                                                }}>
                                                    {diagnosticResult.technicien_recommande.nom}
                                                </div>
                                                <div style={{
                                                    fontSize: 11, color: '#666'
                                                }}>
                                                    {diagnosticResult.technicien_recommande.specialite}
                                                </div>
                                            </div>
                                        ) : (
                                            <span style={{
                                                color: '#999', fontSize: 12
                                            }}>
                                                Aucun technicien disponible
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bouton continuer */}
                                <Button
                                    type="primary"
                                    block
                                    size="large"
                                    icon={<ArrowRightOutlined />}
                                    onClick={() => setEtapeCreation(1)}
                                    style={{
                                        background: '#1A1A1A',
                                        borderColor: '#1A1A1A',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        height: 44
                                    }}
                                >
                                    Continuer avec ce diagnostic
                                </Button>
                            </div>
                        )}

                        {/* Lien passer sans IA */}
                        {!diagnosticResult && (
                            <div style={{ textAlign: 'center', marginTop: 8 }}>
                                <Button
                                    type="link"
                                    style={{ color: '#999', fontSize: 12 }}
                                    onClick={() => setEtapeCreation(1)}
                                >
                                    Passer sans diagnostic IA →
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════
                    ÉTAPE 1 — FORMULAIRE
                    ══════════════════════════ */}
                {etapeCreation === 1 && (
                    <div>
                        {/* Résumé diagnostic si disponible */}
                        {diagnosticResult && (
                            <Alert
                                type="success"
                                showIcon
                                icon={<RobotOutlined />}
                                message="Formulaire pré-rempli par l'IA"
                                description={
                                    <span style={{ fontSize: 12 }}>
                                        Type : <strong>{typesService[diagnosticResult.type_service]}</strong>
                                        {' · '}
                                        Urgence : <strong>{diagnosticResult.urgence?.toUpperCase()}</strong>
                                        {' · '}
                                        Origine : <strong>{diagnosticResult.origine_probleme}</strong>
                                    </span>
                                }
                                style={{ borderRadius: 8, marginBottom: 16 }}
                                action={
                                    <Button
                                        size="small"
                                        onClick={() => setEtapeCreation(0)}
                                        style={{ fontSize: 11 }}
                                    >
                                        Modifier
                                    </Button>
                                }
                            />
                        )}

                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={creerIntervention}
                        >
                            <Form.Item
                                label="Client"
                                name="client_id"
                                rules={[{
                                    required: true,
                                    message: 'Sélectionnez un client'
                                }]}
                            >
                                <Select
                                    placeholder="Choisir un client"
                                    showSearch
                                    filterOption={(input, option) =>
                                        option.children.toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    onChange={chargerAppareils}
                                >
                                    {clients.map(c => (
                                        <Option key={c.id} value={c.id}>
                                            {c.nom} — {c.telephone}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item label="Appareil" name="appareil_id">
                                <Select
                                    placeholder="Choisir un appareil (optionnel)"
                                    allowClear
                                >
                                    {appareils.map(a => (
                                        <Option key={a.id} value={a.id}>
                                            {a.marque} {a.modele}
                                            {a.numero_serie && ` — ${a.numero_serie}`}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            {/* Description — pré-remplie par IA */}
                            <Form.Item
                                label={
                                    <Space>
                                        <span>Description du problème</span>
                                        {diagnosticResult && (
                                            <Badge
                                                count="IA"
                                                style={{
                                                    backgroundColor: '#FF8C00',
                                                    fontSize: 10
                                                }}
                                            />
                                        )}
                                    </Space>
                                }
                                name="description"
                                rules={[{
                                    required: true,
                                    message: 'Description obligatoire'
                                }]}
                            >
                                <TextArea
                                    rows={3}
                                    placeholder="Décrivez le problème..."
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            <Space style={{ width: '100%' }} size={12}>
                                {/* Type de service — pré-rempli par IA */}
                                <Form.Item
                                    label={
                                        <Space>
                                            <span>Type de service</span>
                                            {diagnosticResult && (
                                                <Badge count="IA" style={{
                                                    backgroundColor: '#FF8C00',
                                                    fontSize: 10
                                                }} />
                                            )}
                                        </Space>
                                    }
                                    name="type_service"
                                    rules={[{
                                        required: true,
                                        message: 'Obligatoire'
                                    }]}
                                    style={{ flex: 1 }}
                                >
                                    <Select placeholder="Type">
                                        {Object.entries(typesService).map(([k, v]) => (
                                            <Option key={k} value={k}>{v}</Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    label="Canal d'entrée"
                                    name="canal_entree"
                                    rules={[{
                                        required: true,
                                        message: 'Obligatoire'
                                    }]}
                                    style={{ flex: 1 }}
                                >
                                    <Select placeholder="Canal">
                                        <Option value="telephone">📞 Téléphone</Option>
                                        <Option value="boutique">🏪 Boutique</Option>
                                        <Option value="email">✉️ Email</Option>
                                    </Select>
                                </Form.Item>

                                {/* Urgence — pré-remplie par IA */}
                                <Form.Item
                                    label={
                                        <Space>
                                            <span>Urgence</span>
                                            {diagnosticResult && (
                                                <Badge count="IA" style={{
                                                    backgroundColor: '#FF8C00',
                                                    fontSize: 10
                                                }} />
                                            )}
                                        </Space>
                                    }
                                    name="urgence"
                                    initialValue="normale"
                                    style={{ flex: 1 }}
                                >
                                    <Select>
                                        <Option value="faible">🟢 Faible</Option>
                                        <Option value="normale">🔵 Normale</Option>
                                        <Option value="haute">🟠 Haute</Option>
                                        <Option value="critique">🔴 Critique</Option>
                                    </Select>
                                </Form.Item>
                            </Space>

                            {/* Suggestion technicien */}
                            {diagnosticResult?.technicien_recommande && (
                                <Alert
                                    type="info"
                                    showIcon
                                    icon={<UserOutlined />}
                                    message={
                                        <span style={{ fontSize: 13 }}>
                                            Technicien recommandé :{' '}
                                            <strong>
                                                {diagnosticResult.technicien_recommande.nom}
                                            </strong>
                                            {' '}
                                            <Tag color="blue" style={{ fontSize: 11 }}>
                                                {diagnosticResult.technicien_recommande.specialite}
                                            </Tag>
                                        </span>
                                    }
                                    style={{
                                        borderRadius: 8, marginBottom: 16
                                    }}
                                />
                            )}

                            {/* Suggestion pièces */}
                            {diagnosticResult?.pieces_suggerees?.length > 0 && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    icon={<ToolOutlined />}
                                    message={
                                        <span style={{ fontSize: 13 }}>
                                            Pièces probablement nécessaires :{' '}
                                            <Space wrap size={4} style={{ marginTop: 4 }}>
                                                {diagnosticResult.pieces_suggerees.map(
                                                    (p, i) => (
                                                    <Tag key={i} color="orange"
                                                         style={{ fontSize: 11 }}>
                                                        {p}
                                                    </Tag>
                                                ))}
                                            </Space>
                                        </span>
                                    }
                                    style={{
                                        borderRadius: 8, marginBottom: 16
                                    }}
                                />
                            )}

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12, marginTop: 8
                            }}>
                                <Button
                                    onClick={() => setEtapeCreation(0)}
                                    style={{ borderRadius: 8 }}
                                >
                                    ← Retour au diagnostic
                                </Button>
                                <Space>
                                    <Button
                                        onClick={reinitialiserModal}
                                        style={{ borderRadius: 8 }}
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        style={{
                                            background: '#FF8C00',
                                            borderColor: '#FF8C00',
                                            borderRadius: 8,
                                            fontWeight: 600
                                        }}
                                    >
                                        Créer l'intervention
                                    </Button>
                                </Space>
                            </div>
                        </Form>
                    </div>
                )}
            </Modal>

            {/* ─── MODAL CHANGER STATUT ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>🔄 Changer le statut</span>}
                open={modalStatut}
                onCancel={() => { setModalStatut(false); formStatut.resetFields(); }}
                footer={null} width={400}
            >
                {interventionSelectionnee && (
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ color: '#666' }}>
                            Intervention :
                            <strong style={{ color: '#FF8C00', marginLeft: 8 }}>
                                {interventionSelectionnee.numero}
                            </strong>
                        </p>
                        <p style={{ color: '#666' }}>
                            Statut actuel :
                            <Tag color={couleurStatut[interventionSelectionnee.statut]}
                                 style={{ marginLeft: 8 }}>
                                {interventionSelectionnee.statut?.toUpperCase()}
                            </Tag>
                        </p>
                    </div>
                )}
                <Form form={formStatut} layout="vertical" onFinish={changerStatut}>
                    <Form.Item label="Nouveau statut" name="statut"
                        rules={[{ required: true, message: 'Choisissez un statut' }]}>
                        <Select placeholder="Choisir le nouveau statut">
                            {transitions.map(t => (
                                <Option key={t} value={t}>
                                    <Tag color={couleurStatut[t]}>{t.toUpperCase()}</Tag>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => { setModalStatut(false); formStatut.resetFields(); }}>
                            Annuler
                        </Button>
                        <Button type="primary" htmlType="submit"
                            style={{ background: '#722ed1', borderColor: '#722ed1', borderRadius: 8 }}>
                            Confirmer
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL VALIDATION ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>✅ Validation de l'intervention</span>}
                open={modalValidation}
                onCancel={() => { setModalValidation(false); setValidationResult(null); }}
                footer={null} width={520}
            >
                {!validationResult ? (
                    <>
                        {interventionSelectionnee && (
                            <div style={{ marginBottom: 20 }}>
                                <Alert type="info" showIcon
                                    message="Confirmation de validation"
                                    description={
                                        <div style={{ marginTop: 8 }}>
                                            <p>Intervention : <strong>{interventionSelectionnee.numero}</strong></p>
                                            <p>Client : <strong>{interventionSelectionnee.client_nom}</strong></p>
                                            <p>Statut actuel : <Tag color="success">TERMINE</Tag></p>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <p style={{ marginBottom: 0 }}>
                                                L'intervention passera en statut <strong>VALIDÉ</strong> et une{' '}
                                                <strong>facture sera générée automatiquement</strong>.
                                            </p>
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }}
                                />
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button onClick={() => setModalValidation(false)}>Annuler</Button>
                            <Button type="primary" icon={<CheckCircleOutlined />}
                                onClick={validerInterventionAvecFacture}
                                loading={validating}
                                style={{
                                    background: '#52c41a',
                                    borderColor: '#52c41a',
                                    borderRadius: 8, fontWeight: 600
                                }}>
                                Valider et générer la facture
                            </Button>
                        </div>
                    </>
                ) : (
                    <Result
                        status="success"
                        title="Intervention validée avec succès !"
                        subTitle={
                            <div style={{ marginTop: 8 }}>
                                <p>La facture a été générée automatiquement.</p>
                                <div style={{
                                    background: '#f6ffed', padding: 12,
                                    borderRadius: 8, marginTop: 16, textAlign: 'left'
                                }}>
                                    <p><strong>📄 Facture :</strong> {validationResult.facture?.numero}</p>
                                    <p><strong>💰 Total TTC :</strong> {parseFloat(validationResult.facture?.total_ttc).toFixed(2)} MAD</p>
                                    <p><strong>📊 Statut :</strong> {validationResult.facture?.statut?.toUpperCase()}</p>
                                </div>
                            </div>
                        }
                        extra={[
                            <Button key="close" type="primary"
                                onClick={() => { setModalValidation(false); setValidationResult(null); }}
                                style={{ background: '#FF8C00', borderColor: '#FF8C00' }}>
                                Fermer
                            </Button>
                        ]}
                    />
                )}
            </Modal>

            {/* ─── MODAL ASSIGNER TECHNICIEN ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>👤 Assigner un technicien</span>}
                open={modalAssigner}
                onCancel={() => {
                    setModalAssigner(false);
                    setDisponibilite(null);
                    formAssigner.resetFields();
                }}
                footer={null} width={480}
            >
                <Form
                    form={formAssigner}
                    layout="vertical"
                    onFinish={assignerTechnicien}
                    style={{ marginTop: 16 }}
                    onValuesChange={() => setDisponibilite(null)}
                >
                    <Form.Item label="Technicien" name="technicien_id"
                        rules={[{ required: true, message: 'Choisissez un technicien' }]}>
                        <Select placeholder="Choisir un technicien" showSearch
                            filterOption={(input, option) =>
                                option.children.toLowerCase().includes(input.toLowerCase())
                            }>
                            {techniciens.map(t => (
                                <Option key={t.id} value={t.id}>
                                    {t.nom} — {t.specialite}{t.disponible ? ' ✅' : ' ❌'}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label="Date planifiée" name="date_planifiee"
                        rules={[{ required: true, message: 'Date obligatoire' }]}>
                        <DatePicker showTime style={{ width: '100%', borderRadius: 8 }}
                            placeholder="Choisir date et heure"
                            format="DD/MM/YYYY HH:mm"
                            disabledDate={(c) => c && c.day() === 0}
                            disabledTime={(date) => {
                                if (!date) return {};
                                const isSam = date.day() === 6;
                                return {
                                    disabledHours: () => {
                                        const h = [];
                                        for (let i = 0; i < 8; i++) h.push(i);
                                        if (!isSam) { h.push(13, 14); for (let i = 19; i < 24; i++) h.push(i); }
                                        else { for (let i = 13; i < 24; i++) h.push(i); }
                                        return h;
                                    }
                                };
                            }}
                        />
                    </Form.Item>

                    <Form.Item label="Durée estimée (heures)" name="duree_estimee"
                        initialValue={1}
                        rules={[{ required: true, message: 'Durée obligatoire' }]}>
                        <InputNumber min={0.5} max={8} step={0.5}
                            style={{ width: '100%', borderRadius: 8 }} addonAfter="h" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="default" icon={<CheckCircleOutlined />}
                            loading={checkingDispo}
                            onClick={() => verifierDisponibilite(formAssigner.getFieldsValue())}
                            style={{
                                width: '100%', borderRadius: 8,
                                borderColor: '#1890ff', color: '#1890ff', fontWeight: 600
                            }}>
                            Vérifier la disponibilité
                        </Button>
                    </Form.Item>

                    {disponibilite && (
                        <div style={{ marginBottom: 16 }}>
                            {disponibilite.disponible ? (
                                <Alert type="success" showIcon
                                    message="Technicien disponible ✅"
                                    description={
                                        <div>
                                            <div>{disponibilite.message}</div>
                                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                                Début : {disponibilite.date_debut} — Fin : {disponibilite.date_fin}
                                            </div>
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }} />
                            ) : (
                                <Alert type="error" showIcon
                                    message="Technicien non disponible ❌"
                                    description={
                                        <div>
                                            <div>{disponibilite.message}</div>
                                            {disponibilite.suggestion && (
                                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                                    💡 {disponibilite.suggestion}
                                                </div>
                                            )}
                                            {disponibilite.conflits?.map((c, i) => (
                                                <div key={i} style={{
                                                    background: '#fff2f0', padding: '4px 8px',
                                                    borderRadius: 4, marginTop: 4, fontSize: 12
                                                }}>
                                                    🔴 {c.numero} — {c.client} : {c.debut} → {c.fin}
                                                </div>
                                            ))}
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }} />
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => {
                            setModalAssigner(false);
                            setDisponibilite(null);
                            formAssigner.resetFields();
                        }}>Annuler</Button>
                        <Button type="primary" htmlType="submit"
                            disabled={!disponibilite?.disponible}
                            style={{
                                background: disponibilite?.disponible ? '#1890ff' : '#d9d9d9',
                                borderColor: disponibilite?.disponible ? '#1890ff' : '#d9d9d9',
                                borderRadius: 8, fontWeight: 600
                            }}>
                            Assigner
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <span style={{ fontWeight: 700 }}>
                        Détail intervention —
                        <span style={{ color: '#FF8C00', marginLeft: 8 }}>
                            {interventionSelectionnee?.numero}
                        </span>
                    </span>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={520}
            >
                {interventionSelectionnee && (
                    <div>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Statut">
                                <Tag color={couleurStatut[interventionSelectionnee.statut]}>
                                    {interventionSelectionnee.statut?.toUpperCase()}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Client">
                                {interventionSelectionnee.client?.nom}
                            </Descriptions.Item>
                            <Descriptions.Item label="Téléphone">
                                {interventionSelectionnee.client?.telephone}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">
                                {interventionSelectionnee.client?.email || 'Non renseigné'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Appareil">
                                {interventionSelectionnee.appareil
                                    ? `${interventionSelectionnee.appareil.marque} ${interventionSelectionnee.appareil.modele}`
                                    : 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Technicien">
                                {interventionSelectionnee.technicien?.nom || 'Non assigné'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Type">
                                {typesService[interventionSelectionnee.type_service]}
                            </Descriptions.Item>
                            <Descriptions.Item label="Urgence">
                                {interventionSelectionnee.urgence?.toUpperCase()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Canal">
                                {interventionSelectionnee.canal_entree}
                            </Descriptions.Item>
                            <Descriptions.Item label="Description">
                                {interventionSelectionnee.description}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date création">
                                {new Date(interventionSelectionnee.date_creation)
                                    .toLocaleDateString('fr-FR')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date planifiée">
                                {interventionSelectionnee.date_planifiee
                                    ? new Date(interventionSelectionnee.date_planifiee)
                                        .toLocaleDateString('fr-FR')
                                    : 'Non planifiée'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Durée estimée">
                                {interventionSelectionnee.duree_estimee
                                    ? `${interventionSelectionnee.duree_estimee}h`
                                    : 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Notes technicien">
                                {interventionSelectionnee.notes_technicien || 'Aucune note'}
                            </Descriptions.Item>
                        </Descriptions>

                        {interventionSelectionnee.pieces_utilisees?.length > 0 && (
                            <>
                                <Divider>Pièces utilisées</Divider>
                                {interventionSelectionnee.pieces_utilisees.map((p, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '8px 0',
                                        borderBottom: '1px solid #f0f0f0'
                                    }}>
                                        <span>{p.piece_nom}</span>
                                        <span style={{ color: '#FF8C00', fontWeight: 600 }}>
                                            x{p.quantite} — {p.sous_total} MAD
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Interventions;