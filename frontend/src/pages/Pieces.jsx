import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Input, Space, Modal,
    Form, message, Tooltip, Popconfirm,
    InputNumber, Progress, Badge, Descriptions,
    Drawer, Alert
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EditOutlined,
    DeleteOutlined, ReloadOutlined, EyeOutlined,
    WarningOutlined
} from '@ant-design/icons';
import api from '../services/api';

const Pieces = () => {
    const [pieces, setPieces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [modalCreer, setModalCreer] = useState(false);
    const [modalModifier, setModalModifier] = useState(false);
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [pieceSelectionnee, setPieceSelectionnee] =
        useState(null);
    const [form] = Form.useForm();
    const [formModifier] = Form.useForm();

    useEffect(() => {
        chargerPieces();
    }, []);

    // ─── CHARGER PIÈCES ───
    const chargerPieces = async () => {
        setLoading(true);
        try {
            const res = await api.get('/pieces/');
            setPieces(res.data);
        } catch (error) {
            message.error('Erreur chargement pièces');
        } finally {
            setLoading(false);
        }
    };

    // ─── CRÉER PIÈCE ───
    const creerPiece = async (values) => {
        try {
            await api.post('/pieces/', values);
            message.success('Pièce créée !');
            setModalCreer(false);
            form.resetFields();
            chargerPieces();
        } catch (error) {
            message.error('Erreur création');
        }
    };

    // ─── MODIFIER PIÈCE ───
    const modifierPiece = async (values) => {
        try {
            await api.patch(
                `/pieces/${pieceSelectionnee.id}/`,
                values
            );
            message.success('Pièce modifiée !');
            setModalModifier(false);
            chargerPieces();
        } catch (error) {
            message.error('Erreur modification');
        }
    };

    // ─── SUPPRIMER PIÈCE ───
    const supprimerPiece = async (id) => {
        try {
            await api.delete(`/pieces/${id}/`);
            message.success('Pièce supprimée !');
            chargerPieces();
        } catch (error) {
            message.error('Erreur suppression');
        }
    };

    // ─── OUVRIR MODIFIER ───
    const ouvrirModifier = (piece) => {
        setPieceSelectionnee(piece);
        formModifier.setFieldsValue(piece);
        setModalModifier(true);
    };

    // ─── OUVRIR DÉTAIL ───
    const ouvrirDetail = (piece) => {
        setPieceSelectionnee(piece);
        setDrawerDetail(true);
    };

    // ─── FILTRAGE LOCAL ───
    const piecesFiltrees = pieces.filter(p =>
        p.nom?.toLowerCase().includes(
            search.toLowerCase()) ||
        p.reference?.toLowerCase().includes(
            search.toLowerCase())
    );

    // ─── PIÈCES EN RUPTURE ───
    const piecesEnRupture = pieces.filter(
        p => p.en_rupture).length;

    // ─── FORMULAIRE PIÈCE ───
    const FormulairePiece = ({ form, onFinish }) => (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            style={{ marginTop: 16 }}
        >
            <Space style={{ width: '100%' }} size={12}>
                <Form.Item
                    label="Nom de la pièce"
                    name="nom"
                    rules={[{
                        required: true,
                        message: 'Nom obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <Input
                        placeholder="Ex: Disque dur SSD 500GB"
                        style={{ borderRadius: 8 }}
                    />
                </Form.Item>

                <Form.Item
                    label="Référence"
                    name="reference"
                    rules={[{
                        required: true,
                        message: 'Référence obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <Input
                        placeholder="Ex: SSD-500-001"
                        style={{ borderRadius: 8 }}
                    />
                </Form.Item>
            </Space>

            <Space style={{ width: '100%' }} size={12}>
                <Form.Item
                    label="Quantité en stock"
                    name="quantite_stock"
                    rules={[{
                        required: true,
                        message: 'Quantité obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <InputNumber
                        min={0}
                        placeholder="0"
                        style={{
                            width: '100%',
                            borderRadius: 8
                        }}
                    />
                </Form.Item>

                <Form.Item
                    label="Seuil minimum"
                    name="seuil_minimum"
                    rules={[{
                        required: true,
                        message: 'Seuil obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <InputNumber
                        min={0}
                        placeholder="5"
                        style={{
                            width: '100%',
                            borderRadius: 8
                        }}
                    />
                </Form.Item>

                <Form.Item
                    label="Prix unitaire (MAD)"
                    name="prix_unitaire"
                    rules={[{
                        required: true,
                        message: 'Prix obligatoire'
                    }]}
                    style={{ flex: 1 }}
                >
                    <InputNumber
                        min={0}
                        placeholder="0.00"
                        style={{
                            width: '100%',
                            borderRadius: 8
                        }}
                        addonAfter="MAD"
                    />
                </Form.Item>
            </Space>

            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 8
            }}>
                <Button
                    style={{ borderRadius: 8 }}
                    onClick={() => {
                        setModalCreer(false);
                        setModalModifier(false);
                        form.resetFields();
                    }}
                >
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
            title: 'Nom',
            dataIndex: 'nom',
            render: (nom, record) => (
                <Space>
                    {record.en_rupture && (
                        <WarningOutlined
                            style={{ color: '#f5222d' }} />
                    )}
                    <span style={{ fontWeight: 600 }}>
                        {nom}
                    </span>
                </Space>
            )
        },
        {
            title: 'Référence',
            dataIndex: 'reference',
            render: (ref) => (
                <span style={{
                    fontFamily: 'monospace',
                    color: '#666',
                    background: '#f5f5f5',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12
                }}>
                    {ref}
                </span>
            )
        },
        {
            title: 'Stock',
            dataIndex: 'quantite_stock',
            render: (qty, record) => {
                const pct = Math.min(
                    (qty / (record.seuil_minimum * 3)) * 100,
                    100
                );
                const color = record.en_rupture ?
                    '#f5222d' :
                    qty <= record.seuil_minimum * 1.5 ?
                        '#fa8c16' : '#52c41a';
                return (
                    <div style={{ minWidth: 120 }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 4
                        }}>
                            <span style={{
                                fontWeight: 700,
                                color: color
                            }}>
                                {qty}
                            </span>
                            <span style={{
                                color: '#999',
                                fontSize: 11
                            }}>
                                min: {record.seuil_minimum}
                            </span>
                        </div>
                        <Progress
                            percent={pct}
                            showInfo={false}
                            strokeColor={color}
                            size="small"
                        />
                    </div>
                );
            }
        },
        {
            title: 'Seuil minimum',
            dataIndex: 'seuil_minimum',
            render: (seuil) => (
                <span style={{ color: '#666' }}>
                    {seuil} unités
                </span>
            )
        },
        {
            title: 'Prix unitaire',
            dataIndex: 'prix_unitaire',
            render: (prix) => (
                <span style={{
                    color: '#FF8C00',
                    fontWeight: 700
                }}>
                    {prix} MAD
                </span>
            )
        },
        {
            title: 'État',
            dataIndex: 'en_rupture',
            render: (rupture) => rupture ? (
                <Badge
                    status="error"
                    text={
                        <span style={{
                            color: '#f5222d',
                            fontWeight: 600,
                            fontSize: 12
                        }}>
                            Rupture de stock
                        </span>
                    }
                />
            ) : (
                <Badge
                    status="success"
                    text={
                        <span style={{
                            color: '#52c41a',
                            fontWeight: 600,
                            fontSize: 12
                        }}>
                            En stock
                        </span>
                    }
                />
            )
        },
        {
            title: 'Actions',
            width: 140,
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
                            title="Supprimer cette pièce ?"
                            onConfirm={() =>
                                supprimerPiece(record.id)}
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
                        Pièces de rechange
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: '4px 0 0',
                        fontSize: 14
                    }}>
                        {piecesFiltrees.length} pièce(s)
                        au total
                    </p>
                </div>

                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={chargerPieces}
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
                        Nouvelle pièce
                    </Button>
                </Space>
            </div>

            {/* ─── ALERTE RUPTURE ─── */}
            {piecesEnRupture > 0 && (
                <Alert
                    message={`⚠️ ${piecesEnRupture} pièce(s) en rupture de stock !`}
                    description="Veuillez réapprovisionner le stock de ces pièces."
                    type="error"
                    showIcon
                    style={{
                        borderRadius: 12,
                        marginBottom: 16
                    }}
                />
            )}

            {/* ─── FILTRES ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: 16
                }}
            >
                <Input
                    prefix={<SearchOutlined
                        style={{ color: '#ccc' }} />}
                    placeholder="Rechercher par nom ou référence..."
                    value={search}
                    onChange={(e) =>
                        setSearch(e.target.value)}
                    allowClear
                    style={{
                        width: 340,
                        borderRadius: 8
                    }}
                />
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
                    dataSource={piecesFiltrees}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) =>
                            `${total} pièces`
                    }}
                    rowClassName={(record) =>
                        record.en_rupture ?
                            'row-rupture' : ''
                    }
                />
            </Card>

            {/* ─── MODAL CRÉER ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        ➕ Nouvelle pièce
                    </span>
                }
                open={modalCreer}
                onCancel={() => {
                    setModalCreer(false);
                    form.resetFields();
                }}
                footer={null}
                width={580}
            >
                <FormulairePiece
                    form={form}
                    onFinish={creerPiece}
                />
            </Modal>

            {/* ─── MODAL MODIFIER ─── */}
            <Modal
                title={
                    <span style={{ fontWeight: 700 }}>
                        ✏️ Modifier pièce
                    </span>
                }
                open={modalModifier}
                onCancel={() => {
                    setModalModifier(false);
                    formModifier.resetFields();
                }}
                footer={null}
                width={580}
            >
                <FormulairePiece
                    form={formModifier}
                    onFinish={modifierPiece}
                />
            </Modal>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <span style={{ fontWeight: 700 }}>
                        Détail pièce
                    </span>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={400}
            >
                {pieceSelectionnee && (
                    <Descriptions
                        column={1}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label="Nom">
                            {pieceSelectionnee.nom}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Référence">
                            <span style={{
                                fontFamily: 'monospace'
                            }}>
                                {pieceSelectionnee.reference}
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Quantité en stock">
                            <span style={{
                                fontWeight: 700,
                                color: pieceSelectionnee
                                    .en_rupture ?
                                    '#f5222d' : '#52c41a'
                            }}>
                                {pieceSelectionnee
                                    .quantite_stock} unités
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Seuil minimum">
                            {pieceSelectionnee
                                .seuil_minimum} unités
                        </Descriptions.Item>
                        <Descriptions.Item
                            label="Prix unitaire">
                            <span style={{
                                color: '#FF8C00',
                                fontWeight: 700
                            }}>
                                {pieceSelectionnee
                                    .prix_unitaire} MAD
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="État">
                            {pieceSelectionnee.en_rupture ?
                                '🔴 Rupture de stock' :
                                '🟢 En stock'}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Drawer>
        </div>
    );
};

export default Pieces;