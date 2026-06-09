// frontend/src/pages/Appareils.jsx
// Page complète de gestion des appareils pour l'agent d'accueil

import React, { useState, useEffect, useMemo } from 'react';
import {
    Table, Card, Button, Input, Space, Modal, Form, message,
    Tooltip, Popconfirm, Drawer, Tag, Badge, Empty, Spin,
    Descriptions, Avatar, Divider, Select, DatePicker, Switch
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
    ReloadOutlined, EyeOutlined, LaptopOutlined, PrinterOutlined,
    CloudServerOutlined, ApartmentOutlined, SafetyCertificateOutlined,
    NumberOutlined, UserOutlined, CalendarOutlined, ToolOutlined,
    HistoryOutlined, MobileOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

// ─── CONFIG ───
const TYPE_LABELS = {
    ordinateur: 'Ordinateur',
    imprimante: 'Imprimante',
    serveur:    'Serveur',
    reseau:     'Réseau',
    autre:      'Autre',
};

const TYPE_ICONS = {
    ordinateur: <LaptopOutlined />,
    imprimante:  <PrinterOutlined />,
    serveur:     <CloudServerOutlined />,
    reseau:      <ApartmentOutlined />,
    autre:       <MobileOutlined />,
};

const STATUT_COLORS = {
    nouveau:        { color: 'default',    label: 'Nouveau' },
    diagnostique:   { color: 'purple',     label: 'Diagnostiqué' },
    assigne:        { color: 'blue',       label: 'Assigné' },
    en_cours:       { color: 'processing', label: 'En cours' },
    attente_pieces: { color: 'warning',    label: 'Attente pièces' },
    termine:        { color: 'success',    label: 'Terminé' },
    valide:         { color: 'cyan',       label: 'Validé' },
    facture:        { color: 'geekblue',   label: 'Facturé' },
    cloture:        { color: 'default',    label: 'Clôturé' },
};

const BORDER_COLORS = {
    default:    '#d9d9d9',
    purple:     '#722ed1',
    blue:       '#1890ff',
    processing: '#1890ff',
    warning:    '#faad14',
    success:    '#52c41a',
    cyan:       '#13c2c2',
    geekblue:   '#2f54eb',
};

const fmt   = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtDT = (d) => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const Appareils = () => {
    const [appareils, setAppareils]     = useState([]);
    const [clients, setClients]         = useState([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [modalOpen, setModalOpen]     = useState(false);
    const [appareilSel, setAppareilSel] = useState(null);
    const [form]                        = Form.useForm();

    // ─── DRAWER ───
    const [drawerOpen, setDrawerOpen]       = useState(false);
    const [appareilDrawer, setAppareilDrawer] = useState(null);
    const [interventions, setInterventions] = useState([]);
    const [loadingDrawer, setLoadingDrawer] = useState(false);
    const [technicienActif, setTechnicienActif] = useState(null);

    // ─── RECHERCHE DANS LE DRAWER ───
    const [searchInterv, setSearchInterv]   = useState('');
    const [filtreStatut, setFiltreStatut]   = useState(null);

    useEffect(() => { 
        chargerAppareils(); 
        chargerClients();
    }, []);

    const chargerAppareils = async () => {
        setLoading(true);
        try {
            const res = await api.get('/appareils/');
            setAppareils(res.data);
        } catch { message.error('Erreur chargement appareils'); }
        finally   { setLoading(false); }
    };

    const chargerClients = async () => {
        try {
            const res = await api.get('/clients/');
            setClients(res.data);
        } catch { message.error('Erreur chargement clients'); }
    };

    const ouvrirDrawer = async (appareil) => {
        setAppareilDrawer(appareil);
        setDrawerOpen(true);
        setLoadingDrawer(true);
        setSearchInterv('');
        setFiltreStatut(null);
        setTechnicienActif(null);
        
        try {
            const { data } = await api.get(`/interventions/?appareil=${appareil.id}`);
            setInterventions(data);
            
            // Chercher si une intervention est en cours avec un technicien assigné
            const enCours = data.find((inv) =>
                ["en_cours", "assigne", "attente_pieces"].includes(inv.statut) &&
                inv.technicien
            );
            if (enCours) {
                setTechnicienActif({
                    nom:    enCours.technicien_nom,
                    statut: enCours.statut,
                    numero: enCours.numero,
                });
            }
        } catch { message.error('Erreur chargement historique'); }
        finally   { setLoadingDrawer(false); }
    };

    const fermerDrawer = () => {
        setDrawerOpen(false);
        setAppareilDrawer(null);
        setInterventions([]);
        setTechnicienActif(null);
        setSearchInterv('');
        setFiltreStatut(null);
    };

    // ─── FILTRES INTERVENTIONS ───
    const interventionsFiltrees = useMemo(() => {
        return interventions.filter((i) => {
            const q = searchInterv.toLowerCase();
            const matchTexte = !q || (
                i.numero?.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q) ||
                i.technicien_nom?.toLowerCase().includes(q)
            );
            const matchStatut = !filtreStatut || i.statut === filtreStatut;
            return matchTexte && matchStatut;
        });
    }, [interventions, searchInterv, filtreStatut]);

    // ─── CRUD ───
    const handleSubmit = async (values) => {
        try {
            const payload = {
                ...values,
                date_fin_garantie: values.date_fin_garantie
                    ? values.date_fin_garantie.format('YYYY-MM-DD')
                    : null,
            };
            
            if (appareilSel) {
                await api.put(`/appareils/${appareilSel.id}/`, payload);
                message.success('Appareil modifié !');
            } else {
                await api.post('/appareils/', payload);
                message.success('Appareil créé !');
            }
            setModalOpen(false); 
            form.resetFields(); 
            setAppareilSel(null);
            chargerAppareils();
        } catch { message.error('Erreur'); }
    };

    const supprimerAppareil = async (id) => {
        try {
            await api.delete(`/appareils/${id}/`);
            message.success('Appareil supprimé');
            fermerDrawer();
            chargerAppareils();
        } catch { message.error('Erreur suppression'); }
    };

    const ouvrirEdit = (appareil) => {
        setAppareilSel(appareil);
        form.setFieldsValue({
            ...appareil,
            date_fin_garantie: appareil.date_fin_garantie ? dayjs(appareil.date_fin_garantie) : null,
        });
        setModalOpen(true);
    };

    const appareilsFiltres = appareils.filter(a =>
        a.marque?.toLowerCase().includes(search.toLowerCase()) ||
        a.modele?.toLowerCase().includes(search.toLowerCase()) ||
        a.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
        a.numero_serie?.toLowerCase().includes(search.toLowerCase()) ||
        a.type_appareil?.toLowerCase().includes(search.toLowerCase())
    );

    const colonnes = [
        {
            title: 'Appareil', 
            dataIndex: 'marque',
            render: (text, record) => (
                <Space>
                    <Avatar 
                        size="small" 
                        icon={TYPE_ICONS[record.type_appareil] || <LaptopOutlined />} 
                        style={{ background: '#FF8C00' }} 
                    />
                    <span style={{ fontWeight: 600 }}>{record.marque} {record.modele}</span>
                </Space>
            )
        },
        { 
            title: 'Type', 
            dataIndex: 'type_appareil',
            render: (t) => <Tag>{TYPE_LABELS[t] || t}</Tag>
        },
        { 
            title: 'Client', 
            dataIndex: 'client_nom',
            render: (t) => <span><UserOutlined style={{ marginRight: 6, color: '#FF8C00' }} />{t}</span>
        },
        { 
            title: 'N° série', 
            dataIndex: 'numero_serie',
            render: (t) => t || '—'
        },
        {
            title: 'Garantie',
            dataIndex: 'sous_garantie',
            render: (g, record) => (
                <Tag icon={<SafetyCertificateOutlined />} color={g ? 'success' : 'default'}>
                    {g ? `Sous garantie${record.date_fin_garantie ? ` · jusqu'au ${fmt(record.date_fin_garantie)}` : ''}` : 'Hors garantie'}
                </Tag>
            )
        },
        { 
            title: 'Date création', 
            dataIndex: 'date_creation', 
            render: fmt 
        },
        {
            title: 'Actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir détails">
                        <Button type="text" icon={<EyeOutlined />}
                            style={{ color: '#722ed1' }}
                            onClick={() => ouvrirDrawer(record)} />
                    </Tooltip>
                    <Tooltip title="Modifier">
                        <Button type="text" icon={<EditOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => ouvrirEdit(record)} />
                    </Tooltip>
                    <Popconfirm title="Supprimer cet appareil ?" onConfirm={() => supprimerAppareil(record.id)}>
                        <Button type="text" icon={<DeleteOutlined />} style={{ color: '#f5222d' }} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 28 }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0 }}>Appareils</h1>
                    <p style={{ color: '#999' }}>{appareilsFiltres.length} appareil(s)</p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={chargerAppareils}>Actualiser</Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />}
                        onClick={() => { setModalOpen(true); setAppareilSel(null); form.resetFields(); }}
                        style={{ background: '#FF8C00', borderColor: '#FF8C00' }}
                    >
                        Nouvel appareil
                    </Button>
                </Space>
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Input 
                    prefix={<SearchOutlined />} 
                    placeholder="Rechercher par marque, modèle, client, type ou numéro de série..."
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    allowClear 
                />
            </Card>

            <Card>
                <Table 
                    columns={colonnes} 
                    dataSource={appareilsFiltres} 
                    rowKey="id"
                    loading={loading} 
                    pagination={{ pageSize: 10 }} 
                />
            </Card>

            {/* ══════════════════════════════
                DRAWER DÉTAIL APPAREIL
            ══════════════════════════════ */}
            <Drawer
                title={
                    <Space>
                        <Avatar 
                            size={42} 
                            icon={TYPE_ICONS[appareilDrawer?.type_appareil] || <LaptopOutlined />} 
                            style={{ background: '#FF8C00' }} 
                        />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>
                                {appareilDrawer?.marque} {appareilDrawer?.modele}
                            </div>
                            <div style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>
                                {TYPE_LABELS[appareilDrawer?.type_appareil] || appareilDrawer?.type_appareil}
                            </div>
                        </div>
                    </Space>
                }
                width={720}
                open={drawerOpen}
                onClose={fermerDrawer}
                bodyStyle={{ padding: 0, overflowY: 'auto' }}
                extra={
                    <Space>
                        <Button 
                            icon={<EditOutlined />} 
                            onClick={() => {
                                fermerDrawer();
                                ouvrirEdit(appareilDrawer);
                            }}
                        >
                            Modifier
                        </Button>
                        <Popconfirm 
                            title="Supprimer cet appareil ?" 
                            onConfirm={() => supprimerAppareil(appareilDrawer?.id)}
                        >
                            <Button danger>Supprimer</Button>
                        </Popconfirm>
                    </Space>
                }
            >
                {loadingDrawer ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                        <Spin size="large" />
                    </div>
                ) : (<>

                    {/* ── INFOS APPAREIL ── */}
                    <div style={{ padding: '18px 24px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: '#FF8C00', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Informations appareil
                        </div>
                        <Descriptions column={2} size="small">
                            <Descriptions.Item label={<Space size={4}><LaptopOutlined />Marque</Space>}>
                                <strong>{appareilDrawer?.marque || '—'}</strong>
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space size={4}><LaptopOutlined />Modèle</Space>}>
                                {appareilDrawer?.modele || '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space size={4}><NumberOutlined />N° série</Space>}>
                                {appareilDrawer?.numero_serie || '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space size={4}><UserOutlined />Client</Space>}>
                                {appareilDrawer?.client_nom || '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space size={4}><SafetyCertificateOutlined />Garantie</Space>}>
                                <Tag color={appareilDrawer?.sous_garantie ? 'success' : 'default'}>
                                    {appareilDrawer?.sous_garantie ? 'Sous garantie' : 'Hors garantie'}
                                </Tag>
                            </Descriptions.Item>
                            {appareilDrawer?.date_fin_garantie && (
                                <Descriptions.Item label={<Space size={4}><CalendarOutlined />Fin garantie</Space>}>
                                    {fmt(appareilDrawer?.date_fin_garantie)}
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label={<Space size={4}><CalendarOutlined />Date création</Space>}>
                                {fmt(appareilDrawer?.date_creation)}
                            </Descriptions.Item>
                        </Descriptions>
                    </div>

                    {/* ── STATS ── */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
                        {[
                            { label: 'Interventions', value: interventions.length, color: '#1890ff' },
                            { label: 'En cours',      value: interventions.filter(i => i.statut === 'en_cours').length, color: '#faad14' },
                            { label: 'Terminées',     value: interventions.filter(i => i.statut === 'termine').length, color: '#52c41a' },
                            { label: 'Clôturées',     value: interventions.filter(i => i.statut === 'cloture').length, color: '#888' },
                        ].map((s, i) => (
                            <div key={i} style={{
                                flex: 1, padding: '14px 0', textAlign: 'center',
                                borderRight: i < 3 ? '1px solid #f0f0f0' : 'none'
                            }}>
                                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '0 24px 40px' }}>

                        {/* ══════════════════
                            TECHNICIEN ACTIF
                        ══════════════════ */}
                        <Divider orientation="left" style={{ marginTop: 28 }}>
                            <Space>
                                <ToolOutlined style={{ color: '#1890ff' }} />
                                <span style={{ fontWeight: 700 }}>Technicien assigné</span>
                            </Space>
                        </Divider>

                        {technicienActif ? (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 16px', background: '#f0f5ff',
                                borderRadius: 8, border: '1px solid #adc6ff', marginBottom: 16
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: '#1890ff', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 600, fontSize: 16
                                }}>
                                    {technicienActif.nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{technicienActif.nom}</div>
                                    <div style={{ fontSize: 12, color: '#888' }}>
                                        Intervention <strong>{technicienActif.numero}</strong>
                                    </div>
                                </div>
                                <Tag color={STATUT_COLORS[technicienActif.statut]?.color || 'default'}>
                                    {STATUT_COLORS[technicienActif.statut]?.label || technicienActif.statut}
                                </Tag>
                            </div>
                        ) : (
                            <div style={{
                                textAlign: 'center', padding: '20px',
                                background: '#fafafa', borderRadius: 8,
                                border: '1px dashed #d9d9d9', marginBottom: 16
                            }}>
                                <ToolOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block', color: '#aaa' }} />
                                <span style={{ color: '#aaa' }}>Aucun technicien actuellement assigné</span>
                            </div>
                        )}

                        {/* ══════════════════
                            HISTORIQUE INTERVENTIONS
                        ══════════════════ */}
                        <Divider orientation="left" style={{ marginTop: 16 }}>
                            <Space>
                                <HistoryOutlined style={{ color: '#1890ff' }} />
                                <span style={{ fontWeight: 700 }}>Historique des interventions</span>
                                <Badge count={interventions.length} style={{ background: '#1890ff' }} />
                            </Space>
                        </Divider>

                        {/* Barre de recherche + filtre statut interventions */}
                        {interventions.length > 0 && (
                            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                                <Input
                                    prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                                    placeholder="Rechercher par N°, description, technicien..."
                                    value={searchInterv}
                                    onChange={(e) => setSearchInterv(e.target.value)}
                                    allowClear
                                    style={{ flex: 1 }}
                                />
                                <Select
                                    placeholder="Statut"
                                    value={filtreStatut}
                                    onChange={setFiltreStatut}
                                    allowClear
                                    style={{ width: 160 }}
                                    options={Object.entries(STATUT_COLORS).map(([key, val]) => ({
                                        value: key,
                                        label: <Tag color={val.color} style={{ margin: 0 }}>{val.label}</Tag>
                                    }))}
                                />
                            </Space.Compact>
                        )}

                        {interventions.length > 0 && (searchInterv || filtreStatut) && (
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
                                {interventionsFiltrees.length} résultat(s) sur {interventions.length}
                            </div>
                        )}

                        {interventionsFiltrees.length === 0 ? (
                            <Empty
                                description={searchInterv || filtreStatut ? 'Aucune intervention ne correspond' : 'Aucune intervention'}
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {interventionsFiltrees.map((interv) => {
                                    const statut = STATUT_COLORS[interv.statut] || { color: 'default', label: interv.statut };
                                    const border = BORDER_COLORS[statut.color] || '#d9d9d9';

                                    return (
                                        <Card key={interv.id} size="small"
                                            style={{ borderLeft: `4px solid ${border}` }}
                                            styles={{ body: { padding: '14px 16px' } }}>

                                            {/* Ligne 1 : numéro + statut */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <Space>
                                                    <span style={{ fontWeight: 700, color: '#555', fontSize: 13 }}>
                                                        <NumberOutlined style={{ marginRight: 4 }} />
                                                        {interv.numero}
                                                    </span>
                                                    <Tag color={statut.color}>{statut.label}</Tag>
                                                </Space>
                                                <span style={{ fontSize: 11, color: '#bbb' }}>
                                                    <CalendarOutlined style={{ marginRight: 4 }} />
                                                    {fmtDT(interv.date_creation)}
                                                </span>
                                            </div>

                                            {/* Description */}
                                            <div style={{ fontSize: 13, color: '#333', marginBottom: 10 }}>
                                                {interv.description || 'Aucune description'}
                                            </div>

                                            {/* Grille détails */}
                                            <Descriptions column={2} size="small" style={{ marginBottom: 8 }}>
                                                <Descriptions.Item label="Type de service">
                                                    {interv.type_service || '—'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><UserOutlined />Technicien</Space>}>
                                                    {interv.technicien_nom || '—'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><CalendarOutlined />Date planifiée</Space>}>
                                                    {fmtDT(interv.date_planifiee)}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><CalendarOutlined />Date clôture</Space>}>
                                                    {fmtDT(interv.date_cloture)}
                                                </Descriptions.Item>
                                            </Descriptions>

                                            {/* Diagnostic IA */}
                                            {interv.diagnostic_ia && (
                                                <div style={{
                                                    fontSize: 12, color: '#3a7d3a', background: '#f6ffed',
                                                    border: '1px solid #b7eb8f', borderRadius: 4,
                                                    padding: '6px 10px', marginBottom: 8
                                                }}>
                                                    <strong>🤖 Diagnostic IA : </strong>{interv.diagnostic_ia}
                                                </div>
                                            )}

                                            {/* Notes technicien */}
                                            {interv.notes_technicien && (
                                                <div style={{
                                                    fontSize: 12, color: '#555', background: '#fffbe6',
                                                    border: '1px solid #ffe58f', borderRadius: 4,
                                                    padding: '6px 10px'
                                                }}>
                                                    <strong>📝 Notes : </strong>{interv.notes_technicien}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>)}
            </Drawer>

            {/* MODAL CRÉATION / ÉDITION */}
            <Modal
                title={appareilSel ? 'Modifier l\'appareil' : 'Nouvel appareil'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); }}
                footer={null}
                width={560}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                        <Form.Item label="Marque" name="marque" rules={[{ required: true }]}>
                            <Input placeholder="Ex : Dell, HP, Cisco..." />
                        </Form.Item>
                        <Form.Item label="Modèle" name="modele" rules={[{ required: true }]}>
                            <Input placeholder="Ex : Latitude 5540" />
                        </Form.Item>
                        <Form.Item label="Type d'appareil" name="type_appareil" rules={[{ required: true }]}>
                            <Select placeholder="Sélectionner le type">
                                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                                    <Select.Option key={k} value={k}>
                                        {TYPE_ICONS[k]} {v}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item label="Client" name="client" rules={[{ required: true }]}>
                            <Select
                                placeholder="Sélectionner le client"
                                showSearch
                                filterOption={(input, option) =>
                                    option.children.toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {clients.map((c) => (
                                    <Select.Option key={c.id} value={c.id}>
                                        {c.nom}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item label="Numéro de série" name="numero_serie" style={{ gridColumn: '1 / -1' }}>
                            <Input placeholder="Ex : DL5540-2024-001" style={{ fontFamily: 'monospace' }} />
                        </Form.Item>
                        <Form.Item label="Sous garantie" name="sous_garantie" valuePropName="checked">
                            <Switch checkedChildren="Oui" unCheckedChildren="Non" />
                        </Form.Item>
                        <Form.Item label="Date fin de garantie" name="date_fin_garantie">
                            <DatePicker format="DD/MM/YYYY" placeholder="Sélectionner la date" style={{ width: '100%' }} />
                        </Form.Item>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 16 }}>
                        <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Annuler</Button>
                        <Button type="primary" htmlType="submit" style={{ marginLeft: 8, background: '#FF8C00', borderColor: '#FF8C00' }}>
                            {appareilSel ? 'Mettre à jour' : 'Créer'}
                        </Button>
                    </div>
                </Form>
            </Modal>

        </div>
    );
};

export default Appareils;