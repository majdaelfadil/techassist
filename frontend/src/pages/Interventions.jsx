import React, { useState, useEffect, useCallback } from 'react';
import {
    Table, Card, Button, Tag, Input, Select,
    Space, Modal, Form, message, Tooltip,
    Popconfirm, DatePicker, Drawer, Descriptions, InputNumber,
    Divider, Alert, Result
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined,
    DeleteOutlined, FilterOutlined,
    SwapOutlined, UserAddOutlined, ReloadOutlined,
    CheckCircleOutlined, DollarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Option } = Select;

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
    const [form] = Form.useForm();
    const [formStatut] = Form.useForm();
    const [formAssigner] = Form.useForm();
    const navigate = useNavigate();

    // ─── CHARGER DONNÉES AVEC useCallback ───
    const chargerInterventions = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/interventions/?';
            if (filtreStatut)
                url += `statut=${filtreStatut}&`;
            if (filtreUrgence)
                url += `urgence=${filtreUrgence}&`;
            if (filtreType)
                url += `type_service=${filtreType}&`;
            const res = await api.get(url);
            setInterventions(res.data);
        } catch (error) {
            message.error('Erreur chargement interventions');
        } finally {
            setLoading(false);
        }
    }, [filtreStatut, filtreUrgence, filtreType]);

    const chargerClients = useCallback(async () => {
        try {
            const res = await api.get('/clients/');
            setClients(res.data);
        } catch (error) {}
    }, []);

    const chargerTechniciens = useCallback(async () => {
        try {
            const res = await api.get('/techniciens/');
            setTechniciens(res.data);
        } catch (error) {}
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
        } catch (error) {}
    };

    const chargerTransitions = async (id) => {
        try {
            const res = await api.get(`/interventions/${id}/transitions/`);
            setTransitions(res.data.transitions_possibles);
        } catch (error) {}
    };

    // ─── CRÉER INTERVENTION ───
    const creerIntervention = async (values) => {
        try {
            await api.post('/interventions/', values);
            message.success('Intervention créée !');
            setModalCreer(false);
            form.resetFields();
            chargerInterventions();
        } catch (error) {
            message.error('Erreur création');
        }
    };

    // ─── SUPPRIMER INTERVENTION ───
    const supprimerIntervention = async (id) => {
        try {
            await api.delete(`/interventions/${id}/`);
            message.success('Intervention supprimée !');
            chargerInterventions();
        } catch (error) {
            message.error('Erreur suppression');
        }
    };

    // ─── CHANGER STATUT ───
    const changerStatut = async (values) => {
        try {
            await api.post(`/interventions/${interventionSelectionnee.id}/changer-statut/`, { statut: values.statut });
            message.success('Statut mis à jour !');
            setModalStatut(false);
            formStatut.resetFields();
            chargerInterventions();
        } catch (error) {
            message.error('Transition non autorisée');
        }
    };

    // ─── VALIDER INTERVENTION ET GÉNÉRER FACTURE ───
    const validerInterventionAvecFacture = async () => {
        setValidating(true);
        try {
            const res = await api.post(`/interventions/${interventionSelectionnee.id}/valider-generer-facture/`);
            setValidationResult(res.data);
            message.success('Intervention validée et facture générée !');
            chargerInterventions();
        } catch (error) {
            if (error.response?.data?.erreur) {
                message.error(error.response.data.erreur);
            } else {
                message.error('Erreur lors de la validation');
            }
        } finally {
            setValidating(false);
        }
    };

    // ─── OUVRIR MODAL VALIDATION ───
    const ouvrirModalValidation = (intervention) => {
        setInterventionSelectionnee(intervention);
        setValidationResult(null);
        setModalValidation(true);
    };

    // ─── VÉRIFIER DISPONIBILITÉ ───
    const [disponibilite, setDisponibilite] = useState(null);
    const [checkingDispo, setCheckingDispo] = useState(false);

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
        } catch (error) {
            setDisponibilite(null);
        } finally {
            setCheckingDispo(false);
        }
    };

    // ─── ASSIGNER TECHNICIEN ───
    const assignerTechnicien = async (values) => {
        if (!disponibilite || !disponibilite.disponible) {
            message.warning('Vérifiez d\'abord la disponibilité du technicien !');
            return;
        }
        try {
            await api.post(`/interventions/${interventionSelectionnee.id}/assigner-technicien/`, {
                technicien_id: values.technicien_id,
                date_planifiee: values.date_planifiee?.toISOString(),
                duree_estimee: values.duree_estimee
            });
            message.success('Technicien assigné avec succès !');
            setModalAssigner(false);
            setDisponibilite(null);
            formAssigner.resetFields();
            chargerInterventions();
        } catch (error) {
            if (error.response?.data?.erreur === 'Conflit de planning') {
                message.error(error.response.data.message);
            } else {
                message.error('Erreur lors de l\'assignation');
            }
        }
    };

    // ─── OUVRIR MODAL STATUT ───
    const ouvrirModalStatut = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerTransitions(intervention.id);
        setModalStatut(true);
    };

    // ─── OUVRIR MODAL ASSIGNER ───
    const ouvrirModalAssigner = (intervention) => {
        setInterventionSelectionnee(intervention);
        setModalAssigner(true);
    };

    // ─── OUVRIR DRAWER DÉTAIL ───
    const ouvrirDetail = async (intervention) => {
        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            setInterventionSelectionnee(res.data);
            setDrawerDetail(true);
        } catch (error) {}
    };

    // ─── NAVIGUER VERS FACTURES ───
    const allerVersFactures = () => {
        setModalValidation(false);
        navigate('/factures');
    };

    // ─── FILTRAGE LOCAL ───
    const interventionsFiltrees = interventions.filter(i =>
        i.numero?.toLowerCase().includes(search.toLowerCase()) ||
        i.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
        i.technicien_nom?.toLowerCase().includes(search.toLowerCase())
    );

    // ─── COULEURS ───
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

    const typesService = {
        'reparation':    'Réparation',
        'installation':  'Installation',
        'configuration': 'Configuration',
        'maintenance':   'Maintenance',
        'depannage':     'Dépannage'
    };

    // ─── COLONNES ───
    const colonnes = [
        {
            title: 'Numéro',
            dataIndex: 'numero',
            width: 140,
            render: (text) => (
                <span style={{ color: '#FF8C00', fontWeight: 700, fontSize: 13 }}>
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
            render: (statut) => (
                <Tag color={couleurStatut[statut]} style={{ borderRadius: 6, fontWeight: 500 }}>
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Canal',
            dataIndex: 'canal_entree',
            render: (canal) => {
                const canaux = {
                    'telephone': '📞 Téléphone',
                    'boutique':  '🏪 Boutique',
                    'email':     '✉️ Email'
                };
                return canaux[canal] || canal;
            }
        },
        {
            title: 'Date',
            dataIndex: 'date_creation',
            render: (date) => new Date(date).toLocaleDateString('fr-FR')
        },
        {
            title: 'Actions',
            width: 220,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir détail">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            style={{ color: '#FF8C00' }}
                            onClick={() => ouvrirDetail(record)}
                        />
                    </Tooltip>

                    <Tooltip title="Changer statut">
                        <Button
                            type="text"
                            icon={<SwapOutlined />}
                            style={{ color: '#722ed1' }}
                            onClick={() => ouvrirModalStatut(record)}
                        />
                    </Tooltip>

                    <Tooltip title="Assigner technicien">
                        <Button
                            type="text"
                            icon={<UserAddOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => ouvrirModalAssigner(record)}
                        />
                    </Tooltip>

                    {record.statut === 'termine' && (
                        <Tooltip title="Valider et générer la facture">
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                style={{ 
                                    background: '#52c41a', 
                                    borderColor: '#52c41a',
                                    fontWeight: 500
                                }}
                                onClick={() => ouvrirModalValidation(record)}
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
                            okText="Oui"
                            cancelText="Non"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                type="text"
                                icon={<DeleteOutlined />}
                                style={{ color: '#f5222d' }}
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
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
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                        Interventions
                    </h1>
                    <p style={{ color: '#999', margin: '4px 0 0', fontSize: 14 }}>
                        {interventionsFiltrees.length} résultat(s)
                    </p>
                </div>

                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={chargerInterventions}
                        style={{ borderRadius: 10 }}
                    >
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
                            fontWeight: 600,
                            height: 44
                        }}
                    >
                        Nouvelle intervention
                    </Button>
                </Space>
            </div>

            {/* ─── FILTRES ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: 16
                }}
            >
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par numéro, client ou technicien..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 320, borderRadius: 8 }}
                    />

                    <Select
                        placeholder="Statut"
                        allowClear
                        style={{ width: 160 }}
                        onChange={setFiltreStatut}
                        suffixIcon={<FilterOutlined />}
                    >
                        {['nouveau', 'diagnostique', 'assigne', 'en_cours',
                          'attente_pieces', 'termine', 'valide', 'facture', 'cloture'].map(s => (
                            <Option key={s} value={s}>
                                <Tag color={couleurStatut[s]} style={{ borderRadius: 4 }}>
                                    {s.toUpperCase()}
                                </Tag>
                            </Option>
                        ))}
                    </Select>

                    <Select
                        placeholder="Urgence"
                        allowClear
                        style={{ width: 140 }}
                        onChange={setFiltreUrgence}
                    >
                        {['faible', 'normale', 'haute', 'critique'].map(u => (
                            <Option key={u} value={u}>
                                {u.toUpperCase()}
                            </Option>
                        ))}
                    </Select>

                    <Select
                        placeholder="Type de service"
                        allowClear
                        style={{ width: 180 }}
                        onChange={setFiltreType}
                    >
                        {Object.entries(typesService).map(([key, val]) => (
                            <Option key={key} value={key}>
                                {val}
                            </Option>
                        ))}
                    </Select>
                </Space>
            </Card>

            {/* ─── TABLEAU ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                }}
            >
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

            {/* ─── MODAL CRÉER ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>➕ Nouvelle intervention</span>}
                open={modalCreer}
                onCancel={() => {
                    setModalCreer(false);
                    form.resetFields();
                }}
                footer={null}
                width={640}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={creerIntervention}
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        label="Client"
                        name="client_id"
                        rules={[{ required: true, message: 'Sélectionnez un client' }]}
                    >
                        <Select
                            placeholder="Choisir un client"
                            showSearch
                            filterOption={(input, option) =>
                                option.children.toLowerCase().includes(input.toLowerCase())
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

                    <Form.Item
                        label="Appareil"
                        name="appareil_id"
                    >
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

                    <Form.Item
                        label="Description du problème"
                        name="description"
                        rules={[{ required: true, message: 'Description obligatoire' }]}
                    >
                        <Input.TextArea
                            rows={4}
                            placeholder="Décrivez le problème en détail..."
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={12}>
                        <Form.Item
                            label="Type de service"
                            name="type_service"
                            rules={[{ required: true, message: 'Obligatoire' }]}
                            style={{ flex: 1 }}
                        >
                            <Select placeholder="Type">
                                {Object.entries(typesService).map(([k, v]) => (
                                    <Option key={k} value={k}>
                                        {v}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="Canal d'entrée"
                            name="canal_entree"
                            rules={[{ required: true, message: 'Obligatoire' }]}
                            style={{ flex: 1 }}
                        >
                            <Select placeholder="Canal">
                                <Option value="telephone">📞 Téléphone</Option>
                                <Option value="boutique">🏪 Boutique</Option>
                                <Option value="email">✉️ Email</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            label="Urgence"
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

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                        <Button onClick={() => { setModalCreer(false); form.resetFields(); }} style={{ borderRadius: 8 }}>
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
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL CHANGER STATUT ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>🔄 Changer le statut</span>}
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
                            Intervention :
                            <strong style={{ color: '#FF8C00', marginLeft: 8 }}>
                                {interventionSelectionnee.numero}
                            </strong>
                        </p>
                        <p style={{ color: '#666' }}>
                            Statut actuel :
                            <Tag color={couleurStatut[interventionSelectionnee.statut]} style={{ marginLeft: 8 }}>
                                {interventionSelectionnee.statut?.toUpperCase()}
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
                                    <Tag color={couleurStatut[t]}>
                                        {t.toUpperCase()}
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

            {/* ─── MODAL VALIDATION AVEC FACTURE ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>✅ Validation de l'intervention</span>}
                open={modalValidation}
                onCancel={() => {
                    setModalValidation(false);
                    setValidationResult(null);
                }}
                footer={null}
                width={520}
            >
                {!validationResult ? (
                    <>
                        {interventionSelectionnee && (
                            <div style={{ marginBottom: 20 }}>
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Confirmation de validation"
                                    description={
                                        <div style={{ marginTop: 8 }}>
                                            <p>Intervention : <strong>{interventionSelectionnee.numero}</strong></p>
                                            <p>Client : <strong>{interventionSelectionnee.client_nom}</strong></p>
                                            <p>Statut actuel : <Tag color="success">TERMINE</Tag></p>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <p style={{ marginBottom: 0 }}>
                                                Une fois validée, l'intervention passera en statut <strong>VALIDÉ</strong> 
                                                et une <strong>facture sera automatiquement générée</strong>.
                                            </p>
                                            <p style={{ marginTop: 8, marginBottom: 0, color: '#FF8C00' }}>
                                                💰 La facture sera disponible dans l'onglet "Factures"
                                            </p>
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }}
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button onClick={() => setModalValidation(false)}>
                                Annuler
                            </Button>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={validerInterventionAvecFacture}
                                loading={validating}
                                style={{
                                    background: '#52c41a',
                                    borderColor: '#52c41a',
                                    borderRadius: 8,
                                    fontWeight: 600
                                }}
                            >
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
                                <p>La facture a été générée.</p>
                                <div style={{
                                    background: '#f6ffed',
                                    padding: '12px',
                                    borderRadius: 8,
                                    marginTop: 16,
                                    textAlign: 'left'
                                }}>
                                    <p><strong>📄 Facture :</strong> {validationResult.facture?.numero}</p>
                                    <p><strong>💰 Total TTC :</strong> {parseFloat(validationResult.facture?.total_ttc).toFixed(2)} MAD</p>
                                    <p><strong>📊 Statut :</strong> {validationResult.facture?.statut?.toUpperCase()}</p>
                                </div>
                            </div>
                        }
                        extra={[
                            <Button
                                key="factures"
                                type="primary"
                                icon={<DollarOutlined />}
                                onClick={allerVersFactures}
                                style={{ background: '#FF8C00', borderColor: '#FF8C00' }}
                            >
                                Voir toutes les factures
                            </Button>,
                            <Button
                                key="close"
                                onClick={() => {
                                    setModalValidation(false);
                                    setValidationResult(null);
                                }}
                            >
                                Fermer
                            </Button>,
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
                footer={null}
                width={480}
            >
                <Form
                    form={formAssigner}
                    layout="vertical"
                    onFinish={assignerTechnicien}
                    style={{ marginTop: 16 }}
                    onValuesChange={(_, allValues) => {
                        setDisponibilite(null);
                    }}
                >
                    <Form.Item
                        label="Technicien"
                        name="technicien_id"
                        rules={[{ required: true, message: 'Choisissez un technicien' }]}
                    >
                        <Select
                            placeholder="Choisir un technicien"
                            showSearch
                            filterOption={(input, option) =>
                                option.children.toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {techniciens.map(t => (
                                <Option key={t.id} value={t.id}>
                                    {t.nom} — {t.specialite}{t.disponible ? ' ✅' : ' ❌'}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Date planifiée"
                        name="date_planifiee"
                        rules={[{ required: true, message: 'Date obligatoire' }]}
                    >
                        <DatePicker
                            showTime
                            style={{ width: '100%', borderRadius: 8 }}
                            placeholder="Choisir date et heure"
                            format="DD/MM/YYYY HH:mm"
                            disabledDate={(current) => {
                                return current && current.day() === 0;
                            }}
                            disabledTime={(date) => {
                                if (!date) return {};
                                const isSamedi = date.day() === 6;
                                return {
                                    disabledHours: () => {
                                        const heures = [];
                                        for (let i = 0; i < 8; i++) heures.push(i);
                                        if (!isSamedi) {
                                            heures.push(13, 14);
                                        } else {
                                            for (let i = 13; i < 24; i++) heures.push(i);
                                        }
                                        if (!isSamedi) {
                                            for (let i = 19; i < 24; i++) heures.push(i);
                                        }
                                        return heures;
                                    }
                                };
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Durée estimée (heures)"
                        name="duree_estimee"
                        initialValue={1}
                        rules={[{ required: true, message: 'Durée obligatoire' }]}
                    >
                        <InputNumber
                            min={0.5}
                            max={8}
                            step={0.5}
                            style={{ width: '100%', borderRadius: 8 }}
                            addonAfter="h"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="default"
                            icon={<CheckCircleOutlined />}
                            loading={checkingDispo}
                            onClick={() => verifierDisponibilite(formAssigner.getFieldsValue())}
                            style={{
                                width: '100%',
                                borderRadius: 8,
                                borderColor: '#1890ff',
                                color: '#1890ff',
                                fontWeight: 600
                            }}
                        >
                            Vérifier la disponibilité
                        </Button>
                    </Form.Item>

                    {disponibilite && (
                        <div style={{ marginBottom: 16 }}>
                            {disponibilite.disponible ? (
                                <Alert
                                    type="success"
                                    showIcon
                                    message="Technicien disponible ✅"
                                    description={
                                        <div>
                                            <div>{disponibilite.message}</div>
                                            <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                                                Début : {disponibilite.date_debut} — Fin : {disponibilite.date_fin}
                                            </div>
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }}
                                />
                            ) : (
                                <Alert
                                    type="error"
                                    showIcon
                                    message="Technicien non disponible ❌"
                                    description={
                                        <div>
                                            <div>{disponibilite.message}</div>
                                            {disponibilite.suggestion && (
                                                <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                                                    💡 {disponibilite.suggestion}
                                                </div>
                                            )}
                                            {disponibilite.conflits?.length > 0 && (
                                                <div style={{ marginTop: 8 }}>
                                                    {disponibilite.conflits.map((c, i) => (
                                                        <div key={i} style={{
                                                            background: '#fff2f0',
                                                            padding: '4px 8px',
                                                            borderRadius: 4,
                                                            marginTop: 4,
                                                            fontSize: 12
                                                        }}>
                                                            🔴 {c.numero} — {c.client} : {c.debut} → {c.fin}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }}
                                />
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => {
                            setModalAssigner(false);
                            setDisponibilite(null);
                            formAssigner.resetFields();
                        }}>
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            disabled={!disponibilite?.disponible}
                            style={{
                                background: disponibilite?.disponible ? '#1890ff' : '#d9d9d9',
                                borderColor: disponibilite?.disponible ? '#1890ff' : '#d9d9d9',
                                borderRadius: 8,
                                fontWeight: 600
                            }}
                        >
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
                                {interventionSelectionnee.appareil ?
                                    `${interventionSelectionnee.appareil.marque} ${interventionSelectionnee.appareil.modele}` :
                                    'N/A'}
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
                                {new Date(interventionSelectionnee.date_creation).toLocaleDateString('fr-FR')}
                            </Descriptions.Item>

                            <Descriptions.Item label="Date planifiée">
                                {interventionSelectionnee.date_planifiee ?
                                    new Date(interventionSelectionnee.date_planifiee).toLocaleDateString('fr-FR') :
                                    'Non planifiée'}
                            </Descriptions.Item>

                            <Descriptions.Item label="Durée estimée">
                                {interventionSelectionnee.duree_estimee ?
                                    `${interventionSelectionnee.duree_estimee}h` :
                                    'N/A'}
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