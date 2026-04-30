import React, { useState, useEffect, useMemo } from 'react';
import {
    Table, Card, Button, Input, Space, Modal, Form, message,
    Tooltip, Popconfirm, Drawer, Tag, Badge, Empty, Spin,
    Descriptions, Avatar, Divider, Select
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
    ReloadOutlined, EyeOutlined, ToolOutlined, MobileOutlined,
    CalendarOutlined, UserOutlined, PhoneOutlined, MailOutlined,
    ClockCircleOutlined, NumberOutlined, ThunderboltOutlined,
    ShopOutlined, SafetyCertificateOutlined, FilterOutlined
} from '@ant-design/icons';
import api from '../services/api';

// ─── CONFIG ───
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

const URGENCE_COLORS = {
    faible:   { color: 'default', label: 'Faible' },
    normale:  { color: 'blue',    label: 'Normale' },
    haute:    { color: 'orange',  label: 'Haute' },
    critique: { color: 'red',     label: 'Critique' },
};

const TYPE_SERVICE_LABELS = {
    reparation:    'Réparation matériel',
    installation:  'Installation logiciel',
    configuration: 'Configuration réseau',
    maintenance:   'Maintenance préventive',
    depannage:     'Dépannage à distance',
};

const CANAL_LABELS = {
    telephone: 'Téléphone',
    boutique:  'Boutique',
    email:     'Email',
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

const Clients = () => {
    const [clients, setClients]             = useState([]);
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState('');
    const [modalOpen, setModalOpen]         = useState(false);
    const [clientSel, setClientSel]         = useState(null);
    const [form]                            = Form.useForm();

    // ─── DRAWER ───
    const [drawerOpen, setDrawerOpen]       = useState(false);
    const [clientDrawer, setClientDrawer]   = useState(null);
    const [interventions, setInterventions] = useState([]);
    const [appareils, setAppareils]         = useState([]);
    const [loadingDrawer, setLoadingDrawer] = useState(false);

    // ─── RECHERCHE DANS LE DRAWER ───
    const [searchInterv, setSearchInterv]   = useState('');
    const [filtreStatut, setFiltreStatut]   = useState(null);
    const [searchAppareil, setSearchAppareil] = useState('');

    useEffect(() => { chargerClients(); }, []);

    const chargerClients = async () => {
        setLoading(true);
        try {
            const res = await api.get('/clients/');
            setClients(res.data);
        } catch { message.error('Erreur chargement clients'); }
        finally   { setLoading(false); }
    };

    const ouvrirDrawer = async (client) => {
        setClientDrawer(client);
        setDrawerOpen(true);
        setLoadingDrawer(true);
        // Reset filtres à chaque ouverture
        setSearchInterv('');
        setFiltreStatut(null);
        setSearchAppareil('');
        try {
            const [resI, resA] = await Promise.all([
                api.get(`/interventions/?client_id=${client.id}`),
                api.get(`/appareils/?client_id=${client.id}`)
            ]);
            setInterventions(resI.data);
            setAppareils(resA.data);
        } catch { message.error('Erreur chargement historique'); }
        finally   { setLoadingDrawer(false); }
    };

    const fermerDrawer = () => {
        setDrawerOpen(false);
        setClientDrawer(null);
        setInterventions([]);
        setAppareils([]);
        setSearchInterv('');
        setFiltreStatut(null);
        setSearchAppareil('');
    };

    // ─── FILTRES INTERVENTIONS (memo pour perf) ───
    const interventionsFiltrees = useMemo(() => {
        return interventions.filter((i) => {
            const q = searchInterv.toLowerCase();
            const matchTexte = !q || (
                i.numero?.toLowerCase().includes(q) ||
                i.description?.toLowerCase().includes(q) ||
                i.technicien_nom?.toLowerCase().includes(q) ||
                i.appareil_info?.toLowerCase().includes(q) ||
                TYPE_SERVICE_LABELS[i.type_service]?.toLowerCase().includes(q)
            );
            const matchStatut = !filtreStatut || i.statut === filtreStatut;
            return matchTexte && matchStatut;
        });
    }, [interventions, searchInterv, filtreStatut]);

    // ─── FILTRES APPAREILS (memo pour perf) ───
    const appareilsFiltres = useMemo(() => {
        const q = searchAppareil.toLowerCase();
        if (!q) return appareils;
        return appareils.filter((a) =>
            a.marque?.toLowerCase().includes(q) ||
            a.modele?.toLowerCase().includes(q) ||
            a.type_appareil?.toLowerCase().includes(q) ||
            a.numero_serie?.toLowerCase().includes(q)
        );
    }, [appareils, searchAppareil]);

    // ─── CRUD ───
    const handleSubmit = async (values) => {
        try {
            if (clientSel) {
                await api.put(`/clients/${clientSel.id}/`, values);
                message.success('Client modifié !');
            } else {
                await api.post('/clients/', values);
                message.success('Client créé !');
            }
            setModalOpen(false); form.resetFields(); setClientSel(null);
            chargerClients();
        } catch { message.error('Erreur'); }
    };

    const supprimerClient = async (id) => {
        try {
            await api.delete(`/clients/${id}/`);
            message.success('Client supprimé');
            chargerClients();
        } catch { message.error('Erreur suppression'); }
    };

    const ouvrirEdit = (client) => {
        setClientSel(client); form.setFieldsValue(client); setModalOpen(true);
    };

    const clientsFiltres = clients.filter(c =>
        c.nom?.toLowerCase().includes(search.toLowerCase()) ||
        c.telephone?.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );

    const colonnes = [
        {
            title: 'Nom', dataIndex: 'nom',
            render: (text) => (
                <Space>
                    <Avatar size="small" icon={<UserOutlined />} style={{ background: '#FF8C00' }} />
                    <span style={{ fontWeight: 600 }}>{text}</span>
                </Space>
            )
        },
        { title: 'Téléphone', dataIndex: 'telephone' },
        { title: 'Email',     dataIndex: 'email', render: (t) => t || '—' },
        { title: 'Date création', dataIndex: 'date_creation', render: fmt },
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
                    <Popconfirm title="Supprimer ce client ?" onConfirm={() => supprimerClient(record.id)}>
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
                    <h1 style={{ margin: 0 }}>Clients</h1>
                    <p style={{ color: '#999' }}>{clientsFiltres.length} client(s)</p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={chargerClients}>Actualiser</Button>
                    <Button type="primary" icon={<PlusOutlined />}
                        onClick={() => { setModalOpen(true); setClientSel(null); form.resetFields(); }}
                        style={{ background: '#FF8C00', borderColor: '#FF8C00' }}>
                        Nouveau client
                    </Button>
                </Space>
            </div>

            <Card style={{ marginBottom: 16 }}>
                <Input prefix={<SearchOutlined />} placeholder="Rechercher par nom, téléphone ou email..."
                    value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
            </Card>

            <Card>
                <Table columns={colonnes} dataSource={clientsFiltres} rowKey="id"
                    loading={loading} pagination={{ pageSize: 10 }} />
            </Card>

            {/* ══════════════════════════════
                DRAWER
            ══════════════════════════════ */}
            <Drawer
                title={
                    <Space>
                        <Avatar size={42} icon={<UserOutlined />} style={{ background: '#FF8C00' }} />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{clientDrawer?.nom}</div>
                            <div style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>Fiche client complète</div>
                        </div>
                    </Space>
                }
                width={720}
                open={drawerOpen}
                onClose={fermerDrawer}
                bodyStyle={{ padding: 0, overflowY: 'auto' }}
            >
                {loadingDrawer ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                        <Spin size="large" />
                    </div>
                ) : (<>

                    {/* ── INFOS CLIENT ── */}
                    <div style={{ padding: '18px 24px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: '#FF8C00', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                            Informations client
                        </div>
                        <Descriptions column={2} size="small">
                            <Descriptions.Item label={<Space size={4}><PhoneOutlined />Téléphone</Space>}>
                                <strong>{clientDrawer?.telephone || '—'}</strong>
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space size={4}><MailOutlined />Email</Space>}>
                                {clientDrawer?.email || '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space size={4}><CalendarOutlined />Client depuis</Space>}>
                                {fmt(clientDrawer?.date_creation)}
                            </Descriptions.Item>
                        </Descriptions>
                    </div>

                    {/* ── STATS ── */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
                        {[
                            { label: 'Interventions', value: interventions.length,                                       color: '#1890ff' },
                            { label: 'Appareils',     value: appareils.length,                                          color: '#FF8C00' },
                            { label: 'Terminées',     value: interventions.filter(i => i.statut === 'termine').length,  color: '#52c41a' },
                            { label: 'En cours',      value: interventions.filter(i => i.statut === 'en_cours').length, color: '#faad14' },
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
                            APPAREILS
                        ══════════════════ */}
                        <Divider orientation="left" style={{ marginTop: 28 }}>
                            <Space>
                                <MobileOutlined style={{ color: '#FF8C00' }} />
                                <span style={{ fontWeight: 700 }}>Appareils</span>
                                <Badge count={appareils.length} style={{ background: '#FF8C00' }} />
                            </Space>
                        </Divider>

                        {/* Barre de recherche appareils */}
                        {appareils.length > 0 && (
                            <Input
                                prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                                placeholder="Rechercher par marque, modèle, type, N° série..."
                                value={searchAppareil}
                                onChange={(e) => setSearchAppareil(e.target.value)}
                                allowClear
                                style={{ marginBottom: 12 }}
                            />
                        )}

                        {appareilsFiltres.length === 0 ? (
                            <Empty
                                description={searchAppareil ? 'Aucun appareil ne correspond' : 'Aucun appareil enregistré'}
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {appareilsFiltres.map((ap) => (
                                    <Card key={ap.id} size="small"
                                        style={{ borderLeft: '4px solid #FF8C00' }}
                                        styles={{ body: { padding: '12px 16px' } }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Space align="start">
                                                <MobileOutlined style={{ color: '#FF8C00', fontSize: 20, marginTop: 3 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                                                        {ap.type_appareil && <Tag style={{ marginRight: 6 }}>{ap.type_appareil}</Tag>}
                                                        {ap.marque} {ap.modele}
                                                    </div>
                                                    {ap.numero_serie && (
                                                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                                            <NumberOutlined style={{ marginRight: 4 }} />
                                                            S/N : <strong>{ap.numero_serie}</strong>
                                                        </div>
                                                    )}
                                                    {ap.date_achat && (
                                                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                                            <CalendarOutlined style={{ marginRight: 4 }} />
                                                            Acheté le : {fmt(ap.date_achat)}
                                                        </div>
                                                    )}
                                                </div>
                                            </Space>
                                            <Tag
                                                icon={<SafetyCertificateOutlined />}
                                                color={ap.sous_garantie ? 'success' : 'default'}
                                                style={{ alignSelf: 'flex-start' }}
                                            >
                                                {ap.sous_garantie ? 'Sous garantie' : 'Hors garantie'}
                                            </Tag>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* ══════════════════════════
                            INTERVENTIONS
                        ══════════════════════════ */}
                        <Divider orientation="left" style={{ marginTop: 32 }}>
                            <Space>
                                <ToolOutlined style={{ color: '#1890ff' }} />
                                <span style={{ fontWeight: 700 }}>Historique des interventions</span>
                                <Badge count={interventions.length} style={{ background: '#1890ff' }} />
                            </Space>
                        </Divider>

                        {/* Barre de recherche + filtre statut interventions */}
                        {interventions.length > 0 && (
                            <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                                <Input
                                    prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                                    placeholder="Rechercher par N°, description, technicien, appareil..."
                                    value={searchInterv}
                                    onChange={(e) => setSearchInterv(e.target.value)}
                                    allowClear
                                    style={{ flex: 1 }}
                                />
                                <Select
                                    placeholder={<Space size={4}><FilterOutlined />Statut</Space>}
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

                        {/* Compteur résultats filtrés */}
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
                                    const statut  = STATUT_COLORS[interv.statut]   || { color: 'default', label: interv.statut };
                                    const urgence = URGENCE_COLORS[interv.urgence] || { color: 'default', label: interv.urgence };
                                    const border  = BORDER_COLORS[statut.color]    || '#d9d9d9';

                                    return (
                                        <Card key={interv.id} size="small"
                                            style={{ borderLeft: `4px solid ${border}` }}
                                            styles={{ body: { padding: '14px 16px' } }}>

                                            {/* Ligne 1 : numéro + statut + urgence */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <Space>
                                                    <span style={{ fontWeight: 700, color: '#555', fontSize: 13 }}>
                                                        <NumberOutlined style={{ marginRight: 4 }} />
                                                        {interv.numero}
                                                    </span>
                                                    <Tag color={statut.color}>{statut.label}</Tag>
                                                    <Tag color={urgence.color} icon={<ThunderboltOutlined />}>{urgence.label}</Tag>
                                                </Space>
                                                <span style={{ fontSize: 11, color: '#bbb' }}>
                                                    <CalendarOutlined style={{ marginRight: 4 }} />
                                                    {fmtDT(interv.date_creation)}
                                                </span>
                                            </div>

                                            {/* Description */}
                                            <div style={{ fontSize: 13, color: '#333', marginBottom: 10 }}>
                                                {interv.description}
                                            </div>

                                            {/* Grille détails */}
                                            <Descriptions column={2} size="small" style={{ marginBottom: 8 }}>
                                                <Descriptions.Item label="Type de service">
                                                    {TYPE_SERVICE_LABELS[interv.type_service] || interv.type_service || '—'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><ShopOutlined />Canal</Space>}>
                                                    {CANAL_LABELS[interv.canal_entree] || interv.canal_entree || '—'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><UserOutlined />Technicien</Space>}>
                                                    {interv.technicien_nom || '—'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><MobileOutlined />Appareil</Space>}>
                                                    {interv.appareil_info || '—'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><CalendarOutlined />Date planifiée</Space>}>
                                                    {fmtDT(interv.date_planifiee)}
                                                </Descriptions.Item>
                                                <Descriptions.Item label={<Space size={4}><CalendarOutlined />Date clôture</Space>}>
                                                    {fmtDT(interv.date_cloture)}
                                                </Descriptions.Item>
                                                {interv.duree_estimee && (
                                                    <Descriptions.Item label={<Space size={4}><ClockCircleOutlined />Durée estimée</Space>}>
                                                        {interv.duree_estimee}h
                                                    </Descriptions.Item>
                                                )}
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

            {/* MODAL */}
            <Modal
                title={clientSel ? 'Modifier client' : 'Nouveau client'}
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); }}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item label="Nom" name="nom" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="Téléphone" name="telephone" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="Email" name="email"><Input /></Form.Item>
                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => setModalOpen(false)}>Annuler</Button>
                        <Button type="primary" htmlType="submit" style={{ marginLeft: 8 }}>Enregistrer</Button>
                    </div>
                </Form>
            </Modal>

        </div>
    );
};

export default Clients;