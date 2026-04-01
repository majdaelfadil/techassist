import React, { useEffect, useState } from 'react';
import {
    Table, Card, Button, Input, Space,
    Modal, Form, message, Tag, Select,
    Checkbox
} from 'antd';
import {
    PlusOutlined, SearchOutlined,
    DeleteOutlined, ReloadOutlined, EditOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;
const { confirm } = Modal;

const Techniciens = () => {
    const [techniciens, setTechniciens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreSpecialite, setFiltreSpecialite] = useState('');
    const [filtreDisponible, setFiltreDisponible] = useState('');
    const [selection, setSelection] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTechnicien, setEditingTechnicien] = useState(null);

    const [form] = Form.useForm();

    useEffect(() => {
        chargerTechniciens();
    }, []);

    // ─── CHARGEMENT ───
    const chargerTechniciens = async () => {
        setLoading(true);
        try {
            const res = await api.get('/techniciens/');
            setTechniciens(res.data);
        } catch (error) {
            console.error("Erreur chargement:", error);
            message.error('Erreur lors du chargement des techniciens');
        } finally {
            setLoading(false);
        }
    };

    // ─── CRÉATION / MODIFICATION ───
    const enregistrerTechnicien = async (values) => {
        try {
            if (editingTechnicien) {
                // Pour la modification, on utilise l'ID existant
                const id = editingTechnicien.id || editingTechnicien._id;
                await api.put(`/techniciens/${id}/`, values);
                message.success('Technicien modifié avec succès');
            } else {
                await api.post('/techniciens/', values);
                message.success('Technicien ajouté avec succès');
            }
            fermerModal();
            chargerTechniciens();
        } catch (error) {
            console.error("Erreur sauvegarde:", error);
            message.error('Erreur lors de la sauvegarde');
        }
    };

    // ─── SUPPRESSION MULTIPLE ───
    const supprimerSelection = async () => {
        confirm({
            title: `Supprimer ${selection.length} technicien(s) ?`,
            icon: <ExclamationCircleOutlined />,
            content: 'Cette action est irréversible.',
            okText: 'Supprimer',
            okType: 'danger',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    // On attend que toutes les requêtes soient terminées
                    await Promise.all(
                        selection.map(id => api.delete(`/techniciens/${id}/`))
                    );
                    message.success('Sélection supprimée');
                    setSelection([]); // Vider la sélection après suppression
                    chargerTechniciens();
                } catch (error) {
                    console.error("Erreur suppression groupée:", error);
                    message.error('Certaines suppressions ont échoué');
                }
            }
        });
    };

    // ─── SUPPRESSION UNIQUE ───
    const supprimerTechnicien = (record) => {
        // Détection de l'ID (gère id ou _id selon votre backend)
        const id = record.id || record._id;

        confirm({
            title: `Supprimer ${record.nom} ?`,
            icon: <ExclamationCircleOutlined />,
            content: 'Voulez-vous vraiment supprimer ce technicien ?',
            okText: 'Supprimer',
            okType: 'danger',
            cancelText: 'Annuler',
            onOk: async () => {
                try {
                    console.log("Tentative de suppression de l'ID:", id);
                    await api.delete(`/techniciens/${id}/`);
                    message.success('Technicien supprimé');
                    chargerTechniciens();
                } catch (error) {
                    console.error("Erreur suppression individuelle:", error.response || error);
                    message.error('Erreur lors de la suppression');
                }
            }
        });
    };

    // ─── OUVERTURE MODAL ÉDITION ───
    const modifierTechnicien = (technicien) => {
        setEditingTechnicien(technicien);
        form.setFieldsValue({
            nom: technicien.nom,
            specialite: technicien.specialite,
            tarif_horaire: technicien.tarif_horaire,
            disponible: technicien.disponible
        });
        setModalOpen(true);
    };

    const fermerModal = () => {
        setModalOpen(false);
        setEditingTechnicien(null);
        form.resetFields();
    };

    // ─── FILTRAGE DES DONNÉES ───
    const dataFiltre = techniciens.filter(t => {
        const matchNom = t.nom?.toLowerCase().includes(search.toLowerCase());
        const matchSpecialite = filtreSpecialite ? t.specialite === filtreSpecialite : true;
        const matchDispo = filtreDisponible !== '' ? t.disponible === filtreDisponible : true;
        return matchNom && matchSpecialite && matchDispo;
    });

    // ─── CONFIGURATION DES COLONNES ───
    const colonnes = [
        {
            title: 'Nom',
            dataIndex: 'nom',
            key: 'nom',
            render: (text) => <span style={{ fontWeight: 600, color: '#1677ff' }}>{text}</span>
        },
        { title: 'Spécialité', dataIndex: 'specialite', key: 'specialite' },
        {
            title: 'Tarif horaire',
            dataIndex: 'tarif_horaire',
            key: 'tarif_horaire',
            render: (val) => `${val} MAD`
        },
        {
            title: 'Disponible',
            dataIndex: 'disponible',
            key: 'disponible',
            render: (val) =>
                val ? <Tag color="green">✔ Oui</Tag> : <Tag color="red">✖ Non</Tag>
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => modifierTechnicien(record)}
                    />
                    <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => supprimerTechnicien(record)}
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 28 }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0 }}>Gestion des Techniciens</h1>
                    <p style={{ color: '#999' }}>{dataFiltre.length} technicien(s) trouvé(s)</p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={chargerTechniciens}>Actualiser</Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setModalOpen(true)}
                        style={{ background: '#FF8C00', borderColor: '#FF8C00' }}
                    >
                        Ajouter technicien
                    </Button>
                </Space>
            </div>

            {/* BARRE DE FILTRES */}
            <Card style={{ marginBottom: 16, borderRadius: 12 }}>
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined />}
                        placeholder="Rechercher par nom..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 260 }}
                    />
                    <Select
                        placeholder="Filtrer par spécialité"
                        allowClear
                        style={{ width: 180 }}
                        onChange={setFiltreSpecialite}
                    >
                        <Option value="Hardware">Hardware</Option>
                        <Option value="Software">Software</Option>
                        <Option value="Réseau">Réseau</Option>
                        <Option value="Maintenance">Maintenance</Option>
                    </Select>
                    <Select
                        placeholder="Disponibilité"
                        allowClear
                        style={{ width: 180 }}
                        onChange={setFiltreDisponible}
                    >
                        <Option value={true}>Disponible</Option>
                        <Option value={false}>Non disponible</Option>
                    </Select>
                </Space>
            </Card>

            {/* ACTIONS SUR LA SÉLECTION */}
            {selection.length > 0 && (
                <Card style={{ marginBottom: 16, backgroundColor: '#fff1f0', border: '1px solid #ffa39e' }}>
                    <Space>
                        <Button 
                            danger 
                            type="primary" 
                            icon={<DeleteOutlined />} 
                            onClick={supprimerSelection}
                        >
                            Supprimer la sélection ({selection.length})
                        </Button>
                        <Button onClick={() => setSelection([])}>Annuler</Button>
                    </Space>
                </Card>
            )}

            {/* TABLEAU */}
            <Card bodyStyle={{ padding: 0 }}>
                <Table
                    rowSelection={{ 
                        selectedRowKeys: selection, 
                        onChange: (keys) => setSelection(keys) 
                    }}
                    columns={colonnes}
                    dataSource={dataFiltre}
                    rowKey={(record) => record.id || record._id} // Sécurité pour l'ID
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                />
            </Card>

            {/* MODAL AJOUT/MODIF */}
            <Modal
                title={editingTechnicien ? "Modifier les informations" : "Nouveau Technicien"}
                open={modalOpen}
                onCancel={fermerModal}
                footer={null}
                destroyOnClose
            >
                <Form form={form} layout="vertical" onFinish={enregistrerTechnicien}>
                    <Form.Item label="Nom complet" name="nom" rules={[{ required: true, message: 'Le nom est requis' }]}>
                        <Input placeholder="Ex: Jean Dupont" />
                    </Form.Item>
                    <Form.Item label="Spécialité" name="specialite" rules={[{ required: true, message: 'Choisissez une spécialité' }]}>
                        <Select placeholder="Sélectionner...">
                            <Option value="Hardware">Hardware</Option>
                            <Option value="Software">Software</Option>
                            <Option value="Réseau">Réseau</Option>
                            <Option value="Maintenance">Maintenance</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="Tarif horaire (MAD)" name="tarif_horaire" rules={[{ required: true, message: 'Le tarif est requis' }]}>
                        <Input type="number" min={0} />
                    </Form.Item>
                    <Form.Item name="disponible" valuePropName="checked" initialValue={true}>
                        <Checkbox>Disponible immédiatement</Checkbox>
                    </Form.Item>
                    
                    <div style={{ textAlign: 'right', marginTop: 24 }}>
                        <Space>
                            <Button onClick={fermerModal}>Annuler</Button>
                            <Button type="primary" htmlType="submit">
                                Enregistrer
                            </Button>
                        </Space>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default Techniciens;