import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Space, message,
    Modal, Form, Input, Drawer, Descriptions,
    Divider, Alert, Tooltip, Select,
    InputNumber, List, Popconfirm, Upload,
    Badge, Spin
} from 'antd';
import {
    EyeOutlined, SwapOutlined, EditOutlined,
    FileTextOutlined, CheckCircleOutlined,
    ReloadOutlined, RobotOutlined,
    PlusOutlined, DeleteOutlined,
    AppstoreOutlined, SaveOutlined,
    ClockCircleOutlined, CameraOutlined,
    PictureOutlined, UploadOutlined,
    CheckOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;

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
    const [savingRapport, setSavingRapport] = useState(false);
    const [pieces, setPieces] = useState([]);
    const [piecesUtilisees, setPiecesUtilisees] = useState([]);
    const [savingNotes, setSavingNotes] = useState(false);
    const [formStatut] = Form.useForm();
    const [formNotes] = Form.useForm();
    const [formRapport] = Form.useForm();
    const [formPiece] = Form.useForm();

    // États pour l'upload d'image
    const [modalAjoutImage, setModalAjoutImage] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imageType, setImageType] = useState('autre');
    const [imageDescription, setImageDescription] = useState('');
    const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imagesList, setImagesList] = useState([]);
    const [loadingImages, setLoadingImages] = useState(false);

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

    // ─── CHARGER IMAGES ───
    const chargerImages = async (interventionId) => {
        setLoadingImages(true);
        try {
            const res = await api.get(`/interventions/${interventionId}/images/`);
            setImagesList(res.data.images || []);
        } catch (error) {
            console.error('Erreur chargement images:', error);
        } finally {
            setLoadingImages(false);
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
            if (values.duree_reelle !== undefined &&
                values.duree_reelle !== null &&
                values.duree_reelle !== '') {
                payload.duree_reelle = values.duree_reelle;
            }

            await api.patch(
                `/interventions/${interventionSelectionnee.id}/`,
                payload
            );

            const res = await api.get(
                `/interventions/${interventionSelectionnee.id}/`
            );

            const interventionMiseAJour = {
                ...interventionSelectionnee,
                notes_technicien: res.data.notes_technicien,
                duree_reelle: res.data.duree_reelle
            };

            setInterventionSelectionnee(interventionMiseAJour);
            setInterventions(prev =>
                prev.map(i =>
                    i.id === interventionSelectionnee.id
                        ? {
                            ...i,
                            notes_technicien: res.data.notes_technicien,
                            duree_reelle: res.data.duree_reelle
                          }
                        : i
                )
            );

            message.success('Notes sauvegardées !');
            setModalNotes(false);
            formNotes.resetFields();

        } catch (error) {
            const erreur = error.response?.data;
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
            message.success('Rapport généré avec succès !');
        } catch (error) {
            message.error(
                error.response?.data?.erreur || 'Erreur génération rapport'
            );
        } finally {
            setLoadingRapport(false);
        }
    };

    // ─── ENREGISTRER RAPPORT (technicien) ───
    const enregistrerRapport = async (values) => {
        setSavingRapport(true);
        try {
            const contenu = values?.contenu ||
                            formRapport.getFieldValue('contenu');

            await api.patch(
                `/rapports/${rapport.rapport_id}/`,
                { contenu: contenu }
            );

            message.success(
                'Rapport enregistré ! En attente de validation par le responsable.'
            );
            setDrawerRapport(false);
            setRapport(null);
            formRapport.resetFields();
            chargerInterventions();
        } catch (error) {
            message.error('Erreur enregistrement rapport');
        } finally {
            setSavingRapport(false);
        }
    };

    // ─── AJOUTER IMAGE ───
    const handleSelectImage = (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
            message.error('Veuillez sélectionner une image');
            return false;
        }

        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
            message.error('L\'image doit faire moins de 5 Mo');
            return false;
        }

        setImageFile(file);
        const previewUrl = URL.createObjectURL(file);
        setImagePreviewUrl(previewUrl);
        return false;
    };

    const handleUploadImage = async () => {
        if (!imageFile) {
            message.warning('Veuillez sélectionner une image');
            return;
        }

        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('image', imageFile);
            formData.append('type_image', imageType);
            formData.append('description', imageDescription);

            await api.post(
                `/interventions/${interventionSelectionnee.id}/ajouter-image/`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            message.success('Image ajoutée avec succès !');
            resetImageModal();
            chargerImages(interventionSelectionnee.id);
        } catch (error) {
            message.error(error.response?.data?.erreur || 'Erreur lors de l\'upload');
        } finally {
            setUploadingImage(false);
        }
    };

    const resetImageModal = () => {
        setModalAjoutImage(false);
        setImageFile(null);
        setImagePreviewUrl(null);
        setImageType('autre');
        setImageDescription('');
    };

    const supprimerImage = async (imageId) => {
        try {
            await api.delete(`/images/${imageId}/supprimer/`);
            message.success('Image supprimée');
            chargerImages(interventionSelectionnee.id);
        } catch (error) {
            message.error('Erreur suppression');
        }
    };

    // ─── OUVRIR MODAL PIÈCES ───
    const ouvrirModalPieces = async (intervention) => {
        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            const interventionFraiche = {
                ...intervention,
                notes_technicien: res.data.notes_technicien,
                duree_reelle: res.data.duree_reelle
            };
            setInterventionSelectionnee(interventionFraiche);
        } catch (error) {
            setInterventionSelectionnee(intervention);
        }
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
    const ouvrirModalNotes = async (intervention) => {
        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            const interventionFraiche = {
                ...intervention,
                notes_technicien: res.data.notes_technicien,
                duree_reelle: res.data.duree_reelle
            };
            setInterventionSelectionnee(interventionFraiche);
            formNotes.setFieldsValue({
                notes_technicien: res.data.notes_technicien || '',
                duree_reelle: res.data.duree_reelle || null
            });
        } catch (error) {
            setInterventionSelectionnee(intervention);
            formNotes.setFieldsValue({
                notes_technicien: intervention.notes_technicien || '',
                duree_reelle: intervention.duree_reelle || null
            });
        }
        setModalNotes(true);
    };

    // ─── OUVRIR DRAWER RAPPORT ───
    const ouvrirDrawerRapport = async (intervention) => {
        setDrawerRapport(true);
        setRapport(null);
        formRapport.resetFields();

        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            const interventionFraiche = {
                ...intervention,
                notes_technicien: res.data.notes_technicien,
                duree_reelle: res.data.duree_reelle
            };
            setInterventionSelectionnee(interventionFraiche);

            if (res.data.rapport) {
                setRapport({
                    rapport_id: res.data.rapport.id,
                    contenu: res.data.rapport.contenu,
                    genere_par_ia: res.data.rapport.genere_par_ia,
                    valide: res.data.rapport.valide,
                    date_validation: res.data.rapport.date_validation
                });
                formRapport.setFieldsValue({
                    contenu: res.data.rapport.contenu
                });
            }
        } catch (error) {
            setInterventionSelectionnee(intervention);
        }
    };

    // ─── OUVRIR MODAL AJOUT IMAGE ───
    const ouvrirModalAjoutImage = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerImages(intervention.id);
        setModalAjoutImage(true);
    };

    // Types d'images
    const typesImages = {
        'avant': { label: 'Avant intervention', color: '#1890ff' },
        'apres': { label: 'Après intervention', color: '#52c41a' },
        'panne': { label: 'Photo de la panne', color: '#f5222d' },
        'piece': { label: 'Pièce de rechange', color: '#fa8c16' },
        'document': { label: 'Document', color: '#722ed1' },
        'autre': { label: 'Autre', color: '#8c8c8c' },
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

    // ─── COLONNES AVEC BOUTON PHOTO ───
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
            width: 280,
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
                    {/* 🔵 BOUTON PHOTO DANS LES ACTIONS */}
                    <Tooltip title="Gérer les photos">
                        <Button
                            type="text"
                            icon={<CameraOutlined />}
                            style={{ color: '#1616fa' }}
                            onClick={() => ouvrirModalAjoutImage(record)}
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
                        rules={[{ required: true, message: 'Choisissez un statut' }]}
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
                width={640}
                extra={
                    rapport?.valide ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>
                            Validé par responsable
                        </Tag>
                    ) : rapport ? (
                        <Tag color="warning" icon={<ClockCircleOutlined />}>
                            En attente validation
                        </Tag>
                    ) : null
                }
            >
                {!interventionSelectionnee?.notes_technicien && (
                    <Alert
                        message="Notes techniques manquantes"
                        description="Vous devez d'abord saisir vos notes techniques avant de générer un rapport."
                        type="warning"
                        showIcon
                        style={{ borderRadius: 8, marginBottom: 16 }}
                    />
                )}

                {!rapport && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <RobotOutlined style={{
                            fontSize: 52, color: '#FF8C00',
                            marginBottom: 16, display: 'block'
                        }} />
                        <p style={{
                            color: '#666',
                            marginBottom: 8,
                            fontSize: 15,
                            fontWeight: 500
                        }}>
                            Générez un rapport professionnel
                        </p>
                        <p style={{ color: '#999', marginBottom: 24, fontSize: 13 }}>
                            Basé sur vos notes techniques via l'IA Groq
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
                                height: 48,
                                paddingLeft: 28,
                                paddingRight: 28
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
                                message="✨ Rapport généré par IA (Groq)"
                                description="Vérifiez et modifiez le contenu si nécessaire, puis enregistrez. Le responsable devra valider ce rapport."
                                type="info"
                                showIcon
                                style={{ borderRadius: 8, marginBottom: 16 }}
                            />
                        )}

                        <Form
                            form={formRapport}
                            layout="vertical"
                            onFinish={enregistrerRapport}
                        >
                            <Form.Item
                                label={
                                    <span style={{ fontWeight: 600 }}>
                                        Contenu du rapport
                                    </span>
                                }
                                name="contenu"
                            >
                                <Input.TextArea
                                    rows={15}
                                    style={{
                                        borderRadius: 8,
                                        fontFamily: 'monospace',
                                        fontSize: 13,
                                        lineHeight: 1.6
                                    }}
                                />
                            </Form.Item>

                            <div style={{
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                                flexWrap: 'wrap'
                            }}>
                                <Button
                                    onClick={() =>
                                        genererRapport(interventionSelectionnee?.id)
                                    }
                                    loading={loadingRapport}
                                    icon={<RobotOutlined />}
                                    style={{ borderRadius: 8 }}
                                >
                                    Regénérer
                                </Button>

                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    icon={<SaveOutlined />}
                                    loading={savingRapport}
                                    style={{
                                        background: '#FF8C00',
                                        borderColor: '#FF8C00',
                                        borderRadius: 8,
                                        fontWeight: 700,
                                        marginLeft: 'auto',
                                        height: 40,
                                        paddingLeft: 20,
                                        paddingRight: 20
                                    }}
                                >
                                    Enregistrer le rapport
                                </Button>
                            </div>
                        </Form>

                        <div style={{
                            marginTop: 16,
                            padding: '12px 16px',
                            background: '#fffbe6',
                            border: '1px solid #ffe58f',
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10
                        }}>
                            <ClockCircleOutlined style={{
                                color: '#faad14', fontSize: 16, marginTop: 2
                            }} />
                            <div>
                                <div style={{
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: '#664d00',
                                    marginBottom: 4
                                }}>
                                    En attente de validation
                                </div>
                                <div style={{ fontSize: 12, color: '#856404' }}>
                                    Après enregistrement, votre rapport sera visible
                                    dans <strong>Mes Rapports</strong> et soumis
                                    au responsable pour validation.
                                    Vous ne pouvez pas valider vous-même votre propre rapport.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {rapport?.valide && (
                    <div>
                        <Alert
                            message="✅ Rapport validé par le responsable"
                            description={
                                rapport.date_validation
                                    ? `Validé le ${new Date(rapport.date_validation)
                                        .toLocaleDateString('fr-FR', {
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
                            style={{ borderRadius: 8, marginBottom: 16 }}
                        />

                        <div style={{
                            padding: 20,
                            background: '#f8f9fa',
                            borderRadius: 10,
                            border: '1px solid #e8e8e8',
                            fontFamily: 'monospace',
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.8,
                            color: '#333'
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
                    <>
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
                    </>
                )}
            </Drawer>

            {/* ─── MODAL AJOUT IMAGE ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        <CameraOutlined style={{ marginRight: 8, color: '#FF8C00' }} />
                        Gérer les photos - {interventionSelectionnee?.numero}
                    </span>
                }
                open={modalAjoutImage}
                onCancel={resetImageModal}
                footer={null}
                width={600}
            >
                <div style={{ marginTop: 16 }}>
                    {/* Formulaire d'ajout */}
                    <Card size="small" title="Ajouter une photo" style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                                Type de photo
                            </label>
                            <Select
                                value={imageType}
                                onChange={setImageType}
                                style={{ width: '100%' }}
                            >
                                {Object.entries(typesImages).map(([k, v]) => (
                                    <Option key={k} value={k}>
                                        <Tag color={v.color} style={{ marginRight: 8 }}>{v.label}</Tag>
                                    </Option>
                                ))}
                            </Select>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                                Description <span style={{ color: '#999', fontWeight: 400 }}>(optionnel)</span>
                            </label>
                            <Input.TextArea
                                rows={2}
                                placeholder="Décrivez cette photo..."
                                value={imageDescription}
                                onChange={(e) => setImageDescription(e.target.value)}
                                style={{ borderRadius: 8 }}
                            />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 6 }}>
                                Photo
                            </label>
                            <Upload.Dragger
                                beforeUpload={handleSelectImage}
                                showUploadList={false}
                                accept="image/jpeg,image/jpg,image/png,image/webp"
                            >
                                {imagePreviewUrl ? (
                                    <div>
                                        <img 
                                            src={imagePreviewUrl} 
                                            alt="Aperçu" 
                                            style={{ maxHeight: 150, maxWidth: '100%', borderRadius: 8 }}
                                        />
                                        <div style={{ marginTop: 8, color: '#52c41a' }}>
                                            <CheckOutlined /> Image sélectionnée
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <UploadOutlined style={{ fontSize: 32, color: '#FF8C00' }} />
                                        <div style={{ marginTop: 8 }}>Cliquez ou glissez une photo</div>
                                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                            JPG, PNG, WEBP - Max 5 Mo
                                        </div>
                                    </div>
                                )}
                            </Upload.Dragger>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button onClick={resetImageModal}>Annuler</Button>
                            <Button
                                type="primary"
                                icon={<CameraOutlined />}
                                loading={uploadingImage}
                                disabled={!imageFile}
                                onClick={handleUploadImage}
                                style={{
                                    background: '#FF8C00',
                                    borderColor: '#FF8C00',
                                    borderRadius: 8,
                                    fontWeight: 600
                                }}
                            >
                                {uploadingImage ? 'Envoi...' : 'Ajouter'}
                            </Button>
                        </div>
                    </Card>

                    {/* Liste des photos existantes */}
                    <Divider>Photos existantes ({imagesList.length})</Divider>
                    
                    {loadingImages ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <Spin />
                        </div>
                    ) : imagesList.length === 0 ? (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '40px 20px',
                            background: '#fafafa',
                            borderRadius: 12
                        }}>
                            <CameraOutlined style={{ fontSize: 48, color: '#ccc' }} />
                            <div style={{ color: '#999', marginTop: 8 }}>Aucune photo</div>
                        </div>
                    ) : (
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(2, 1fr)', 
                            gap: 12,
                            maxHeight: 400,
                            overflowY: 'auto'
                        }}>
                            {imagesList.map((img) => (
                                <div
                                    key={img.id}
                                    style={{
                                        position: 'relative',
                                        borderRadius: 10,
                                        overflow: 'hidden',
                                        border: '1px solid #f0f0f0',
                                        background: '#f8f9fa'
                                    }}
                                >
                                    <img
                                        src={img.image_url}
                                        alt={img.description || img.type_image}
                                        style={{
                                            width: '100%',
                                            height: 120,
                                            objectFit: 'cover',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                            Modal.info({
                                                title: typesImages[img.type_image]?.label || img.type_image,
                                                content: (
                                                    <div>
                                                        <img 
                                                            src={img.image_url} 
                                                            alt={img.description}
                                                            style={{ width: '100%', borderRadius: 8 }}
                                                        />
                                                        {img.description && (
                                                            <p style={{ marginTop: 12, color: '#666' }}>
                                                                {img.description}
                                                            </p>
                                                        )}
                                                        <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                                                            Ajouté le {new Date(img.date_ajout).toLocaleDateString('fr-FR')}
                                                        </p>
                                                    </div>
                                                ),
                                                width: 500,
                                                okText: 'Fermer'
                                            });
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'rgba(0,0,0,0.6)',
                                        padding: '4px 8px',
                                        fontSize: 10,
                                        color: '#fff'
                                    }}>
                                        <Tag 
                                            color={typesImages[img.type_image]?.color || '#666'} 
                                            style={{ fontSize: 10, margin: 0 }}
                                        >
                                            {typesImages[img.type_image]?.label || img.type_image}
                                        </Tag>
                                    </div>
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        size="small"
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            background: 'rgba(255,255,255,0.9)',
                                            borderRadius: '50%'
                                        }}
                                        onClick={() => {
                                            Modal.confirm({
                                                title: 'Supprimer cette photo ?',
                                                content: 'Cette action est irréversible.',
                                                okText: 'Oui',
                                                cancelText: 'Non',
                                                okButtonProps: { danger: true },
                                                onOk: () => supprimerImage(img.id)
                                            });
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default MesInterventions;