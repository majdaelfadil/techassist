import React, { useEffect, useState } from 'react';
import {
    Table, Card, Button, Input, Space,
    Modal, Form, message, Tag, InputNumber, Tooltip
} from 'antd';
import {
    PlusOutlined, SearchOutlined,
    DeleteOutlined, ReloadOutlined, EditOutlined, 
    ExclamationCircleOutlined, WarningOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { confirm } = Modal;

const Pieces = () => {
    const [pieces, setPieces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selection, setSelection] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPiece, setEditingPiece] = useState(null);

    const [form] = Form.useForm();

    useEffect(() => {
        chargerPieces();
    }, []);

    // ─── CHARGEMENT ───
    const chargerPieces = async () => {
        setLoading(true);
        try {
            const res = await api.get('/pieces/');
            setPieces(res.data);
        } catch (error) {
            message.error('Erreur lors du chargement des pièces');
        } finally {
            setLoading(false);
        }
    };

    // ─── ENREGISTRER (CREATE / UPDATE) ───
    const enregistrerPiece = async (values) => {
        try {
            // Conversion forcée en nombres pour éviter l'erreur 400
            const data = {
                ...values,
                quantite_stock: parseInt(values.quantite_stock),
                seuil_minimum: parseInt(values.seuil_minimum),
                prix_unitaire: parseFloat(values.prix_unitaire)
            };

            if (editingPiece) {
                await api.put(`/pieces/${editingPiece.id}/`, data);
                message.success('Pièce mise à jour');
            } else {
                await api.post('/pieces/', data);
                message.success('Nouvelle pièce ajoutée');
            }
            fermerModal();
            chargerPieces();
        } catch (error) {
            console.error(error.response?.data);
            message.error('Erreur lors de la sauvegarde. Vérifiez les données.');
        }
    };

    // ─── SUPPRESSION UNIQUE ───
    const supprimerPiece = (record) => {
        confirm({
            title: `Supprimer la pièce ${record.reference} ?`,
            icon: <ExclamationCircleOutlined />,
            content: `Voulez-vous vraiment supprimer "${record.nom}" ?`,
            okText: 'Supprimer',
            okType: 'danger',
            onOk: async () => {
                try {
                    await api.delete(`/pieces/${record.id}/`);
                    message.success('Pièce supprimée');
                    chargerPieces();
                } catch (error) {
                    message.error('Erreur lors de la suppression (405 ou 404)');
                }
            }
        });
    };

    // ─── SUPPRESSION GROUPÉE ───
    const supprimerSelection = async () => {
        confirm({
            title: `Supprimer ${selection.length} pièces ?`,
            onOk: async () => {
                try {
                    await Promise.all(selection.map(id => api.delete(`/pieces/${id}/`)));
                    message.success('Sélection supprimée');
                    setSelection([]);
                    chargerPieces();
                } catch (error) {
                    message.error('Erreur lors de la suppression groupée');
                }
            }
        });
    };

    const modifierPiece = (piece) => {
        setEditingPiece(piece);
        form.setFieldsValue(piece);
        setModalOpen(true);
    };

    const fermerModal = () => {
        setModalOpen(false);
        setEditingPiece(null);
        form.resetFields();
    };

    // ─── FILTRAGE (Nom ou Référence) ───
    const dataFiltre = pieces.filter(p =>
        p.nom?.toLowerCase().includes(search.toLowerCase()) ||
        p.reference?.toLowerCase().includes(search.toLowerCase())
    );

    // ─── COLONNES ───
    const colonnes = [
        {
            title: 'Référence',
            dataIndex: 'reference',
            key: 'reference',
            render: (ref) => <Tag color="blue">{ref}</Tag>
        },
        {
            title: 'Nom de la pièce',
            dataIndex: 'nom',
            key: 'nom',
            render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>
        },
        {
            title: 'Stock',
            dataIndex: 'quantite_stock',
            key: 'quantite_stock',
            render: (stock, record) => {
                const estFaible = stock <= record.seuil_minimum;
                return (
                    <Space>
                        <span style={{ color: estFaible ? '#ff4d4f' : 'inherit', fontWeight: estFaible ? 'bold' : 'normal' }}>
                            {stock}
                        </span>
                        {estFaible && (
                            <Tooltip title="Stock sous le seuil minimum !">
                                <WarningOutlined style={{ color: '#ff4d4f' }} />
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'Prix Unitaire',
            dataIndex: 'prix_unitaire',
            key: 'prix_unitaire',
            render: (prix) => `${parseFloat(prix).toFixed(2)} MAD`
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button icon={<EditOutlined />} onClick={() => modifierPiece(record)} />
                    <Button icon={<DeleteOutlined />} danger onClick={() => supprimerPiece(record)} />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 28 }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0 }}>Gestion du Stock (Pièces)</h1>
                    <p style={{ color: '#999' }}>{dataFiltre.length} référence(s) en catalogue</p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={chargerPieces}>Actualiser</Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setModalOpen(true)}
                        style={{ background: '#2ecc71', borderColor: '#2ecc71' }}
                    >
                        Ajouter une pièce
                    </Button>
                </Space>
            </div>

            {/* BARRE DE RECHERCHE */}
            <Card style={{ marginBottom: 16 }}>
                <Input
                    prefix={<SearchOutlined />}
                    placeholder="Rechercher par nom ou référence (ex: PT-001)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    style={{ width: 400 }}
                />
            </Card>

            {/* TABLEAU */}
            <Card>
                {selection.length > 0 && (
                    <Button 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={supprimerSelection} 
                        style={{ marginBottom: 16 }}
                    >
                        Supprimer la sélection ({selection.length})
                    </Button>
                )}
                <Table
                    rowSelection={{ selectedRowKeys: selection, onChange: setSelection }}
                    columns={colonnes}
                    dataSource={dataFiltre}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            {/* MODAL AJOUT/MODIF */}
            <Modal
                title={editingPiece ? "Modifier la pièce" : "Nouvelle pièce"}
                open={modalOpen}
                onCancel={fermerModal}
                onOk={() => form.submit()}
                okText="Enregistrer"
                cancelText="Annuler"
            >
                <Form form={form} layout="vertical" onFinish={enregistrerPiece}>
                    <Form.Item name="reference" label="Référence (ex: PT-001)" rules={[{ required: true }]}>
                        <Input placeholder="Référence unique" />
                    </Form.Item>
                    
                    <Form.Item name="nom" label="Nom de la pièce" rules={[{ required: true }]}>
                        <Input placeholder="Ex: Disque Dur SSD 500Go" />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: '16px' }}>
                        <Form.Item name="quantite_stock" label="Quantité en stock" rules={[{ required: true }]} style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        
                        <Form.Item name="seuil_minimum" label="Seuil minimum" rules={[{ required: true }]} style={{ flex: 1 }}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                    </div>

                    <Form.Item name="prix_unitaire" label="Prix Unitaire (MAD)" rules={[{ required: true }]}>
                        <InputNumber 
                            min={0} 
                            step={0.01} 
                            style={{ width: '100%' }} 
                            formatter={value => `${value} MAD`}
                            parser={value => value.replace(' MAD', '')}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Pieces;