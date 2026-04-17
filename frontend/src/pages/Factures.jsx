import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Input, Select,
    Space, Modal, message, Tooltip, Descriptions,
    Drawer, Statistic, Row, Col, Divider
} from 'antd';
import {
    SearchOutlined, EyeOutlined, FilePdfOutlined,
    MailOutlined, ReloadOutlined, DollarOutlined,
    CheckCircleOutlined, ClockCircleOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

const Factures = () => {
    const [factures, setFactures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [factureSelectionnee, setFactureSelectionnee] =
        useState(null);
    const [loadingPDF, setLoadingPDF] = useState(false);
    const [loadingEmail, setLoadingEmail] = useState(false);

useEffect(() => {
        chargerFactures();
    }, [filtreStatut]);
    // Auto-refresh toutes les 30s
    useEffect(() => {
        const interval = setInterval(chargerFactures, 30000);
        return () => clearInterval(interval);
    }, []);

    // Auto-refresh toutes les 30s
    useEffect(() => {
        const interval = setInterval(chargerFactures, 30000);
        return () => clearInterval(interval);
    }, []);

    // ─── CHARGER FACTURES ───
    const chargerFactures = async () => {
        setLoading(true);
        try {
            const res = await api.get('/factures/');
            setFactures(res.data);
        } catch (error) {
            message.error('Erreur chargement factures');
        } finally {
            setLoading(false);
        }
    };
    // ─── TÉLÉCHARGER PDF ───
    const telechargerPDF = async (facture) => {
        setLoadingPDF(true);
        try {
            const res = await api.get(
                `/factures/${facture.id}/pdf/`,
                { responseType: 'blob' }
            );
            const url = window.URL.createObjectURL(
                new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                `facture_${facture.numero}.pdf`
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success('PDF téléchargé !');
        } catch (error) {
            message.error('Erreur téléchargement PDF');
        } finally {
            setLoadingPDF(false);
        }
    };
    // ─── ENVOYER PAR EMAIL ───
    const envoyerEmail = async (facture) => {
        setLoadingEmail(true);
        try {
            await api.post(
                `/factures/${facture.id}/envoyer-email/`
            );
            message.success('Facture envoyée par email !');
            chargerFactures();
        } catch (error) {
            message.error('Erreur envoi email');
        } finally {
            setLoadingEmail(false);
        }
    };
    // ─── OUVRIR DÉTAIL ───
    const ouvrirDetail = (facture) => {
        setFactureSelectionnee(facture);
        setDrawerDetail(true);
    };
    // ─── FILTRAGE LOCAL ───
    const facturesFiltrees = factures.filter(f =>
        (f.numero?.toLowerCase().includes(search.toLowerCase()) ||
         f.intervention?.numero?.toLowerCase().includes(search.toLowerCase()) ||
         f.intervention?.client_nom?.toLowerCase().includes(search.toLowerCase())) &&
        (!filtreStatut || f.statut === filtreStatut)
    ).sort((a, b) => new Date(b.date_emission) - new Date(a.date_emission));
    // ─── STATS ───
    const totalTTC = factures.reduce(
        (sum, f) => sum + parseFloat(f.total_ttc || 0), 0
    );
    const facturespayees = factures.filter(
        f => f.statut === 'payee').length;
    const facturesEnAttente = factures.filter(
        f => f.statut === 'envoyee').length;
    // ─── COULEURS STATUT ───
    const couleurStatut = {
        'brouillon': { color: '#666', bg: '#f5f5f5',
                       icon: <ClockCircleOutlined /> },
        'envoyee':   { color: '#1890ff', bg: '#e6f7ff',
                       icon: <MailOutlined /> },
        'payee':     { color: '#52c41a', bg: '#f6ffed',
                       icon: <CheckCircleOutlined /> },
        'annulee':   { color: '#f5222d', bg: '#fff1f0',
                       icon: <CloseCircleOutlined /> },
    };
    // ─── COLONNES ───
    const colonnes = [
        {
            title: 'N° Facture',
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
            title: 'N° Intervention',
            dataIndex: 'intervention',
            render: (id) => (
                <span style={{
                    fontFamily: 'monospace',
                    color: '#666'
                }}>
                    #{id}
                </span>
            )
        },
        {
            title: 'Main d\'oeuvre',
            dataIndex: 'montant_main_oeuvre',
            render: (val) => (
                <span>{parseFloat(val).toFixed(2)} MAD</span>
            )
        },
        {
            title: 'Pièces',
            dataIndex: 'montant_pieces',
            render: (val) => (
                <span>{parseFloat(val).toFixed(2)} MAD</span>
            )
        },
        {
            title: 'Déplacement',
            dataIndex: 'montant_deplacement',
            render: (val) => (
                <span>{parseFloat(val).toFixed(2)} MAD</span>
            )
        },
        {
            title: 'TVA',
            dataIndex: 'tva',
            render: (val) => (
                <span style={{ color: '#666' }}>
                    {val}%
                </span>
            )
        },
        {
            title: 'Total HT',
            dataIndex: 'total_ht',
            render: (val) => (
                <span style={{ fontWeight: 600 }}>
                    {parseFloat(val).toFixed(2)} MAD
                </span>
            )
        },
        {
            title: 'Total TTC',
            dataIndex: 'total_ttc',
            render: (val) => (
                <span style={{
                    color: '#FF8C00',
                    fontWeight: 700,
                    fontSize: 14
                }}>
                    {parseFloat(val).toFixed(2)} MAD
                </span>
            )
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => {
                const c = couleurStatut[statut] ||
                          couleurStatut['brouillon'];
                return (
                    <span style={{
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        color: c.color,
                        background: c.bg,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                    }}>
                        {c.icon}
                        {statut?.toUpperCase()}
                    </span>
                );
            }
        },
        {
            title: 'Date émission',
            dataIndex: 'date_emission',
            render: (date) => new Date(date)
                .toLocaleDateString('fr-FR')
        },
        {
            title: 'Actions',
            width: 160,
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
                    <Tooltip title="Télécharger PDF">
                        <Button
                            type="text"
                            icon={<FilePdfOutlined />}
                            style={{ color: '#f5222d' }}
                            loading={loadingPDF}
                            onClick={() =>
                                telechargerPDF(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Envoyer par email">
                        <Button
                            type="text"
                            icon={<MailOutlined />}
                            style={{ color: '#1890ff' }}
                            loading={loadingEmail}
                            onClick={() =>
                                envoyerEmail(record)}
                            disabled={
                                record.statut === 'payee'
                            }
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
                        Factures
                    </h1>
                    <p style={{
                        color: '#999',
                        margin: '4px 0 0',
                        fontSize: 14
                    }}>
                        {facturesFiltrees.length} facture(s)
                        au total
                    </p>
                </div>

                <Button
                    icon={<ReloadOutlined />}
                    onClick={chargerFactures}
                    style={{ borderRadius: 10 }}
                >
                    Actualiser
                </Button>
            </div>
            {/* ─── CARTES STATS ─── */}
            <Row gutter={[16, 16]}
                 style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow:
                                '0 2px 12px rgba(0,0,0,0.06)',
                            borderLeft:
                                '4px solid #FF8C00'
                        }}
                    >
                        <Statistic
                            title="Total encaissé"
                            value={totalTTC.toFixed(2)}
                            suffix="MAD"
                            prefix={<DollarOutlined
                                style={{
                                    color: '#FF8C00'
                                }} />}
                            valueStyle={{
                                color: '#FF8C00',
                                fontWeight: 700
                            }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow:
                                '0 2px 12px rgba(0,0,0,0.06)',
                            borderLeft:
                                '4px solid #52c41a'
                        }}
                    >
                        <Statistic
                            title="Factures payées"
                            value={facturespayees}
                            prefix={<CheckCircleOutlined
                                style={{
                                    color: '#52c41a'
                                }} />}
                            valueStyle={{
                                color: '#52c41a',
                                fontWeight: 700
                            }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card
                        bordered={false}
                        style={{
                            borderRadius: 16,
                            boxShadow:
                                '0 2px 12px rgba(0,0,0,0.06)',
                            borderLeft:
                                '4px solid #1890ff'
                        }}
                    >
                        <Statistic
                            title="En attente paiement"
                            value={facturesEnAttente}
                            prefix={<ClockCircleOutlined
                                style={{
                                    color: '#1890ff'
                                }} />}
                            valueStyle={{
                                color: '#1890ff',
                                fontWeight: 700
                            }}
                        />
                    </Card>
                </Col>
            </Row>
            {/* ─── FILTRES ─── */}
            <Card
                bordered={false}
                style={{
                    borderRadius: 16,
                    boxShadow:
                        '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: 16
                }}
            >
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined
                            style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par numéro..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)}
                        allowClear
                        style={{
                            width: 280,
                            borderRadius: 8
                        }}
                    />
                    <Select
                        placeholder="Statut"
                        allowClear
                        style={{ width: 160 }}
                        onChange={setFiltreStatut}
                    >
                        {['brouillon', 'envoyee',
                          'payee', 'annulee'].map(s => (
                            <Option key={s} value={s}>
                                {s.toUpperCase()}
                            </Option>
                        ))}
                    </Select>
                </Space>
            </Card>

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
                    dataSource={facturesFiltrees}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1400 }}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) =>
                            `${total} factures`
                    }}
                />
            </Card>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <span style={{ fontWeight: 700 }}>
                        Détail facture —
                        <span style={{
                            color: '#FF8C00',
                            marginLeft: 8
                        }}>
                            {factureSelectionnee?.numero}
                        </span>
                    </span>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={480}
                extra={
                    <Space>
                        <Button
                            icon={<FilePdfOutlined />}
                            type="primary"
                            danger
                            onClick={() =>
                                telechargerPDF(
                                    factureSelectionnee)}
                        >
                            PDF
                        </Button>
                        <Button
                            icon={<MailOutlined />}
                            type="primary"
                            onClick={() =>
                                envoyerEmail(
                                    factureSelectionnee)}
                        >
                            Email
                        </Button>
                    </Space>
                }
            >
                {factureSelectionnee && (
                    <div>
                        {/* Statut */}
                        <div style={{
                            textAlign: 'center',
                            marginBottom: 24
                        }}>
                            <span style={{
                                padding: '8px 24px',
                                borderRadius: 20,
                                fontSize: 14,
                                fontWeight: 700,
                                color: couleurStatut[
                                    factureSelectionnee
                                        .statut]?.color,
                                background: couleurStatut[
                                    factureSelectionnee
                                        .statut]?.bg
                            }}>
                                {factureSelectionnee
                                    .statut?.toUpperCase()}
                            </span>
                        </div>

                        <Descriptions
                            column={1}
                            bordered
                            size="small"
                        >
                            <Descriptions.Item
                                label="N° Facture">
                                <span style={{
                                    color: '#FF8C00',
                                    fontWeight: 700
                                }}>
                                    {factureSelectionnee
                                        .numero}
                                </span>
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="N° Intervention">
                                #{factureSelectionnee
                                    .intervention}
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="Date émission">
                                {new Date(
                                    factureSelectionnee
                                        .date_emission)
                                    .toLocaleDateString(
                                        'fr-FR')}
                            </Descriptions.Item>

                            {factureSelectionnee
                                .date_paiement && (
                                <Descriptions.Item
                                    label="Date paiement">
                                    {new Date(
                                        factureSelectionnee
                                            .date_paiement)
                                        .toLocaleDateString(
                                            'fr-FR')}
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        <Divider>Détail financier</Divider>

                        <Descriptions
                            column={1}
                            bordered
                            size="small"
                        >
                            <Descriptions.Item
                                label="Main d'oeuvre">
                                {parseFloat(
                                    factureSelectionnee
                                        .montant_main_oeuvre)
                                    .toFixed(2)} MAD
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="Pièces de rechange">
                                {parseFloat(
                                    factureSelectionnee
                                        .montant_pieces)
                                    .toFixed(2)} MAD
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="Déplacement">
                                {parseFloat(
                                    factureSelectionnee
                                        .montant_deplacement)
                                    .toFixed(2)} MAD
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="TVA">
                                {factureSelectionnee.tva}%
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="Total HT">
                                <span style={{
                                    fontWeight: 600
                                }}>
                                    {parseFloat(
                                        factureSelectionnee
                                            .total_ht)
                                        .toFixed(2)} MAD
                                </span>
                            </Descriptions.Item>

                            <Descriptions.Item
                                label="Total TTC">
                                <span style={{
                                    color: '#FF8C00',
                                    fontWeight: 700,
                                    fontSize: 16
                                }}>
                                    {parseFloat(
                                        factureSelectionnee
                                            .total_ttc)
                                        .toFixed(2)} MAD
                                </span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Factures;