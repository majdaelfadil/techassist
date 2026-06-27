import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Space, Modal, Form, Input,
    Select, InputNumber, message, Popconfirm, Switch,
    Row, Col, Statistic, Avatar, Tooltip
} from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
    UserOutlined, TeamOutlined, ToolOutlined, DollarOutlined,
    SettingOutlined, KeyOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

const ROLE_META = {
    admin:       { color: '#722ed1', label: 'Administrateur' },
    responsable: { color: '#FF8C00', label: 'Responsable' },
    agent:       { color: '#1890ff', label: 'Agent' },
    technicien:  { color: '#52c41a', label: 'Technicien' },
};

const SPECIALITES = [
    { value: 'hardware', label: 'Hardware' },
    { value: 'software', label: 'Software' },
    { value: 'reseau', label: 'Réseau' },
    { value: 'maintenance', label: 'Maintenance' },
];

export default function Administration() {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form] = Form.useForm();
    const roleValue = Form.useWatch('role', form);

    const charger = async () => {
        setLoading(true);
        try {
            const [u, s] = await Promise.all([
                api.get('/admin/utilisateurs/'),
                api.get('/admin/stats/'),
            ]);
            setUsers(u.data);
            setStats(s.data);
        } catch (e) {
            message.error("Accès refusé ou erreur de chargement");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { charger(); }, []);

    const ouvrirCreation = () => {
        setEditing(null);
        form.resetFields();
        form.setFieldsValue({ role: 'agent' });
        setModalOpen(true);
    };

    const ouvrirEdition = (u) => {
        setEditing(u);
        form.setFieldsValue({
            username: u.username, nom: u.nom, role: u.role,
            email: u.email, telephone: u.telephone,
            specialite: u.specialite || undefined, password: '',
        });
        setModalOpen(true);
    };

    const enregistrer = async () => {
        try {
            const v = await form.validateFields();
            if (editing) {
                const payload = { ...v };
                if (!payload.password) delete payload.password;
                await api.put(`/admin/utilisateurs/${editing.id}/`, payload);
                message.success('Utilisateur mis à jour');
            } else {
                await api.post('/admin/utilisateurs/', v);
                message.success('Utilisateur créé');
            }
            setModalOpen(false);
            charger();
        } catch (e) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.erreur || "Erreur lors de l'enregistrement");
        }
    };

    const supprimer = async (id) => {
        try {
            await api.delete(`/admin/utilisateurs/${id}/`);
            message.success('Utilisateur supprimé');
            charger();
        } catch (e) {
            message.error(e?.response?.data?.erreur || 'Suppression impossible');
        }
    };

    const basculerActif = async (u) => {
        try {
            await api.put(`/admin/utilisateurs/${u.id}/`, { is_active: !u.is_active });
            charger();
        } catch {
            message.error('Action impossible');
        }
    };

    const columns = [
        {
            title: 'Utilisateur', key: 'nom',
            render: (_, u) => (
                <Space>
                    <Avatar style={{ background: ROLE_META[u.role]?.color || '#888' }}>
                        {u.nom?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <div>
                        <div style={{ fontWeight: 600 }}>{u.nom}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>@{u.username}</div>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Rôle', dataIndex: 'role', key: 'role',
            filters: Object.keys(ROLE_META).map(r => ({ text: ROLE_META[r].label, value: r })),
            onFilter: (val, u) => u.role === val,
            render: (r) => <Tag color={ROLE_META[r]?.color}>{ROLE_META[r]?.label || r}</Tag>,
        },
        { title: 'Téléphone', dataIndex: 'telephone', key: 'telephone', render: t => t || '—' },
        {
            title: 'Spécialité', dataIndex: 'specialite', key: 'specialite',
            render: s => s ? <Tag>{s}</Tag> : '—',
        },
        {
            title: 'Statut', key: 'is_active',
            render: (_, u) => (
                <Switch checked={u.is_active} size="small"
                    checkedChildren="Actif" unCheckedChildren="Inactif"
                    onChange={() => basculerActif(u)} />
            ),
        },
        {
            title: 'Actions', key: 'actions',
            render: (_, u) => (
                <Space>
                    <Tooltip title="Modifier">
                        <Button size="small" icon={<EditOutlined />} onClick={() => ouvrirEdition(u)} />
                    </Tooltip>
                    <Popconfirm title="Supprimer ce compte ?" okText="Supprimer" cancelText="Annuler"
                        okButtonProps={{ danger: true }} onConfirm={() => supprimer(u.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const parRole = stats?.utilisateurs?.par_role || {};

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <SettingOutlined style={{ color: '#722ed1' }} /> Administration
                </h1>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={charger}>Actualiser</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirCreation}
                        style={{ background: '#722ed1' }}>
                        Nouvel utilisateur
                    </Button>
                </Space>
            </div>

            {/* ── Statistiques ── */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={12} md={6}>
                    <Card><Statistic title="Utilisateurs" value={stats?.utilisateurs?.total || 0}
                        prefix={<UserOutlined />} /></Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card><Statistic title="Interventions" value={stats?.interventions?.total || 0}
                        prefix={<ToolOutlined />} /></Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card><Statistic title="Techniciens dispo."
                        value={stats?.ressources?.techniciens_disponibles || 0}
                        suffix={`/ ${stats?.ressources?.techniciens || 0}`}
                        prefix={<TeamOutlined />} /></Card>
                </Col>
                <Col xs={12} md={6}>
                    <Card><Statistic title="Chiffre d'affaires"
                        value={stats?.chiffre_affaires || 0} precision={2} suffix="DH"
                        prefix={<DollarOutlined />} /></Card>
                </Col>
            </Row>

            {/* ── Répartition par rôle ── */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                {Object.keys(ROLE_META).map(r => (
                    <Col xs={12} md={6} key={r}>
                        <Card size="small">
                            <Statistic title={ROLE_META[r].label} value={parRole[r] || 0}
                                valueStyle={{ color: ROLE_META[r].color }} />
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* ── Table utilisateurs ── */}
            <Card title="Gestion des utilisateurs">
                <Table rowKey="id" columns={columns} dataSource={users}
                    loading={loading} pagination={{ pageSize: 10 }} />
            </Card>

            {/* ── Modal création / édition ── */}
            <Modal
                title={editing ? `Modifier ${editing.nom}` : 'Nouvel utilisateur'}
                open={modalOpen} onOk={enregistrer} onCancel={() => setModalOpen(false)}
                okText={editing ? 'Enregistrer' : 'Créer'} cancelText="Annuler"
                okButtonProps={{ style: { background: '#722ed1' } }} destroyOnClose
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="nom" label="Nom complet"
                        rules={[{ required: true, message: 'Nom requis' }]}>
                        <Input placeholder="Ex : Ali Bennani" />
                    </Form.Item>
                    <Form.Item name="username" label="Nom d'utilisateur"
                        rules={[{ required: true, message: 'Identifiant requis' }]}>
                        <Input disabled={!!editing} placeholder="ali.bennani" />
                    </Form.Item>
                    <Form.Item name="password"
                        label={editing ? 'Nouveau mot de passe (laisser vide pour garder)' : 'Mot de passe'}
                        rules={editing ? [] : [{ required: true, message: 'Mot de passe requis' }]}>
                        <Input.Password prefix={<KeyOutlined />} placeholder="••••••••" />
                    </Form.Item>
                    <Form.Item name="role" label="Rôle"
                        rules={[{ required: true, message: 'Rôle requis' }]}>
                        <Select>
                            {Object.keys(ROLE_META).map(r => (
                                <Option key={r} value={r}>{ROLE_META[r].label}</Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="telephone" label="Téléphone">
                        <Input placeholder="06 00 00 00 00" />
                    </Form.Item>
                    <Form.Item name="email" label="Email">
                        <Input type="email" placeholder="email@exemple.com" />
                    </Form.Item>
                    {roleValue === 'technicien' && (
                        <>
                            <Form.Item name="specialite" label="Spécialité"
                                rules={[{ required: true, message: 'Spécialité requise' }]}>
                                <Select placeholder="Choisir">
                                    {SPECIALITES.map(s => (
                                        <Option key={s.value} value={s.value}>{s.label}</Option>
                                    ))}
                                </Select>
                            </Form.Item>
                            <Form.Item name="tarif_horaire" label="Tarif horaire (DH)">
                                <InputNumber min={0} style={{ width: '100%' }} placeholder="150" />
                            </Form.Item>
                        </>
                    )}
                </Form>
            </Modal>
        </div>
    );
}
