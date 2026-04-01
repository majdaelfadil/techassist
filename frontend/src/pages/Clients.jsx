import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Input,
    Space, Modal, Form, message,
    Tooltip, Popconfirm
} from 'antd';
import {
    PlusOutlined, SearchOutlined,
    EditOutlined, DeleteOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import api from '../services/api';

const Clients = () => {

    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [clientSelectionne, setClientSelectionne] = useState(null);
    const [form] = Form.useForm();

    useEffect(() => {
        chargerClients();
    }, []);

    // ─── LOAD ───
    const chargerClients = async () => {
        setLoading(true);
        try {
            const res = await api.get('/clients/');
            setClients(res.data);
        } catch (error) {
            message.error('Erreur chargement clients');
        } finally {
            setLoading(false);
        }
    };

    // ─── CREATE / UPDATE ───
    const handleSubmit = async (values) => {
        try {
            if (clientSelectionne) {
                await api.put(`/clients/${clientSelectionne.id}/`, values);
                message.success('Client modifié !');
            } else {
                await api.post('/clients/', values);
                message.success('Client créé !');
            }

            setModalOpen(false);
            form.resetFields();
            setClientSelectionne(null);
            chargerClients();

        } catch (error) {
            message.error('Erreur');
        }
    };

    // ─── DELETE ───
    const supprimerClient = async (id) => {
        try {
            await api.delete(`/clients/${id}/`);
            message.success('Client supprimé');
            chargerClients();
        } catch {
            message.error('Erreur suppression');
        }
    };

    // ─── EDIT ───
    const ouvrirEdit = (client) => {
        setClientSelectionne(client);
        form.setFieldsValue(client);
        setModalOpen(true);
    };

    // ─── FILTER ───
    const clientsFiltres = clients.filter(c =>
        c.nom?.toLowerCase().includes(search.toLowerCase()) ||
        c.telephone?.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    );

    // ─── COLUMNS ───
    const colonnes = [
        {
            title: 'Nom',
            dataIndex: 'nom',
            render: (text) => (
                <span style={{ fontWeight: 600 }}>
                    {text}
                </span>
            )
        },
        {
            title: 'Téléphone',
            dataIndex: 'telephone',
        },
        {
            title: 'Email',
            dataIndex: 'email',
            render: (text) => text || '—'
        },
        {
            title: 'Date création',
            dataIndex: 'date_creation',
            render: (date) =>
                new Date(date).toLocaleDateString('fr-FR')
        },
        {
            title: 'Actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Modifier">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => ouvrirEdit(record)}
                        />
                    </Tooltip>

                    <Popconfirm
                        title="Supprimer ce client ?"
                        onConfirm={() => supprimerClient(record.id)}
                    >
                        <Button
                            type="text"
                            icon={<DeleteOutlined />}
                            style={{ color: '#f5222d' }}
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 28 }}>

            {/* HEADER */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 20
            }}>
                <div>
                    <h1 style={{ margin: 0 }}>Clients</h1>
                    <p style={{ color: '#999' }}>
                        {clientsFiltres.length} client(s)
                    </p>
                </div>

                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={chargerClients}
                    >
                        Actualiser
                    </Button>

                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setModalOpen(true);
                            setClientSelectionne(null);
                            form.resetFields();
                        }}
                        style={{
                            background: '#FF8C00',
                            borderColor: '#FF8C00'
                        }}
                    >
                        Nouveau client
                    </Button>
                </Space>
            </div>

            {/* SEARCH */}
            <Card style={{ marginBottom: 16 }}>
                <Input
                    prefix={<SearchOutlined />}
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                />
            </Card>

            {/* TABLE */}
            <Card>
                <Table
                    columns={colonnes}
                    dataSource={clientsFiltres}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* MODAL */}
            <Modal
                title={clientSelectionne ? 'Modifier client' : 'Nouveau client'}
                open={modalOpen}
                onCancel={() => {
                    setModalOpen(false);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        label="Nom"
                        name="nom"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Téléphone"
                        name="telephone"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Email"
                        name="email"
                    >
                        <Input />
                    </Form.Item>

                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={() => setModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            style={{ marginLeft: 8 }}
                        >
                            Enregistrer
                        </Button>
                    </div>
                </Form>
            </Modal>

        </div>
    );
};

export default Clients;