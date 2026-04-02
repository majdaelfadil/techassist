import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Input, Select,
    Space, Modal, Form, message, Tooltip,
    Popconfirm, Switch, Avatar, Descriptions,
    Drawer, InputNumber
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined,
    EditOutlined, DeleteOutlined, ReloadOutlined,
    UserOutlined, CheckCircleOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

const Techniciens = () => {
    const [techniciens, setTechniciens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreDisponible, setFiltreDisponible] =
        useState('');
    const [filtreSpecialite, setFiltreSpecialite] =
        useState('');
    const [modalCreer, setModalCreer] = useState(false);
    const [modalModifier, setModalModifier] = useState(false);
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [technicienSelectionne, setTechnicienSelectionne] =
        useState(null);
    const [form] = Form.useForm();
    const [formModifier] = Form.useForm();

    useEffect(() => {
        chargerTechniciens();
    }, [filtreDisponible, filtreSpecialite]);

    // ─── CHARGER TECHNICIENS ───
    const chargerTechniciens = async () => {
        setLoading(true);
        try {
            let url = '/techniciens/?';
            if (filtreDisponible !== '')
                url += `disponible=${filtreDisponible}&`;
            const res = await api.get(url);
            setTechniciens(res.data);
        } catch (error) {
            message.error('Erreur chargement techniciens');
        } finally {
            setLoading(false);
        }
    };

    // ─── CRÉER TECHNICIEN ───
    const creerTechnicien = async (values) => {
        try {
            await api.post('/techniciens/', values);
            message.success('Technicien créé !');
            setModalCreer(false);
            form.resetFields();
            chargerTechniciens();
        } catch (error) {
            message.error('Erreur création');
        }
    };

    // ─── MODIFIER TECHNICIEN ───
    const modifierTechnicien = async (values) => {
        try {
            await api.patch(
                `/techniciens/${technicienSelectionne.id}/`,
                values
            );
            message.success('Technicien modifié !');
            setModalModifier(false);
            chargerTechniciens();
        } catch (error) {
            message.error('Erreur modification');
        }
    };

    // ─── SUPPRIMER TECHNICIEN ───
    const supprimerTechnicien = async (id) => {
        try {
            await api.delete(`/techniciens/${id}/`);
            message.success('Technicien supprimé !');
            chargerTechniciens();
        } catch (error) {
            message.error('Erreur suppression');
        }
    };

    // ─── OUVRIR MODIFIER ───
    const ouvrirModifier = (technicien) => {
        setTechnicienSelectionne(technicien);
        formModifier.setFieldsValue(technicien);
        setModalModifier(true);
    };

    // ─── OUVRIR DÉTAIL ───
    const ouvrirDetail = (technicien) => {
        setTechnicienSelectionne(technicien);
        setDrawerDetail(true);
    };

    // ─── FILTRAGE LOCAL ───
    const techniciensFiltres = techniciens.filter(t =>
        t.nom?.toLowerCase().includes(
            search.toLowerCase()) ||
        t.specialite?.toLowerCase().includes(
            search.toLowerCase()) ||
        t.telephone?.includes(search)
    );

    const specialites = [
        { key: 'hardware', label: 'Hardware' },
        { key: 'software', label: 'Software' },
        { key: 'reseau', label: 'Réseau' },
        { key: 'maintenance', label: 'Maintenance' },
    ];

    const couleurSpecialite = {
        'hardware':    '#FF8C00',
        'software':    '#1890ff',
        'reseau':      '#52c41a',
        'maintenance': '#722ed1',
    };

    // ─── FORMULAIRE TECHNICIEN ───
    const FormulaireTechnicien = ({ form, onFinish }) => (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            style={{ marginTop: 16 }}
        >
            <Space style={{ width: '100%' }} size={12}>
                <Form.Item
                    label="Nom complet"
                    name="nom"
                    rules={[{
                        required: true,
                        message: 'Nom obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <Input
                        placeholder="Ahmed Alami"
                        prefix={<UserOutlined
                            style={{ color: '#ccc' }} />}
                        style={{ borderRadius: 8 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Téléphone"
                    name="telephone"
                    style={{ flex: 1 }}
                >
                    <Input
                        placeholder="0612345678"
                        style={{ borderRadius: 8 }}
                    />
                </Form.Item>
            </Space>

            <Space style={{ width: '100%' }} size={12}>
                <Form.Item
                    label="Spécialité"
                    name="specialite"
                    rules={[{
                        required: true,
                        message: 'Spécialité obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <Select placeholder="Choisir spécialité">
                        {specialites.map(s => (
                            <Option key={s.key}
                                    value={s.key}>
                                <Tag color={
                                    couleurSpecialite[s.key]}>
                                    {s.label}
                                </Tag>
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    label="Tarif horaire (MAD)"
                    name="tarif_horaire"
                    rules={[{
                        required: true,
                        message: 'Tarif obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <InputNumber
                        min={0}
                        placeholder="150"
                        style={{
                            width: '100%',
                            borderRadius: 8
                        }}
                        addonAfter="MAD/h"
                    />
                </Form.Item>
            </Space>

            <Form.Item
                label="Compétences"
                name="competences"
            >
                <Input.TextArea
                    rows={3}
                    placeholder="Ex: Réparation PC, Installation Windows, Configuration réseau..."
                    style={{ borderRadius: 8 }}
                />
            </Form.Item>

            <Form.Item
                label="Disponible"
                name="disponible"
                valuePropName="checked"
                initialValue={true}
            >
                <Switch
                    checkedChildren="Disponible"
                    unCheckedChildren="Indisponible"
                    style={{ background: '#FF8C00' }}
                />
            </Form.Item>

            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 8
            }}>
                <Button style={{ borderRadius: 8 }}
                        onClick={() => {
                            setModalCreer(false);
                            setModalModifier(false);
                            form.resetFields();
                        }}>
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
                    Enregistrer
                </Button>
            </div>
        </Form>
    );

    // ─── COLONNES ───
    const colonnes = [
        {
            title: 'Technicien',
            dataIndex: 'nom',
            render: (nom) => (
                <Space>
                    <Avatar
                        style={{
                            background: '#FF8C00',
                            fontSize: 14
                        }}
                    >
                        {nom?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <span style={{ fontWeight: 600 }}>
                        {nom}
                    </span>
                </Space>
            )
        },
        {
            title: 'Spécialité',
            dataIndex: 'specialite',
            render: (s) => (
                <Tag color={couleurSpecialite[s]}
                     style={{ borderRadius: 6 }}>
                    {s?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Téléphone',
            dataIndex: 'telephone',
            render: (tel) => tel || (
                <span style={{ color: '#ccc' }}>N/A</span>
            )
        },
        {
            title: 'Tarif/heure',
            dataIndex: 'tarif_horaire',
            render: (tarif) => (
                <span style={{
                    color: '#FF8C00',
                    fontWeight: 700
                }}>
                    {tarif} MAD
                </span>
            )
        },
        {
            title: 'Compétences',
            dataIndex: 'competences',
            render: (comp) => comp ? (
                <span style={{
                    color: '#666',
                    fontSize: 12
                }}>
                    {comp.length > 40 ?
                        comp.substring(0, 40) + '...' :
                        comp}
                </span>
            ) : (
                <span style={{ color: '#ccc' }}>
                    Non renseigné
                </span>
            )
        },
        {
            title: 'Disponibilité',
            dataIndex: 'disponible',
            render: (dispo) => dispo ? (
                <Space>
                    <CheckCircleOutlined
                        style={{ color: '#52c41a' }} />
                    <span style={{
                        color: '#52c41a',
                        fontWeight: 600
                    }}>
                        Disponible
                    </span>
                </Space>
            ) : (
                <Space>
                    <CloseCircleOutlined
                        style={{ color: '#f5222d' }} />
                    <span style={{
                        color: '#f5222d',
                        fontWeight: 600
                    }}>
                        Indisponible
                    </span>
                </Space>
            )
        },
        {
            title: 'Actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir détail">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            style={{ color: '#FF8C00' }}
                            onClick={() =>
                                ouvrirDetail(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Modifier">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() =>
                                ouvrirModifier(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Supprimer">
                        <Popconfirm
                            title="Supprimer ce technicien ?"
                            onConfirm={() =>
                                supprimerTechnicien(
                                    record.id)}
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
                    <h1 style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: '#1A1A1A',
                        margin: 0
                    }}>
                        Techniciens
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: '4px 0 0',
                        fontSize: 14
                    }}>
                        {techniciensFiltres.length} technicien(s)
                    </p>
                </div>

                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={chargerTechniciens}
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
                        Nouveau technicien
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
                        prefix={<SearchOutlined
                            style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par nom, spécialité ou téléphone..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)}
                        allowClear
                        style={{
                            width: 340,
                            borderRadius: 8
                        }}
                    />

                    <Select
                        placeholder="Spécialité"
                        allowClear
                        style={{ width: 160 }}
                        onChange={setFiltreSpecialite}
                    >
                        {specialites.map(s => (
                            <Option key={s.key}
                                    value={s.key}>
                                {s.label}
                            </Option>
                        ))}
                    </Select>

                    <Select
                        placeholder="Disponibilité"
                        allowClear
                        style={{ width: 160 }}
                        onChange={setFiltreDisponible}
                    >
                        <Option value="true">
                            ✅ Disponible
                        </Option>
                        <Option value="false">
                            ❌ Indisponible
                        </Option>
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
                    dataSource={techniciensFiltres}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) =>
                            `${total} techniciens`
                    }}
                />
            </Card>

            {/* ─── MODAL CRÉER ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        ➕ Nouveau technicien
                    </span>
                }
                open={modalCreer}
                onCancel={() => {
                    setModalCreer(false);
                    form.resetFields();
                }}
                footer={null}
                width={560}
            >
                <FormulaireTechnicien
                    form={form}
                    onFinish={creerTechnicien}
                />
            </Modal>

            {/* ─── MODAL MODIFIER ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        ✏️ Modifier technicien
                    </span>
                }
                open={modalModifier}
                onCancel={() => {
                    setModalModifier(false);
                    formModifier.resetFields();
                }}
                footer={null}
                width={560}
            >
                <FormulaireTechnicien
                    form={formModifier}
                    onFinish={modifierTechnicien}
                />
            </Modal>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <Space>
                        <Avatar style={{
                            background: '#FF8C00'
                        }}>
                            {technicienSelectionne?.nom
                                ?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <span style={{ fontWeight: 700 }}>
                            {technicienSelectionne?.nom}
                        </span>
                    </Space>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={420}
            >
                {technicienSelectionne && (
                    <Descriptions
                        column={1}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label="Nom">
                            {technicienSelectionne.nom}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Spécialité">
                            <Tag color={couleurSpecialite[
                                technicienSelectionne
                                    .specialite]}>
                                {technicienSelectionne
                                    .specialite?.toUpperCase()}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Téléphone">
                            {technicienSelectionne.telephone
                                || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Tarif horaire">
                            <span style={{
                                color: '#FF8C00',
                                fontWeight: 700
                            }}>
                                {technicienSelectionne
                                    .tarif_horaire} MAD/h
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Compétences">
                            {technicienSelectionne
                                .competences ||
                                'Non renseigné'}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Disponibilité">
                            {technicienSelectionne.disponible
                                ? '✅ Disponible'
                                : '❌ Indisponible'}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Drawer>
        </div>
    );
};

export default Techniciens;