import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Space, message,
    Modal, Form, Input, Drawer, Descriptions,
    Divider, Spin, Alert, Tooltip
} from 'antd';
import {
    EyeOutlined, SwapOutlined, EditOutlined,
    FileTextOutlined, CheckCircleOutlined,
    ReloadOutlined, RobotOutlined
} from '@ant-design/icons';
import api from '../services/api';

const MesInterventions = () => {
    const [interventions, setInterventions] =
        useState([]);
    const [loading, setLoading] = useState(true);
    const [modalStatut, setModalStatut] =
        useState(false);
    const [modalNotes, setModalNotes] =
        useState(false);
    const [drawerDetail, setDrawerDetail] =
        useState(false);
    const [drawerRapport, setDrawerRapport] =
        useState(false);
    const [interventionSelectionnee,
           setInterventionSelectionnee] =
        useState(null);
    const [rapport, setRapport] = useState(null);
    const [transitions, setTransitions] = useState([]);
    const [loadingRapport, setLoadingRapport] =
        useState(false);
    const [formStatut] = Form.useForm();
    const [formNotes] = Form.useForm();
    const [formRapport] = Form.useForm();

    useEffect(() => {
        chargerInterventions();
    }, []);

    // ─── CHARGER MES INTERVENTIONS ───
    const chargerInterventions = async () => {
        setLoading(true);
        try {
            const res = await api.get(
                '/interventions/');
            setInterventions(res.data);
        } catch (error) {
            message.error('Erreur chargement');
        } finally {
            setLoading(false);
        }
    };

    // ─── CHARGER TRANSITIONS ───
    const chargerTransitions = async (id) => {
        try {
            const res = await api.get(
                `/interventions/${id}/transitions/`);
            setTransitions(
                res.data.transitions_possibles);
        } catch (error) {}
    };

    // ─── CHANGER STATUT ───
    const changerStatut = async (values) => {
        try {
            await api.post(
                `/interventions/`+
                `${interventionSelectionnee.id}`+
                `/changer-statut/`,
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
        try {
            await api.patch(
                `/interventions/`+
                `${interventionSelectionnee.id}/`,
                {
                    notes_technicien:
                        values.notes_technicien,
                    duree_reelle: values.duree_reelle
                }
            );
            message.success('Notes sauvegardées !');
            setModalNotes(false);
            formNotes.resetFields();
            chargerInterventions();
        } catch (error) {
            message.error('Erreur sauvegarde notes');
        }
    };

    // ─── GÉNÉRER RAPPORT IA ───
    const genererRapport = async (id) => {
        setLoadingRapport(true);
        try {
            const res = await api.post(
                `/interventions/${id}/generer-rapport/`
            );
            setRapport(res.data);
            formRapport.setFieldsValue({
                contenu: res.data.contenu
            });
            message.success('Rapport généré !');
        } catch (error) {
            message.error(
                error.response?.data?.erreur ||
                'Erreur génération rapport'
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
            setRapport({
                ...rapport,
                contenu: values.contenu
            });
        } catch (error) {
            message.error('Erreur modification');
        }
    };

    // ─── VALIDER RAPPORT ───
    const validerRapport = async () => {
        try {
            await api.post(
                `/rapports/${rapport.rapport_id}`+
                `/valider/`
            );
            message.success('Rapport validé !');
            setDrawerRapport(false);
            setRapport(null);
            chargerInterventions();
        } catch (error) {
            message.error('Erreur validation');
        }
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
            notes_technicien:
                intervention.notes_technicien || '',
            duree_reelle:
                intervention.duree_reelle || ''
        });
        setModalNotes(true);
    };

    // ─── OUVRIR DRAWER RAPPORT ───
    const ouvrirDrawerRapport = async (
            intervention) => {
        setInterventionSelectionnee(intervention);
        setRapport(null);
        setDrawerRapport(true);

        // Charger le rapport existant si disponible
        try {
            const res = await api.get(
                `/interventions/${intervention.id}/`);
            if (res.data.rapport) {
                setRapport({
                    rapport_id: res.data.rapport.id,
                    contenu: res.data.rapport.contenu,
                    genere_par_ia:
                        res.data.rapport.genere_par_ia,
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
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => (
                <Tag
                    color={couleurStatut[statut]}
                    style={{ borderRadius: 6 }}
                >
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Date planifiée',
            dataIndex: 'date_planifiee',
            render: (date) => date ? (
                <span style={{
                    color: '#1890ff',
                    fontWeight: 500
                }}>
                    {new Date(date)
                        .toLocaleDateString('fr-FR')}
                </span>
            ) : (
                <span style={{ color: '#ccc' }}>
                    Non planifiée
                </span>
            )
        },
        {
            title: 'Actions',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir détail">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            style={{ color: '#FF8C00' }}
                            onClick={() => {
                                setInterventionSelectionnee(
                                    record);
                                setDrawerDetail(true);
                            }}
                        />
                    </Tooltip>

                    <Tooltip title="Changer statut">
                        <Button
                            type="text"
                            icon={<SwapOutlined />}
                            style={{ color: '#722ed1' }}
                            onClick={() =>
                                ouvrirModalStatut(record)}
                        />
                    </Tooltip>

                    <Tooltip title="Saisir notes">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() =>
                                ouvrirModalNotes(record)}
                        />
                    </Tooltip>

                    <Tooltip title="Rapport IA">
                        <Button
                            type="text"
                            icon={<FileTextOutlined />}
                            style={{ color: '#52c41a' }}
                            onClick={() =>
                                ouvrirDrawerRapport(
                                    record)}
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
                        fontSize: 24,
                        fontWeight: 700,
                        color: '#1A1A1A',
                        margin: 0
                    }}>
                        Mes Interventions
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: '4px 0 0',
                        fontSize: 14
                    }}>
                        {interventions.length}
                        intervention(s) assignée(s)
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
                style={{
                    borderRadius: 16,
                    boxShadow:
                        '0 2px 12px rgba(0,0,0,0.06)'
                }}
            >
                <Table
                    columns={colonnes}
                    dataSource={interventions}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) =>
                            `${total} interventions`
                    }}
                />
            </Card>

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
                            Intervention :
                            <strong style={{
                                color: '#FF8C00',
                                marginLeft: 8
                            }}>
                                {interventionSelectionnee
                                    .numero}
                            </strong>
                        </p>
                        <p style={{ color: '#666' }}>
                            Statut actuel :
                            <Tag
                                color={couleurStatut[
                                    interventionSelectionnee
                                        .statut]}
                                style={{ marginLeft: 8 }}
                            >
                                {interventionSelectionnee
                                    .statut?.toUpperCase()}
                            </Tag>
                        </p>
                    </div>
                )}

                <Form
                    form={formStatut}
                    layout="vertical"
                    onFinish={changerStatut}
                >
                    <Form.Item
                        label="Nouveau statut"
                        name="statut"
                        rules={[{
                            required: true,
                            message: 'Choisissez un statut'
                        }]}
                    >
                        <select
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1px solid #d9d9d9',
                                fontSize: 14
                            }}
                        >
                            <option value="">
                                Choisir...
                            </option>
                            {transitions.map(t => (
                                <option key={t}
                                        value={t}>
                                    {t.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </Form.Item>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12
                    }}>
                        <Button onClick={() => {
                            setModalStatut(false);
                            formStatut.resetFields();
                        }}>
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

            {/* ─── MODAL NOTES TECHNIQUES ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        📝 Notes techniques
                    </span>
                }
                open={modalNotes}
                onCancel={() => {
                    setModalNotes(false);
                    formNotes.resetFields();
                }}
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
                        <p style={{
                            margin: 0,
                            color: '#666',
                            fontSize: 13
                        }}>
                            Intervention :
                            <strong style={{
                                color: '#FF8C00',
                                marginLeft: 8
                            }}>
                                {interventionSelectionnee
                                    .numero}
                            </strong>
                            {' — '}
                            {interventionSelectionnee
                                .client_nom}
                        </p>
                    </div>
                )}

                <Form
                    form={formNotes}
                    layout="vertical"
                    onFinish={sauvegarderNotes}
                >
                    <Form.Item
                        label={
                            <span style={{
                                fontWeight: 600
                            }}>
                                Notes techniques
                            </span>
                        }
                        name="notes_technicien"
                        rules={[{
                            required: true,
                            message: 'Notes obligatoires'
                        }]}
                    >
                        <Input.TextArea
                            rows={6}
                            placeholder={
                                "Décrivez en détail :\n" +
                                "- Ce que vous avez observé\n" +
                                "- Les actions effectuées\n" +
                                "- Les résultats obtenus\n" +
                                "- Les recommandations"
                            }
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item
                        label={
                            <span style={{
                                fontWeight: 600
                            }}>
                                Durée réelle (heures)
                            </span>
                        }
                        name="duree_reelle"
                    >
                        <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="Ex: 2.5"
                            style={{
                                borderRadius: 8,
                                width: 150
                            }}
                        />
                    </Form.Item>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12
                    }}>
                        <Button onClick={() => {
                            setModalNotes(false);
                            formNotes.resetFields();
                        }}>
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
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

            {/* ─── DRAWER RAPPORT IA ─── */}
            <Drawer
                title={
                    <span style={{ fontWeight: 700 }}>
                        📄 Rapport d'intervention —
                        <span style={{
                            color: '#FF8C00',
                            marginLeft: 8
                        }}>
                            {interventionSelectionnee
                                ?.numero}
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
                        <Tag color="success"
                             icon={
                                 <CheckCircleOutlined />
                             }>
                            Validé
                        </Tag>
                    ) : null
                }
            >
                {/* Étape 1 — Vérifier les notes */}
                {!interventionSelectionnee
                    ?.notes_technicien && (
                    <Alert
                        message="Notes manquantes"
                        description="Vous devez d'abord saisir vos notes techniques avant de générer le rapport."
                        type="warning"
                        showIcon
                        style={{
                            borderRadius: 8,
                            marginBottom: 16
                        }}
                    />
                )}

                {/* Étape 2 — Bouton générer */}
                {!rapport && (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 0'
                    }}>
                        <RobotOutlined style={{
                            fontSize: 48,
                            color: '#FF8C00',
                            marginBottom: 16,
                            display: 'block'
                        }} />
                        <p style={{
                            color: '#666',
                            marginBottom: 20
                        }}>
                            Générez automatiquement un
                            rapport professionnel basé
                            sur vos notes techniques
                        </p>
                        <Button
                            type="primary"
                            size="large"
                            icon={<RobotOutlined />}
                            loading={loadingRapport}
                            disabled={
                                !interventionSelectionnee
                                    ?.notes_technicien
                            }
                            onClick={() =>
                                genererRapport(
                                    interventionSelectionnee
                                        ?.id)
                            }
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

                {/* Étape 3 — Modifier le rapport */}
                {rapport && !rapport.valide && (
                    <div>
                        {rapport.genere_par_ia && (
                            <Alert
                                message="Rapport généré par IA"
                                description="Vérifiez et modifiez si nécessaire avant de valider."
                                type="info"
                                showIcon
                                style={{
                                    borderRadius: 8,
                                    marginBottom: 16
                                }}
                            />
                        )}

                        <Form
                            form={formRapport}
                            layout="vertical"
                            onFinish={modifierRapport}
                        >
                            <Form.Item
                                label={
                                    <span style={{
                                        fontWeight: 600
                                    }}>
                                        Contenu du rapport
                                    </span>
                                }
                                name="contenu"
                            >
                                <Input.TextArea
                                    rows={14}
                                    style={{
                                        borderRadius: 8,
                                        fontFamily:
                                            'monospace',
                                        fontSize: 13
                                    }}
                                />
                            </Form.Item>

                            <div style={{
                                display: 'flex',
                                gap: 12,
                                marginTop: 8
                            }}>
                                <Button
                                    onClick={() =>
                                        genererRapport(
                                            interventionSelectionnee
                                                ?.id)
                                    }
                                    loading={
                                        loadingRapport
                                    }
                                    icon={
                                        <RobotOutlined />
                                    }
                                >
                                    Regénérer
                                </Button>

                                <Button
                                    type="default"
                                    htmlType="submit"
                                    icon={
                                        <EditOutlined />
                                    }
                                    style={{
                                        borderRadius: 8
                                    }}
                                >
                                    Sauvegarder
                                </Button>

                                <Button
                                    type="primary"
                                    icon={
                                        <CheckCircleOutlined />
                                    }
                                    onClick={
                                        validerRapport
                                    }
                                    style={{
                                        background:
                                            '#52c41a',
                                        borderColor:
                                            '#52c41a',
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

                {/* Rapport validé */}
                {rapport?.valide && (
                    <div>
                        <Alert
                            message="Rapport validé ✅"
                            description="Ce rapport a été validé et soumis au responsable."
                            type="success"
                            showIcon
                            style={{
                                borderRadius: 8,
                                marginBottom: 16
                            }}
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
                title={
                    <span style={{ fontWeight: 700 }}>
                        Détail intervention
                    </span>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={480}
            >
                {interventionSelectionnee && (
                    <Descriptions
                        column={1}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item
                            label="Numéro">
                            <span style={{
                                color: '#FF8C00',
                                fontWeight: 700
                            }}>
                                {interventionSelectionnee
                                    .numero}
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Client">
                            {interventionSelectionnee
                                .client_nom}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Appareil">
                            {interventionSelectionnee
                                .appareil_info || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Type">
                            {typesService[
                                interventionSelectionnee
                                    .type_service]}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Statut">
                            <Tag color={couleurStatut[
                                interventionSelectionnee
                                    .statut]}>
                                {interventionSelectionnee
                                    .statut?.toUpperCase()}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Urgence">
                            {interventionSelectionnee
                                .urgence?.toUpperCase()}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Date planifiée">
                            {interventionSelectionnee
                                .date_planifiee ?
                                new Date(
                                    interventionSelectionnee
                                        .date_planifiee)
                                    .toLocaleDateString(
                                        'fr-FR') :
                                'Non planifiée'}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Durée estimée">
                            {interventionSelectionnee
                                .duree_estimee ?
                                `${interventionSelectionnee
                                    .duree_estimee}h` :
                                'N/A'}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Drawer>
        </div>
    );
};

export default MesInterventions;