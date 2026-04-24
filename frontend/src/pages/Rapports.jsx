import React, { useState, useEffect } from 'react';
import {
    Card, Table, Tag, Button, Space, Drawer,
    message, Tooltip, Divider, Empty,
    Input, Select, Modal, Row, Col,
    Descriptions, Collapse, Avatar,
    Typography, Progress, Steps, Badge
} from 'antd';
import {
    FileTextOutlined, CheckCircleOutlined,
    ClockCircleOutlined, ReloadOutlined,
    EyeOutlined, SearchOutlined,
    RobotOutlined, UserOutlined,
    TeamOutlined, EditOutlined,
    DollarOutlined, FileDoneOutlined,
    CheckCircleFilled
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const Rapports = () => {
    const [rapports, setRapports] = useState([]);
    const [techniciens, setTechniciens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');
    const [filtreTechnicien, setFiltreTechnicien] = useState('');
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [rapportSelectionne, setRapportSelectionne] = useState(null);
    const [modalValidation, setModalValidation] = useState(false);
    const [modalFacture, setModalFacture] = useState(false);
    const [validationLoading, setValidationLoading] = useState(false);
    const [factureLoading, setFactureLoading] = useState(false);
    const [factureGeneree, setFactureGeneree] = useState(null);

    useEffect(() => {
        chargerDonnees();
    }, []);

    const chargerDonnees = async () => {
        setLoading(true);
        try {
            const [rapportsRes, techniciensRes] = await Promise.all([
                api.get('/rapports/'),
                api.get('/techniciens/')
            ]);
            setRapports(rapportsRes.data);
            setTechniciens(techniciensRes.data);
        } catch (error) {
            message.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const validerRapport = async () => {
        if (!rapportSelectionne) return;
        setValidationLoading(true);
        try {
            await api.post(`/rapports/${rapportSelectionne.id}/valider/`);
            message.success('Rapport validé !');
            setModalValidation(false);
            setDrawerDetail(false);
            chargerDonnees();
        } catch (error) {
            message.error(error.response?.data?.erreur || 'Erreur validation');
        } finally {
            setValidationLoading(false);
        }
    };

    const validerEtGenererFacture = async (rapport) => {
        setFactureLoading(true);
        try {
            const res = await api.post(
                `/interventions/${rapport.intervention_id}/valider-generer-facture/`
            );
            setFactureGeneree(res.data.facture);
            setModalFacture(true);
            chargerDonnees();
        } catch (error) {
            message.error(error.response?.data?.erreur || 'Erreur validation');
        } finally {
            setFactureLoading(false);
        }
    };

    const stats = {
        total: rapports.length,
        enAttente: rapports.filter(r => !r.valide).length,
        valides: rapports.filter(r => r.valide).length,
        prets: rapports.filter(
            r => r.valide && r.intervention_statut === 'termine'
        ).length,
        ia: rapports.filter(r => r.genere_par_ia).length,
        techniciensActifs: new Set(
            rapports.map(r => r.technicien_id).filter(Boolean)
        ).size,
    };

    const rapportsFiltres = rapports.filter(r => {
        const matchSearch =
            search === '' ||
            r.intervention_numero?.toString().toLowerCase()
                .includes(search.toLowerCase()) ||
            r.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
            r.technicien_nom?.toLowerCase().includes(search.toLowerCase());

        const matchStatut =
            filtreStatut === '' ||
            (filtreStatut === 'valide' && r.valide) ||
            (filtreStatut === 'en_attente' && !r.valide) ||
            (filtreStatut === 'pret' &&
                r.valide && r.intervention_statut === 'termine');

        const matchTech =
            filtreTechnicien === '' ||
            r.technicien_id === parseInt(filtreTechnicien);

        return matchSearch && matchStatut && matchTech;
    });

    const parTechnicien = rapportsFiltres.reduce((acc, r) => {
        const id = r.technicien_id || 'non_assigne';
        const nom = r.technicien_nom || 'Non assigné';
        if (!acc[id]) acc[id] = { nom, rapports: [], valides: 0, enAttente: 0 };
        acc[id].rapports.push(r);
        if (r.valide) acc[id].valides++;
        else acc[id].enAttente++;
        return acc;
    }, {});

    const couleurStatut = {
        'nouveau': 'default', 'diagnostique': 'cyan',
        'assigne': 'geekblue', 'en_cours': 'processing',
        'attente_pieces': 'orange', 'termine': 'success',
        'valide': 'green', 'facture': 'purple', 'cloture': 'default'
    };

    const labelStatut = {
        'nouveau': 'Nouveau', 'diagnostique': 'Diagnostiqué',
        'assigne': 'Assigné', 'en_cours': 'En cours',
        'attente_pieces': 'Attente pièces', 'termine': 'Terminée',
        'valide': 'Validée', 'facture': 'Facturée', 'cloture': 'Clôturée'
    };

    const getEtape = (r) => {
        if (!r.valide) return 0;
        if (r.intervention_statut === 'termine') return 1;
        if (r.intervention_statut === 'valide') return 2;
        if (['facture', 'cloture'].includes(r.intervention_statut)) return 3;
        return 1;
    };

    const colonnes = [
        {
            title: 'Intervention',
            dataIndex: 'intervention_numero',
            width: 160,
            render: (text, record) => (
                <div>
                    <span style={{
                        color: '#FF8C00', fontWeight: 700,
                        fontFamily: 'monospace', fontSize: 13
                    }}>
                        {text || `#${record.intervention}`}
                    </span>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        {record.client_nom}
                    </div>
                </div>
            )
        },
        {
            title: 'Technicien',
            dataIndex: 'technicien_nom',
            width: 170,
            render: (text) => (
                <Space>
                    <Avatar
                        icon={<UserOutlined />}
                        size="small"
                        style={{ backgroundColor: '#FF8C00' }}
                    />
                    <span style={{ fontWeight: 500 }}>
                        {text || 'Non assigné'}
                    </span>
                </Space>
            )
        },
        {
            title: 'Date',
            dataIndex: 'date_generation',
            width: 110,
            sorter: (a, b) =>
                new Date(a.date_generation) - new Date(b.date_generation),
            defaultSortOrder: 'descend',
            render: (date) => (
                <span style={{ fontSize: 12, color: '#666' }}>
                    {date ? new Date(date).toLocaleDateString('fr-FR') : '—'}
                </span>
            )
        },
        {
            title: 'Type',
            dataIndex: 'genere_par_ia',
            width: 110,
            render: (ia) => ia ? (
                <Tag color="purple" icon={<RobotOutlined />}>IA Groq</Tag>
            ) : (
                <Tag icon={<EditOutlined />}>Manuel</Tag>
            )
        },
        {
            title: 'Rapport',
            dataIndex: 'valide',
            width: 140,
            render: (valide, record) => valide ? (
                <div>
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                        Validé
                    </Tag>
                    {record.date_validation && (
                        <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                            {new Date(record.date_validation)
                                .toLocaleDateString('fr-FR')}
                        </div>
                    )}
                </div>
            ) : (
                <Tag color="warning" icon={<ClockCircleOutlined />}>
                    En attente
                </Tag>
            )
        },
        {
            title: 'Intervention',
            dataIndex: 'intervention_statut',
            width: 140,
            render: (statut) => (
                <Tag color={couleurStatut[statut] || 'default'}>
                    {labelStatut[statut] || statut || 'N/A'}
                </Tag>
            )
        },
        {
            title: 'Actions',
            width: 120,
            fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir le rapport">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => {
                                setRapportSelectionne(record);
                                setDrawerDetail(true);
                            }}
                        />
                    </Tooltip>
                    {!record.valide && (
                        <Tooltip title="Valider le rapport">
                            <Button
                                type="text"
                                icon={<CheckCircleOutlined />}
                                style={{ color: '#52c41a' }}
                                onClick={() => {
                                    setRapportSelectionne(record);
                                    setModalValidation(true);
                                }}
                            />
                        </Tooltip>
                    )}
                    {record.valide &&
                     record.intervention_statut === 'termine' && (
                        <Tooltip title="Valider et générer facture">
                            <Button
                                type="text"
                                icon={<DollarOutlined />}
                                style={{ color: '#FF8C00' }}
                                loading={factureLoading}
                                onClick={() =>
                                    validerEtGenererFacture(record)
                                }
                            />
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{
            padding: 28,
            background: '#f5f5f5',
            minHeight: '100vh'
        }}>

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
                        Gestion des Rapports
                    </h1>
                    <p style={{
                        color: '#999', margin: '4px 0 0', fontSize: 14
                    }}>
                        Validez les rapports et finalisez les interventions
                    </p>
                </div>
                <Button
                    icon={<ReloadOutlined />}
                    onClick={chargerDonnees}
                    loading={loading}
                    style={{ borderRadius: 10 }}
                >
                    Actualiser
                </Button>
            </div>

            {/* ─── STATS ─── */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                {[
                    {
                        label: 'Total rapports',
                        value: stats.total,
                        color: '#FF8C00',
                        bg: '#FFF3E0',
                        icon: <FileTextOutlined />
                    },
                    {
                        label: 'En attente',
                        value: stats.enAttente,
                        color: '#faad14',
                        bg: '#fffbe6',
                        icon: <ClockCircleOutlined />
                    },
                    {
                        label: 'Validés',
                        value: stats.valides,
                        color: '#52c41a',
                        bg: '#f6ffed',
                        icon: <CheckCircleOutlined />
                    },
                    {
                        label: 'Prêts à facturer',
                        value: stats.prets,
                        color: '#eb2f96',
                        bg: '#fff0f6',
                        icon: <DollarOutlined />
                    },
                    {
                        label: 'Générés par IA',
                        value: stats.ia,
                        color: '#722ed1',
                        bg: '#f9f0ff',
                        icon: <RobotOutlined />
                    },
                    {
                        label: 'Techniciens actifs',
                        value: stats.techniciensActifs,
                        color: '#1890ff',
                        bg: '#e6f7ff',
                        icon: <TeamOutlined />
                    }
                ].map((s, i) => (
                    <Col span={4} key={i}>
                        <Card
                            bordered={false}
                            style={{
                                borderRadius: 14,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{
                                width: 40, height: 40,
                                background: s.bg,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                                color: s.color,
                                margin: '0 auto 10px'
                            }}>
                                {s.icon}
                            </div>
                            <div style={{
                                fontSize: 26, fontWeight: 800,
                                color: s.color, lineHeight: 1
                            }}>
                                {s.value}
                            </div>
                            <div style={{
                                fontSize: 12, color: '#999',
                                marginTop: 4, fontWeight: 500
                            }}>
                                {s.label}
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* ─── FILTRES ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 14,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: 16
                }}
            >
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par n° intervention, client ou technicien..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 340, borderRadius: 8 }}
                    />
                    <Select
                        placeholder="Statut rapport"
                        allowClear
                        value={filtreStatut || undefined}
                        style={{ width: 180 }}
                        onChange={setFiltreStatut}
                    >
                        <Option value="valide">✅ Validés</Option>
                        <Option value="en_attente">⏳ En attente</Option>
                        <Option value="pret">💰 Prêts à facturer</Option>
                    </Select>
                    <Select
                        placeholder="Technicien"
                        allowClear
                        value={filtreTechnicien || undefined}
                        style={{ width: 180 }}
                        onChange={setFiltreTechnicien}
                        showSearch
                        filterOption={(input, option) =>
                            option.children
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                    >
                        {techniciens.map(t => (
                            <Option key={t.id} value={t.id}>
                                {t.nom}
                            </Option>
                        ))}
                    </Select>
                    {(search || filtreStatut || filtreTechnicien) && (
                        <Button onClick={() => {
                            setSearch('');
                            setFiltreStatut('');
                            setFiltreTechnicien('');
                        }}>
                            Réinitialiser
                        </Button>
                    )}
                </Space>
            </Card>

            {/* ─── VUE PAR TECHNICIEN ─── */}
            <Card
                bordered={false}
                title={
                    <Space>
                        <TeamOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>
                            Rapports par technicien
                        </span>
                    </Space>
                }
                style={{
                    borderRadius: 14,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: 16
                }}
            >
                {Object.keys(parTechnicien).length === 0 ? (
                    <Empty description="Aucun rapport trouvé" />
                ) : (
                    <Collapse accordion ghost>
                        {Object.entries(parTechnicien).map(([id, data]) => (
                            <Panel
                                key={id}
                                header={
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        width: '100%',
                                        paddingRight: 16
                                    }}>
                                        <Space>
                                            <Avatar
                                                icon={<UserOutlined />}
                                                style={{
                                                    backgroundColor: '#FF8C00'
                                                }}
                                            />
                                            <span style={{ fontWeight: 600 }}>
                                                {data.nom}
                                            </span>
                                            <Badge
                                                count={data.rapports.length}
                                                showZero
                                                style={{
                                                    backgroundColor: '#d9d9d9',
                                                    color: '#666'
                                                }}
                                            />
                                        </Space>
                                        <Space>
                                            <Tag color="success"
                                                 icon={<CheckCircleOutlined />}>
                                                {data.valides} validés
                                            </Tag>
                                            {data.enAttente > 0 && (
                                                <Tag color="warning"
                                                     icon={<ClockCircleOutlined />}>
                                                    {data.enAttente} en attente
                                                </Tag>
                                            )}
                                            <Progress
                                                type="circle"
                                                percent={
                                                    data.rapports.length > 0
                                                        ? Math.round(
                                                            (data.valides /
                                                             data.rapports.length)
                                                            * 100
                                                          )
                                                        : 0
                                                }
                                                width={36}
                                                strokeColor="#52c41a"
                                                format={p => (
                                                    <span style={{
                                                        fontSize: 9,
                                                        fontWeight: 700
                                                    }}>
                                                        {p}%
                                                    </span>
                                                )}
                                            />
                                        </Space>
                                    </div>
                                }
                            >
                                <Table
                                    columns={colonnes}
                                    dataSource={data.rapports}
                                    rowKey="id"
                                    pagination={false}
                                    size="small"
                                    scroll={{ x: 900 }}
                                />
                            </Panel>
                        ))}
                    </Collapse>
                )}
            </Card>

            {/* ─── TABLEAU PRINCIPAL ─── */}
            <Card
                bordered={false}
                title={
                    <Space>
                        <FileTextOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>
                            Tous les rapports
                        </span>
                        <Badge
                            count={rapportsFiltres.length}
                            showZero
                            style={{ backgroundColor: '#FF8C00' }}
                        />
                    </Space>
                }
                style={{
                    borderRadius: 14,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
                }}
            >
                <Table
                    columns={colonnes}
                    dataSource={rapportsFiltres}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        pageSize: 15,
                        showTotal: (total) => `${total} rapport(s)`,
                        showSizeChanger: true,
                    }}
                    scroll={{ x: 1000 }}
                    rowClassName={(record) => {
                        if (record.valide &&
                            record.intervention_statut === 'termine')
                            return 'row-pret';
                        if (!record.valide) return 'row-en-attente';
                        return '';
                    }}
                />
            </Card>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <Space>
                        <FileTextOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>
                            {rapportSelectionne?.intervention_numero}
                        </span>
                        {rapportSelectionne?.valide ? (
                            <Tag color="success"
                                 icon={<CheckCircleOutlined />}>
                                Validé
                            </Tag>
                        ) : (
                            <Tag color="warning"
                                 icon={<ClockCircleOutlined />}>
                                En attente
                            </Tag>
                        )}
                    </Space>
                }
                open={drawerDetail}
                onClose={() => {
                    setDrawerDetail(false);
                    setRapportSelectionne(null);
                }}
                width={700}
                extra={
                    <Space>
                        {!rapportSelectionne?.valide && (
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                onClick={() => setModalValidation(true)}
                                style={{
                                    background: '#52c41a',
                                    borderColor: '#52c41a',
                                    borderRadius: 8,
                                    fontWeight: 600
                                }}
                            >
                                Valider le rapport
                            </Button>
                        )}
                        {rapportSelectionne?.valide &&
                         rapportSelectionne?.intervention_statut
                             === 'termine' && (
                            <Button
                                type="primary"
                                icon={<DollarOutlined />}
                                loading={factureLoading}
                                onClick={() =>
                                    validerEtGenererFacture(
                                        rapportSelectionne
                                    )
                                }
                                style={{
                                    background: '#FF8C00',
                                    borderColor: '#FF8C00',
                                    borderRadius: 8,
                                    fontWeight: 600
                                }}
                            >
                                Valider et facturer
                            </Button>
                        )}
                    </Space>
                }
            >
                {rapportSelectionne && (
                    <div>
                        {/* Workflow */}
                        <Steps
                            current={getEtape(rapportSelectionne)}
                            size="small"
                            style={{ marginBottom: 24 }}
                            items={[
                                { title: 'Rapport soumis',
                                  icon: <FileTextOutlined /> },
                                { title: 'Rapport validé',
                                  icon: <CheckCircleOutlined /> },
                                { title: 'Intervention validée',
                                  icon: <FileDoneOutlined /> },
                                { title: 'Facturé',
                                  icon: <DollarOutlined /> }
                            ]}
                        />

                        <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label="Intervention">
                                <span style={{
                                    fontWeight: 700, color: '#FF8C00'
                                }}>
                                    {rapportSelectionne.intervention_numero}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Client">
                                {rapportSelectionne.client_nom}
                            </Descriptions.Item>
                            <Descriptions.Item label="Technicien">
                                <Space>
                                    <Avatar
                                        icon={<UserOutlined />}
                                        size="small"
                                        style={{ backgroundColor: '#FF8C00' }}
                                    />
                                    {rapportSelectionne.technicien_nom
                                     || 'Non assigné'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Type de service">
                                {rapportSelectionne.type_service}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date génération">
                                {rapportSelectionne.date_generation
                                    ? new Date(
                                        rapportSelectionne.date_generation
                                      ).toLocaleString('fr-FR')
                                    : '—'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Généré par">
                                {rapportSelectionne.genere_par_ia ? (
                                    <Tag color="purple"
                                         icon={<RobotOutlined />}>
                                        IA Groq
                                    </Tag>
                                ) : (
                                    <Tag icon={<EditOutlined />}>Manuel</Tag>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Statut intervention">
                                <Tag color={
                                    couleurStatut[
                                        rapportSelectionne.intervention_statut
                                    ]
                                }>
                                    {labelStatut[
                                        rapportSelectionne.intervention_statut
                                    ] || 'N/A'}
                                </Tag>
                            </Descriptions.Item>
                            {rapportSelectionne.date_validation && (
                                <Descriptions.Item label="Validé le">
                                    {new Date(
                                        rapportSelectionne.date_validation
                                    ).toLocaleString('fr-FR')}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        <Divider style={{ margin: '20px 0' }}>
                            Contenu du rapport
                        </Divider>

                        <div style={{
                            padding: 20,
                            background: '#fafafa',
                            borderRadius: 10,
                            border: '1px solid #f0f0f0',
                            fontFamily: 'monospace',
                            fontSize: 13,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.8,
                            maxHeight: '45vh',
                            overflowY: 'auto'
                        }}>
                            {rapportSelectionne.contenu
                             || 'Aucun contenu disponible'}
                        </div>

                        {rapportSelectionne.notes_technicien && (
                            <>
                                <Divider style={{ margin: '20px 0' }}>
                                    Notes du technicien
                                </Divider>
                                <div style={{
                                    padding: 16,
                                    background: '#fffbe6',
                                    borderRadius: 10,
                                    border: '1px solid #ffe58f',
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    color: '#664d00'
                                }}>
                                    {rapportSelectionne.notes_technicien}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Drawer>

            {/* ─── MODAL VALIDATION RAPPORT ─── */}
            <Modal
                title={
                    <Space>
                        <CheckCircleOutlined
                            style={{ color: '#52c41a', fontSize: 18 }}
                        />
                        <span>Confirmer la validation</span>
                    </Space>
                }
                open={modalValidation}
                onCancel={() => setModalValidation(false)}
                footer={[
                    <Button key="cancel"
                            onClick={() => setModalValidation(false)}>
                        Annuler
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={validerRapport}
                        loading={validationLoading}
                        style={{
                            background: '#52c41a',
                            borderColor: '#52c41a'
                        }}
                    >
                        Valider
                    </Button>
                ]}
                width={440}
            >
                {rapportSelectionne && (
                    <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label="Technicien">
                            {rapportSelectionne.technicien_nom
                             || 'Non assigné'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Client">
                            {rapportSelectionne.client_nom}
                        </Descriptions.Item>
                        <Descriptions.Item label="Intervention">
                            {rapportSelectionne.intervention_numero}
                        </Descriptions.Item>
                        <Descriptions.Item label="Date">
                            {rapportSelectionne.date_generation
                                ? new Date(
                                    rapportSelectionne.date_generation
                                  ).toLocaleDateString('fr-FR')
                                : '—'}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>

            {/* ─── MODAL FACTURE GÉNÉRÉE ─── */}
            <Modal
                title={
                    <Space>
                        <DollarOutlined
                            style={{ color: '#FF8C00', fontSize: 18 }}
                        />
                        <span>Facture générée !</span>
                    </Space>
                }
                open={modalFacture}
                onCancel={() => {
                    setModalFacture(false);
                    setFactureGeneree(null);
                }}
                footer={[
                    <Button
                        key="ok"
                        type="primary"
                        onClick={() => {
                            setModalFacture(false);
                            setFactureGeneree(null);
                        }}
                        style={{
                            background: '#FF8C00',
                            borderColor: '#FF8C00'
                        }}
                    >
                        OK
                    </Button>
                ]}
                width={400}
            >
                {factureGeneree && (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <CheckCircleFilled style={{
                            fontSize: 48, color: '#52c41a', marginBottom: 12
                        }} />
                        <div style={{
                            fontSize: 16, fontWeight: 700,
                            color: '#FF8C00', marginBottom: 16
                        }}>
                            {factureGeneree.numero}
                        </div>
                        <Descriptions column={1} size="small" bordered>
                            <Descriptions.Item label="Total HT">
                                {factureGeneree.total_ht} MAD
                            </Descriptions.Item>
                            <Descriptions.Item label="TVA (20%)">
                                {(factureGeneree.total_ttc -
                                  factureGeneree.total_ht).toFixed(2)} MAD
                            </Descriptions.Item>
                            <Descriptions.Item label="Total TTC">
                                <span style={{
                                    fontWeight: 700, color: '#FF8C00',
                                    fontSize: 15
                                }}>
                                    {factureGeneree.total_ttc} MAD
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Modal>

            <style>{`
                .row-en-attente { background-color: #fffbe6; }
                .row-pret { background-color: #f6ffed; }
                .ant-collapse-header {
                    align-items: center !important;
                }
            `}</style>
        </div>
    );
};

export default Rapports;