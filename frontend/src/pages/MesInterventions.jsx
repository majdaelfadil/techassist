import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Space, message,
    Modal, Form, Input, Drawer, Descriptions,
    Divider, Alert, Tooltip, Select,
    InputNumber, List, Popconfirm
} from 'antd';
import {
    EyeOutlined, SwapOutlined, EditOutlined,
    FileTextOutlined, CheckCircleOutlined,
    ReloadOutlined, RobotOutlined,
    PlusOutlined, DeleteOutlined,
    AppstoreOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

const MesInterventions = () => {
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalStatut, setModalStatut] = useState(false);
    const [modalNotes, setModalNotes] = useState(false);
    const [modalPieces, setModalPieces] = useState(false);
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [drawerRapport, setDrawerRapport] = useState(false);
    const [interventionSelectionnee, setInterventionSelectionnee] = useState(null);
    const [rapport, setRapport] = useState(null);
    const [transitions, setTransitions] = useState([]);
    const [loadingRapport, setLoadingRapport] = useState(false);
    const [pieces, setPieces] = useState([]);
    const [piecesUtilisees, setPiecesUtilisees] = useState([]);
    const [savingNotes, setSavingNotes] = useState(false);
    const [formStatut] = Form.useForm();
    const [formNotes] = Form.useForm();
    const [formRapport] = Form.useForm();
    const [formPiece] = Form.useForm();

    useEffect(() => {
        chargerInterventions();
    }, []);

    // ─── CHARGER INTERVENTIONS ───
    const chargerInterventions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/interventions/');
            setInterventions(res.data);
        } catch (error) {
            message.error('Erreur chargement');
        } finally {
            setLoading(false);
        }
    };

    // ─── CHARGER PIÈCES STOCK ───
    const chargerPieces = async () => {
        try {
            const res = await api.get('/pieces/');
            setPieces(res.data);
        } catch (error) {}
    };

    // ─── CHARGER PIÈCES UTILISÉES ───
    const chargerPiecesUtilisees = async (id) => {
        try {
            const res = await api.get(`/interventions/${id}/pieces/`);
            setPiecesUtilisees(res.data.pieces);
        } catch (error) {}
    };

    // ─── CHARGER TRANSITIONS ───
    const chargerTransitions = async (id) => {
        try {
            const res = await api.get(`/interventions/${id}/transitions/`);
            setTransitions(res.data.transitions_possibles);
        } catch (error) {}
    };

    // ─── CHANGER STATUT ───
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
        } catch (error) {
            message.error('Transition non autorisée');
        }
    };

    // ─── SAUVEGARDER NOTES ───
    const sauvegarderNotes = async (values) => {
        setSavingNotes(true);
        try {
            const payload = {
                notes_technicien: values.notes_technicien,
            };
            // N'envoyer duree_reelle que si elle est renseignée
            if (values.duree_reelle !== undefined &&
                values.duree_reelle !== null &&
                values.duree_reelle !== '') {
                payload.duree_reelle = values.duree_reelle;
            }

            await api.patch(
                `/interventions/${interventionSelectionnee.id}/`,
                payload
            );

            // Mettre à jour localement pour que le drawer rapport
            // détecte les notes sans recharger
            setInterventionSelectionnee(prev => ({
                ...prev,
                notes_technicien: values.notes_technicien,
                duree_reelle: values.duree_reelle
            }));

            // Mettre à jour aussi dans la liste
            setInterventions(prev =>
                prev.map(i =>
                    i.id === interventionSelectionnee.id
                        ? {
                            ...i,
                            notes_technicien: values.notes_technicien,
                            duree_reelle: values.duree_reelle
                          }
                        : i
                )
            );

            message.success('Notes sauvegardées !');
            setModalNotes(false);
            formNotes.resetFields();
        } catch (error) {
            const erreur = error.response?.data;
            console.error('Erreur sauvegarde notes:', erreur);
            message.error(
                erreur?.detail ||
                JSON.stringify(erreur) ||
                'Erreur sauvegarde'
            );
        } finally {
            setSavingNotes(false);
        }
    };

    // ─── AJOUTER PIÈCE UTILISÉE ───
    const ajouterPiece = async (values) => {
        try {
            await api.post(
                `/interventions/${interventionSelectionnee.id}/ajouter-piece/`,
                {
                    piece_id: values.piece_id,
                    quantite: values.quantite
                }
            );
            message.success('Pièce ajoutée !');
            formPiece.resetFields();
            chargerPiecesUtilisees(interventionSelectionnee.id);
        } catch (error) {
            message.error(
                error.response?.data?.erreur || 'Erreur ajout pièce'
            );
        }
    };

    // ─── SUPPRIMER PIÈCE UTILISÉE ───
    const supprimerPieceUtilisee = async (id) => {
        try {
            await api.delete(`/pieces-utilisees/${id}/supprimer/`);
            message.success('Pièce retirée !');
            chargerPiecesUtilisees(interventionSelectionnee.id);
        } catch (error) {
            message.error('Erreur suppression');
        }
    };

    // ─── GÉNÉRER RAPPORT IA ───
    const genererRapport = async (id) => {
        setLoadingRapport(true);
        try {
            const res = await api.post(`/interventions/${id}/generer-rapport/`);
            setRapport(res.data);
            formRapport.setFieldsValue({ contenu: res.data.contenu });
            message.success('Rapport généré !');
        } catch (error) {
            message.error(
                error.response?.data?.erreur || 'Erreur génération rapport'
            );
        } finally {
            setLoadingRapport(false);
        }
    };

    // ─── MODIFIER RAPPORT ───
    const modifierRapport = async (values) => {
        try {
            await api.patch(
                `/rapports/${rapport.rapport_id}/`,
                { contenu: values.contenu }
            );
            message.success('Rapport modifié !');
            setRapport({ ...rapport, contenu: values.contenu });
        } catch (error) {
            message.error('Erreur modification');
        }
    };

    // ─── VALIDER RAPPORT ───
    const validerRapport = async () => {
        try {
            await api.post(`/rapports/${rapport.rapport_id}/valider/`);
            message.success('Rapport validé !');
            setDrawerRapport(false);
            setRapport(null);
            formRapport.resetFields();
            chargerInterventions();
        } catch (error) {
            message.error('Erreur validation');
        }
    };

    // ─── OUVRIR MODAL PIÈCES ───
    const ouvrirModalPieces = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerPieces();
        await chargerPiecesUtilisees(intervention.id);
        setModalPieces(true);
    };

    // ─── OUVRIR MODAL STATUT ───
    const ouvrirModalStatut = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerTransitions(intervention.id);
        setModalStatut(true);
    };

    // ─── OUVRIR MODAL NOTES ───
    const ouvrirModalNotes = (intervention) => {
        setInterventionSelectionnee(intervention);
        formNotes.setFieldsValue({
            notes_technicien: intervention.notes_technicien || '',
            duree_reelle: intervention.duree_reelle || null
        });
        setModalNotes(true);
    };

    // ─── OUVRIR DRAWER RAPPORT ───
    const ouvrirDrawerRapport = async (intervention) => {
        setInterventionSelectionnee(intervention);
        setRapport(null);
        setDrawerRapport(true);
        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            if (res.data.rapport) {
                setRapport({
                    rapport_id: res.data.rapport.id,
                    contenu: res.data.rapport.contenu,
                    genere_par_ia: res.data.rapport.genere_par_ia,
                    valide: res.data.rapport.valide
                });
                formRapport.setFieldsValue({
                    contenu: res.data.rapport.contenu
                });
            }
        } catch (error) {}
    };

    // ─── COULEURS ───
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
            title: 'Appareil',
            dataIndex: 'appareil_info',
            render: (text) => text || (
                <span style={{ color: '#ccc' }}>N/A</span>
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
                const config = {
                    'faible':   { color: '#52c41a', bg: '#f6ffed' },
                    'normale':  { color: '#1890ff', bg: '#e6f7ff' },
                    'haute':    { color: '#fa8c16', bg: '#fff7e6' },
                    'critique': { color: '#f5222d', bg: '#fff1f0' },
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
            render: (statut) => (
                <Tag color={couleurStatut[statut]} style={{ borderRadius: 6 }}>
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Date planifiée',
            dataIndex: 'date_planifiee',
            render: (date) => date ? (
                <span style={{ color: '#1890ff', fontWeight: 500 }}>
                    {new Date(date).toLocaleDateString('fr-FR')}
                </span>
            ) : (
                <span style={{ color: '#ccc' }}>Non planifiée</span>
            )
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
                            onClick={() => {
                                setInterventionSelectionnee(record);
                                setDrawerDetail(true);
                            }}
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
                    <Tooltip title="Saisir notes">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => ouvrirModalNotes(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Pièces utilisées">
                        <Button
                            type="text"
                            icon={<AppstoreOutlined />}
                            style={{ color: '#fa8c16' }}
                            onClick={() => ouvrirModalPieces(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Rapport IA">
                        <Button
                            type="text"
                            icon={<FileTextOutlined />}
                            style={{ color: '#52c41a' }}
                            onClick={() => ouvrirDrawerRapport(record)}
                        />
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
                    <h1 style={{
                        fontSize: 24, fontWeight: 700,
                        color: '#1A1A1A', margin: 0
                    }}>
                        Mes Interventions
                    </h1>
                    <p style={{ color: '#999', margin: '4px 0 0', fontSize: 14 }}>
                        {interventions.length} intervention(s) assignée(s)
                    </p>
                </div>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={chargerInterventions}
                    style={{ borderRadius: 10 }}
                >
                    Actualiser
                </Button>
            </div>

            {/* ─── TABLEAU ─── */}
            <Card
                bordered={false}
                style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            >
                <Table
                    columns={colonnes}
                    dataSource={interventions}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) => `${total} interventions`
                    }}
                />
            </Card>

            {/* ─── MODAL CHANGER STATUT ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>🔄 Changer le statut</span>}
                open={modalStatut}
                onCancel={() => { setModalStatut(false); formStatut.resetFields(); }}
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
                            <Tag
                                color={couleurStatut[interventionSelectionnee.statut]}
                                style={{ marginLeft: 8 }}
                            >
                                {interventionSelectionnee.statut?.toUpperCase()}
                            </Tag>
                        </p>
                    </div>
                )}
                <Form form={formStatut} layout="vertical" onFinish={changerStatut}>
                    <Form.Item
                        label="Nouveau statut"
                        name="statut"
                        rules={[{ required: true, message: 'Choisissez' }]}
                    >
                        <Select placeholder="Choisir...">
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
                            style={{ background: '#722ed1', borderColor: '#722ed1', borderRadius: 8 }}
                        >
                            Confirmer
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL NOTES TECHNIQUES ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>📝 Notes techniques</span>}
                open={modalNotes}
                onCancel={() => { setModalNotes(false); formNotes.resetFields(); }}
                footer={null}
                width={560}
            >
                {interventionSelectionnee && (
                    <div style={{
                        marginBottom: 16,
                        padding: '10px 14px',
                        background: '#f8f9fa',
                        borderRadius: 8
                    }}>
                        <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
                            Intervention :
                            <strong style={{ color: '#FF8C00', marginLeft: 8 }}>
                                {interventionSelectionnee.numero}
                            </strong>
                            {' — '}
                            {interventionSelectionnee.client_nom}
                        </p>
                    </div>
                )}

                <Form form={formNotes} layout="vertical" onFinish={sauvegarderNotes}>
                    <Form.Item
                        label={<span style={{ fontWeight: 600 }}>Notes techniques</span>}
                        name="notes_technicien"
                        rules={[{ required: true, message: 'Notes obligatoires' }]}
                    >
                        <Input.TextArea
                            rows={6}
                            placeholder={
                                "Décrivez :\n" +
                                "- Ce que vous avez observé\n" +
                                "- Les actions effectuées\n" +
                                "- Les résultats obtenus\n" +
                                "- Les recommandations"
                            }
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item
                        label={<span style={{ fontWeight: 600 }}>Durée réelle (heures)</span>}
                        name="duree_reelle"
                    >
                        <InputNumber
                            min={0}
                            step={0.5}
                            placeholder="Ex: 2.5"
                            style={{ borderRadius: 8, width: 150 }}
                        />
                    </Form.Item>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => { setModalNotes(false); formNotes.resetFields(); }}>
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={savingNotes}
                            style={{
                                background: '#1890ff',
                                borderColor: '#1890ff',
                                borderRadius: 8,
                                fontWeight: 600
                            }}
                        >
                            Sauvegarder
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL PIÈCES UTILISÉES ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        🔧 Pièces utilisées —
                        <span style={{ color: '#FF8C00', marginLeft: 8 }}>
                            {interventionSelectionnee?.numero}
                        </span>
                    </span>
                }
                open={modalPieces}
                onCancel={() => {
                    setModalPieces(false);
                    formPiece.resetFields();
                    setPiecesUtilisees([]);
                }}
                footer={null}
                width={620}
            >
                <Card
                    size="small"
                    title={
                        <span style={{ fontWeight: 600, color: '#FF8C00' }}>
                            <PlusOutlined /> Ajouter une pièce
                        </span>
                    }
                    style={{ borderRadius: 8, marginBottom: 16 }}
                >
                    <Form form={formPiece} layout="inline" onFinish={ajouterPiece}>
                        <Form.Item
                            name="piece_id"
                            rules={[{ required: true, message: 'Choisir' }]}
                            style={{ flex: 2 }}
                        >
                            <Select
                                placeholder="Choisir une pièce"
                                showSearch
                                filterOption={(input, option) =>
                                    option.children
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                style={{ minWidth: 250 }}
                            >
                                {pieces.map(p => (
                                    <Option key={p.id} value={p.id}>
                                        {p.nom} — Stock: {p.quantite_stock} — {p.prix_unitaire} MAD
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="quantite"
                            rules={[{ required: true, message: 'Qté' }]}
                        >
                            <InputNumber
                                min={1}
                                placeholder="Qté"
                                style={{ width: 80, borderRadius: 8 }}
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<PlusOutlined />}
                                style={{
                                    background: '#FF8C00',
                                    borderColor: '#FF8C00',
                                    borderRadius: 8
                                }}
                            >
                                Ajouter
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    Pièces ajoutées :
                </div>

                {piecesUtilisees.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#ccc' }}>
                        Aucune pièce ajoutée
                    </div>
                ) : (
                    <List
                        dataSource={piecesUtilisees}
                        renderItem={(item) => (
                            <List.Item
                                style={{
                                    padding: '10px 12px',
                                    background: '#f8f9fa',
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    border: 'none'
                                }}
                                actions={[
                                    <Popconfirm
                                        title="Retirer cette pièce ?"
                                        onConfirm={() => supprimerPieceUtilisee(item.id)}
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
                                ]}
                            >
                                <List.Item.Meta
                                    title={
                                        <span style={{ fontWeight: 600 }}>
                                            {item.piece_nom}
                                        </span>
                                    }
                                    description={
                                        <span style={{ fontSize: 12, color: '#666' }}>
                                            Qté: {item.quantite} × {item.prix_unitaire} MAD
                                        </span>
                                    }
                                />
                                <span style={{ color: '#FF8C00', fontWeight: 700 }}>
                                    {item.sous_total} MAD
                                </span>
                            </List.Item>
                        )}
                    />
                )}

                {piecesUtilisees.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        padding: '12px 0 0',
                        borderTop: '2px solid #FF8C00',
                        marginTop: 8
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: '#FF8C00' }}>
                            Total :{' '}
                            {piecesUtilisees.reduce(
                                (sum, p) => sum + parseFloat(p.sous_total || 0), 0
                            ).toFixed(2)} MAD
                        </span>
                    </div>
                )}
            </Modal>

            {/* ─── DRAWER RAPPORT IA ─── */}
            <Drawer
                title={
                    <span style={{ fontWeight: 700 }}>
                        📄 Rapport —
                        <span style={{ color: '#FF8C00', marginLeft: 8 }}>
                            {interventionSelectionnee?.numero}
                        </span>
                    </span>
                }
                open={drawerRapport}
                onClose={() => {
                    setDrawerRapport(false);
                    setRapport(null);
                    formRapport.resetFields();
                }}
                width={620}
                extra={
                    rapport?.valide ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                            Validé
                        </Tag>
                    ) : null
                }
            >
                {!interventionSelectionnee?.notes_technicien && (
                    <Alert
                        message="Notes manquantes"
                        description="Saisissez d'abord vos notes techniques avant de générer un rapport."
                        type="warning"
                        showIcon
                        style={{ borderRadius: 8, marginBottom: 16 }}
                    />
                )}

                {!rapport && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <RobotOutlined style={{
                            fontSize: 48, color: '#FF8C00',
                            marginBottom: 16, display: 'block'
                        }} />
                        <p style={{ color: '#666', marginBottom: 20 }}>
                            Générez un rapport professionnel basé sur vos notes techniques
                        </p>
                        <Button
                            type="primary"
                            size="large"
                            icon={<RobotOutlined />}
                            loading={loadingRapport}
                            disabled={!interventionSelectionnee?.notes_technicien}
                            onClick={() => genererRapport(interventionSelectionnee?.id)}
                            style={{
                                background: '#FF8C00',
                                borderColor: '#FF8C00',
                                borderRadius: 10,
                                fontWeight: 600,
                                height: 48
                            }}
                        >
                            Générer avec IA
                        </Button>
                    </div>
                )}

                {rapport && !rapport.valide && (
                    <div>
                        {rapport.genere_par_ia && (
                            <Alert
                                message="Rapport généré par IA"
                                description="Vérifiez et modifiez si nécessaire avant de valider."
                                type="info"
                                showIcon
                                style={{ borderRadius: 8, marginBottom: 16 }}
                            />
                        )}
                        <Form form={formRapport} layout="vertical" onFinish={modifierRapport}>
                            <Form.Item
                                label={<span style={{ fontWeight: 600 }}>Contenu du rapport</span>}
                                name="contenu"
                            >
                                <Input.TextArea
                                    rows={14}
                                    style={{
                                        borderRadius: 8,
                                        fontFamily: 'monospace',
                                        fontSize: 13
                                    }}
                                />
                            </Form.Item>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <Button
                                    onClick={() => genererRapport(interventionSelectionnee?.id)}
                                    loading={loadingRapport}
                                    icon={<RobotOutlined />}
                                >
                                    Regénérer
                                </Button>
                                <Button
                                    htmlType="submit"
                                    icon={<EditOutlined />}
                                    style={{ borderRadius: 8 }}
                                >
                                    Sauvegarder
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<CheckCircleOutlined />}
                                    onClick={validerRapport}
                                    style={{
                                        background: '#52c41a',
                                        borderColor: '#52c41a',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        marginLeft: 'auto'
                                    }}
                                >
                                    Valider le rapport
                                </Button>
                            </div>
                        </Form>
                    </div>
                )}

                {rapport?.valide && (
                    <div>
                        <Alert
                            message="Rapport validé ✅"
                            description="Ce rapport a été validé et soumis au responsable."
                            type="success"
                            showIcon
                            style={{ borderRadius: 8, marginBottom: 16 }}
                        />
                        <div style={{
                            padding: 16,
                            background: '#f8f9fa',
                            borderRadius: 8,
                            fontFamily: 'monospace',
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6
                        }}>
                            {rapport.contenu}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={<span style={{ fontWeight: 700 }}>Détail intervention</span>}
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={480}
            >
                {interventionSelectionnee && (
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Numéro">
                            <span style={{ color: '#FF8C00', fontWeight: 700 }}>
                                {interventionSelectionnee.numero}
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Client">
                            {interventionSelectionnee.client_nom}
                        </Descriptions.Item>
                        <Descriptions.Item label="Appareil">
                            {interventionSelectionnee.appareil_info || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Type">
                            {typesService[interventionSelectionnee.type_service]}
                        </Descriptions.Item>
                        <Descriptions.Item label="Statut">
                            <Tag color={couleurStatut[interventionSelectionnee.statut]}>
                                {interventionSelectionnee.statut?.toUpperCase()}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Urgence">
                            {interventionSelectionnee.urgence?.toUpperCase()}
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
                            {interventionSelectionnee.notes_technicien || (
                                <span style={{ color: '#ccc' }}>Aucune note</span>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Durée réelle">
                            {interventionSelectionnee.duree_reelle
                                ? `${interventionSelectionnee.duree_reelle}h`
                                : <span style={{ color: '#ccc' }}>N/A</span>}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Drawer>
        </div>
    );
};

export default MesInterventions;