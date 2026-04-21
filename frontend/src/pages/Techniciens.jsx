import React, { useState, useEffect } from 'react';
import {
    Table, Card, Button, Tag, Input, Select,
    Space, Modal, Form, message, Tooltip,
    Popconfirm, Switch, Avatar, Descriptions,
    Drawer, InputNumber, Badge, Timeline,
    Empty, Spin, Segmented
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined,
    EditOutlined, DeleteOutlined, ReloadOutlined,
    UserOutlined, CheckCircleOutlined,
    CloseCircleOutlined, CalendarOutlined,
    ClockCircleOutlined, ToolOutlined,
    FireOutlined, ThunderboltOutlined,
    ScheduleOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');

const { Option } = Select;

// ─── COULEURS ───
const couleurStatut = {
    'assigne':        '#722ed1',
    'en_cours':       '#fa8c16',
    'attente_pieces': '#faad14',
    'termine':        '#52c41a',
    'nouveau':        '#1890ff',
    'diagnostique':   '#13c2c2',
    'valide':         '#52c41a',
    'cloture':        '#8c8c8c',
};

const couleurUrgence = {
    'faible':   { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f' },
    'normale':  { color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff' },
    'haute':    { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591' },
    'critique': { color: '#f5222d', bg: '#fff1f0', border: '#ffa39e' },
};

const couleurSpecialite = {
    'hardware':    '#FF8C00',
    'software':    '#1890ff',
    'reseau':      '#52c41a',
    'maintenance': '#722ed1',
};

const typesService = {
    'reparation':    '🔧 Réparation',
    'installation':  '💿 Installation',
    'configuration': '⚙️ Configuration',
    'maintenance':   '🔩 Maintenance',
    'depannage':     '🛠️ Dépannage'
};

const specialites = [
    { key: 'hardware',    label: 'Hardware' },
    { key: 'software',    label: 'Software' },
    { key: 'reseau',      label: 'Réseau' },
    { key: 'maintenance', label: 'Maintenance' },
];

// ════════════════════════════════
// ─── MODAL PLANNING TECHNICIEN ───
// ════════════════════════════════
const ModalPlanning = ({ technicien, open, onClose }) => {
    const [interventions, setInterventions]   = useState([]);
    const [loading, setLoading]               = useState(false);
    const [moisCourant, setMoisCourant]       = useState(dayjs());
    const [vueMode, setVueMode]               = useState('calendrier');
    const [detailOuvert, setDetailOuvert]     = useState(null);

    useEffect(() => {
        if (open && technicien) chargerInterventions();
    }, [open, technicien]);

    const chargerInterventions = async () => {
        setLoading(true);
        try {
            const res = await api.get(
                `/interventions/?technicien_id=${technicien.id}`
            );
            const data = Array.isArray(res.data)
                ? res.data
                : res.data.results || [];
            setInterventions(data.filter(i => i.date_planifiee));
        } catch {
            message.error('Erreur chargement planning');
        } finally {
            setLoading(false);
        }
    };

    const aujourd_hui = dayjs().format('YYYY-MM-DD');

    // ─── Stats rapides ───
    const total        = interventions.length;
    const enCours      = interventions.filter(i => i.statut === 'en_cours').length;
    const terminees    = interventions.filter(i => i.statut === 'termine' || i.statut === 'valide').length;
    const ceJour       = interventions.filter(i =>
        dayjs(i.date_planifiee).format('YYYY-MM-DD') === aujourd_hui
    ).length;

    // ─── Interventions du mois affiché ───
    const intervsMois = interventions.filter(i =>
        dayjs(i.date_planifiee).month() === moisCourant.month() &&
        dayjs(i.date_planifiee).year()  === moisCourant.year()
    );

    // ─── Construction grille calendrier ───
    const buildCalendar = () => {
        const debut = moisCourant.startOf('month').startOf('isoWeek');
        const fin   = moisCourant.endOf('month').endOf('isoWeek');
        const semaines = [];
        let jour = debut;
        while (jour.isBefore(fin) || jour.isSame(fin, 'day')) {
            const semaine = [];
            for (let d = 0; d < 7; d++) {
                semaine.push(jour);
                jour = jour.add(1, 'day');
            }
            semaines.push(semaine);
        }
        return semaines;
    };

    const intervParJour = (dateStr) =>
        interventions.filter(i =>
            dayjs(i.date_planifiee).format('YYYY-MM-DD') === dateStr
        );

    // ─── Timeline triée ───
    const interventionsTriees = [...interventions].sort(
        (a, b) => new Date(a.date_planifiee) - new Date(b.date_planifiee)
    );

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={860}
            styles={{ body: { padding: 0 } }}
            title={null}
            style={{ top: 24 }}
        >
            {/* ─── HEADER ─── */}
            <div style={{
                background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
                padding: '24px 28px 20px',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 16
            }}>
                <Avatar
                    size={52}
                    style={{
                        background: '#FF8C00',
                        fontSize: 22,
                        fontWeight: 700,
                        flexShrink: 0,
                        boxShadow: '0 0 0 3px rgba(255,140,0,0.3)'
                    }}
                >
                    {technicien?.nom?.charAt(0)?.toUpperCase()}
                </Avatar>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
                        Planning — {technicien?.nom}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>
                        <Tag
                            color={couleurSpecialite[technicien?.specialite]}
                            style={{ borderRadius: 4, fontSize: 11 }}
                        >
                            {technicien?.specialite?.toUpperCase()}
                        </Tag>
                        {technicien?.telephone && (
                            <span style={{ marginLeft: 8 }}>📞 {technicien.telephone}</span>
                        )}
                    </div>
                </div>

                {/* Stats compactes */}
                {[
                    { label: 'Total',    val: total,     color: '#4fc3f7' },
                    { label: 'En cours', val: enCours,   color: '#fa8c16' },
                    { label: 'Terminées',val: terminees, color: '#52c41a' },
                    { label: "Auj.",     val: ceJour,    color: '#FF8C00' },
                ].map(s => (
                    <div key={s.label} style={{
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 10,
                        padding: '8px 16px',
                        minWidth: 64
                    }}>
                        <div style={{
                            color: s.color,
                            fontWeight: 800,
                            fontSize: 22,
                            lineHeight: 1
                        }}>
                            {s.val}
                        </div>
                        <div style={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: 11,
                            marginTop: 3
                        }}>
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── BODY ─── */}
            <div style={{ padding: '20px 28px 28px' }}>
                {loading ? (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '60px 0'
                    }}>
                        <Spin size="large" />
                    </div>
                ) : interventions.length === 0 ? (
                    <Empty
                        description="Aucune intervention planifiée"
                        style={{ padding: '40px 0' }}
                    />
                ) : (
                    <>
                        {/* Toggle vue */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 16
                        }}>
                            <Segmented
                                value={vueMode}
                                onChange={setVueMode}
                                options={[
                                    {
                                        label: '📅 Calendrier',
                                        value: 'calendrier'
                                    },
                                    {
                                        label: '📋 Liste',
                                        value: 'liste'
                                    },
                                ]}
                                style={{ fontWeight: 600 }}
                            />

                            {vueMode === 'calendrier' && (
                                <Space>
                                    <Button
                                        size="small"
                                        icon={<LeftOutlined />}
                                        onClick={() =>
                                            setMoisCourant(m => m.subtract(1, 'month'))
                                        }
                                        style={{ borderRadius: 6 }}
                                    />
                                    <span style={{
                                        fontWeight: 700,
                                        fontSize: 14,
                                        minWidth: 130,
                                        textAlign: 'center',
                                        textTransform: 'capitalize'
                                    }}>
                                        {moisCourant.format('MMMM YYYY')}
                                    </span>
                                    <Button
                                        size="small"
                                        icon={<RightOutlined />}
                                        onClick={() =>
                                            setMoisCourant(m => m.add(1, 'month'))
                                        }
                                        style={{ borderRadius: 6 }}
                                    />
                                    <Button
                                        size="small"
                                        onClick={() => setMoisCourant(dayjs())}
                                        style={{
                                            borderRadius: 6,
                                            background: '#FF8C0015',
                                            borderColor: '#FF8C00',
                                            color: '#FF8C00',
                                            fontWeight: 600
                                        }}
                                    >
                                        Aujourd'hui
                                    </Button>
                                </Space>
                            )}
                        </div>

                        {/* ─── VUE CALENDRIER ─── */}
                        {vueMode === 'calendrier' && (
                            <div>
                                {/* Jours semaine */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(7, 1fr)',
                                    gap: 3,
                                    marginBottom: 3
                                }}>
                                    {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map((j, i) => (
                                        <div key={j} style={{
                                            textAlign: 'center',
                                            fontWeight: 700,
                                            fontSize: 11,
                                            color: i >= 5 ? '#ff4d4f' : '#888',
                                            padding: '6px 0',
                                            textTransform: 'uppercase',
                                            letterSpacing: 1
                                        }}>
                                            {j}
                                        </div>
                                    ))}
                                </div>

                                {/* Grille jours */}
                                {buildCalendar().map((semaine, si) => (
                                    <div key={si} style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(7, 1fr)',
                                        gap: 3,
                                        marginBottom: 3
                                    }}>
                                        {semaine.map((jour, ji) => {
                                            const dateStr    = jour.format('YYYY-MM-DD');
                                            const estCeMois  = jour.month() === moisCourant.month();
                                            const estAujdhui = dateStr === aujourd_hui;
                                            const weekend    = ji >= 5;
                                            const intervs    = intervParJour(dateStr);

                                            return (
                                                <div key={ji} style={{
                                                    minHeight: 72,
                                                    padding: '5px 6px',
                                                    border: estAujdhui
                                                        ? '2px solid #FF8C00'
                                                        : `1px solid ${weekend ? '#fff2e8' : '#f0f0f0'}`,
                                                    borderRadius: 8,
                                                    background: estAujdhui
                                                        ? '#FFF8F0'
                                                        : weekend
                                                            ? '#fffaf6'
                                                            : estCeMois ? '#fff' : '#fafafa',
                                                    opacity: estCeMois ? 1 : 0.38,
                                                    transition: 'box-shadow 0.15s',
                                                }}>
                                                    <div style={{
                                                        fontWeight: estAujdhui ? 800 : 500,
                                                        color: estAujdhui
                                                            ? '#FF8C00'
                                                            : weekend ? '#fa541c' : '#333',
                                                        fontSize: 12,
                                                        marginBottom: 3
                                                    }}>
                                                        {jour.format('D')}
                                                    </div>
                                                    {intervs.map(i => (
                                                        <Tooltip
                                                            key={i.id}
                                                            title={
                                                                <div>
                                                                    <div style={{ fontWeight: 700 }}>
                                                                        {i.numero}
                                                                    </div>
                                                                    <div>{i.client_nom}</div>
                                                                    <div>
                                                                        {dayjs(i.date_planifiee).format('HH:mm')}
                                                                        {i.duree_estimee && ` — ${i.duree_estimee}h`}
                                                                    </div>
                                                                    <div>{typesService[i.type_service]}</div>
                                                                </div>
                                                            }
                                                        >
                                                            <div
                                                                onClick={() => setDetailOuvert(i)}
                                                                style={{
                                                                    padding: '2px 5px',
                                                                    borderRadius: 4,
                                                                    marginBottom: 2,
                                                                    fontSize: 10,
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    background: (couleurStatut[i.statut] || '#666') + '18',
                                                                    color: couleurStatut[i.statut] || '#666',
                                                                    borderLeft: `3px solid ${couleurStatut[i.statut] || '#666'}`,
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {dayjs(i.date_planifiee).format('HH:mm')} {i.client_nom}
                                                            </div>
                                                        </Tooltip>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}

                                {/* Légende statuts */}
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                    marginTop: 12,
                                    paddingTop: 12,
                                    borderTop: '1px solid #f0f0f0'
                                }}>
                                    {Object.entries(couleurStatut).map(([s, c]) => (
                                        <div key={s} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            fontSize: 11,
                                            color: '#666'
                                        }}>
                                            <div style={{
                                                width: 10, height: 10,
                                                borderRadius: 2,
                                                background: c
                                            }} />
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ─── VUE LISTE ─── */}
                        {vueMode === 'liste' && (
                            <div style={{ maxHeight: 480, overflowY: 'auto', paddingRight: 4 }}>
                                <Timeline
                                    items={interventionsTriees.map(i => {
                                        const d         = dayjs(i.date_planifiee);
                                        const estPasse  = d.isBefore(dayjs());
                                        const estAujdhui = d.format('YYYY-MM-DD') === aujourd_hui;
                                        const urg       = couleurUrgence[i.urgence] || couleurUrgence['normale'];

                                        return {
                                            color: couleurStatut[i.statut] || '#666',
                                            children: (
                                                <div
                                                    onClick={() => setDetailOuvert(i)}
                                                    style={{
                                                        background: estAujdhui ? '#FFF8F0' : '#fafafa',
                                                        border: estAujdhui
                                                            ? '1px solid #FF8C0055'
                                                            : '1px solid #f0f0f0',
                                                        borderRadius: 10,
                                                        padding: '10px 14px',
                                                        cursor: 'pointer',
                                                        marginBottom: 4,
                                                        transition: 'box-shadow 0.15s',
                                                    }}
                                                    onMouseEnter={e =>
                                                        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'
                                                    }
                                                    onMouseLeave={e =>
                                                        e.currentTarget.style.boxShadow = 'none'
                                                    }
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'flex-start'
                                                    }}>
                                                        <div>
                                                            <span style={{
                                                                color: '#FF8C00',
                                                                fontWeight: 700,
                                                                fontSize: 13
                                                            }}>
                                                                {i.numero}
                                                            </span>
                                                            <span style={{
                                                                color: '#333',
                                                                fontWeight: 600,
                                                                marginLeft: 8
                                                            }}>
                                                                {i.client_nom}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <span style={{
                                                                fontSize: 10,
                                                                fontWeight: 600,
                                                                padding: '2px 7px',
                                                                borderRadius: 10,
                                                                color: urg.color,
                                                                background: urg.bg,
                                                                border: `1px solid ${urg.border}`
                                                            }}>
                                                                {i.urgence?.toUpperCase()}
                                                            </span>
                                                            <Tag
                                                                color={couleurStatut[i.statut]}
                                                                style={{ borderRadius: 6, fontSize: 10, margin: 0 }}
                                                            >
                                                                {i.statut?.toUpperCase()}
                                                            </Tag>
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: 14,
                                                        marginTop: 5,
                                                        color: '#888',
                                                        fontSize: 12
                                                    }}>
                                                        <span>
                                                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                                                            <span style={{
                                                                color: estAujdhui ? '#FF8C00' :
                                                                    estPasse ? '#f5222d' : '#555',
                                                                fontWeight: estAujdhui ? 700 : 400
                                                            }}>
                                                                {d.format('ddd DD/MM/YYYY')} {d.format('HH:mm')}
                                                                {estAujdhui && (
                                                                    <span style={{
                                                                        marginLeft: 6,
                                                                        background: '#FF8C00',
                                                                        color: '#fff',
                                                                        padding: '1px 6px',
                                                                        borderRadius: 10,
                                                                        fontSize: 9,
                                                                        fontWeight: 700
                                                                    }}>
                                                                        AUJOURD'HUI
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </span>
                                                        {i.duree_estimee && (
                                                            <span>⏱ {i.duree_estimee}h</span>
                                                        )}
                                                        <span>{typesService[i.type_service]}</span>
                                                    </div>
                                                </div>
                                            )
                                        };
                                    })}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── SOUS-MODAL DÉTAIL INTERVENTION ─── */}
            <Modal
                open={!!detailOuvert}
                onCancel={() => setDetailOuvert(null)}
                footer={[
                    <Button key="close" onClick={() => setDetailOuvert(null)}>
                        Fermer
                    </Button>
                ]}
                width={440}
                title={
                    <Space>
                        <ToolOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>Détail intervention</span>
                        {detailOuvert && (
                            <Tag
                                color={couleurStatut[detailOuvert.statut]}
                                style={{ borderRadius: 6 }}
                            >
                                {detailOuvert.statut?.toUpperCase()}
                            </Tag>
                        )}
                    </Space>
                }
            >
                {detailOuvert && (
                    <>
                        <div style={{
                            background: '#FF8C0011',
                            border: '1px solid #FF8C0033',
                            borderRadius: 10,
                            padding: '14px 18px',
                            marginBottom: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            <ClockCircleOutlined style={{ fontSize: 22, color: '#FF8C00' }} />
                            <div>
                                <div style={{
                                    fontWeight: 700,
                                    fontSize: 15,
                                    color: '#FF8C00',
                                    textTransform: 'capitalize'
                                }}>
                                    {dayjs(detailOuvert.date_planifiee).format('dddd DD MMMM YYYY')}
                                </div>
                                <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
                                    {dayjs(detailOuvert.date_planifiee).format('HH:mm')}
                                    {detailOuvert.duree_estimee &&
                                        ` — Durée estimée : ${detailOuvert.duree_estimee}h`}
                                </div>
                            </div>
                        </div>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="N° Intervention">
                                <span style={{ color: '#FF8C00', fontWeight: 700 }}>
                                    {detailOuvert.numero}
                                </span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Client">
                                <Space>
                                    <UserOutlined />
                                    {detailOuvert.client_nom}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="Appareil">
                                {detailOuvert.appareil_info || 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Type">
                                {typesService[detailOuvert.type_service]}
                            </Descriptions.Item>
                            <Descriptions.Item label="Urgence">
                                {(() => {
                                    const c = couleurUrgence[detailOuvert.urgence] || couleurUrgence['normale'];
                                    return (
                                        <span style={{
                                            padding: '3px 10px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: c.color,
                                            background: c.bg,
                                            border: `1px solid ${c.border}`
                                        }}>
                                            {detailOuvert.urgence?.toUpperCase()}
                                        </span>
                                    );
                                })()}
                            </Descriptions.Item>
                            {detailOuvert.description && (
                                <Descriptions.Item label="Description">
                                    <span style={{ color: '#555', fontSize: 12 }}>
                                        {detailOuvert.description}
                                    </span>
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    </>
                )}
            </Modal>
        </Modal>
    );
};

// ════════════════════════════════
// ─── PAGE PRINCIPALE ───
// ════════════════════════════════
const Techniciens = () => {
    const [techniciens, setTechniciens]               = useState([]);
    const [loading, setLoading]                       = useState(true);
    const [search, setSearch]                         = useState('');
    const [filtreDisponible, setFiltreDisponible]     = useState('');
    const [filtreSpecialite, setFiltreSpecialite]     = useState('');
    const [modalCreer, setModalCreer]                 = useState(false);
    const [modalModifier, setModalModifier]           = useState(false);
    const [drawerDetail, setDrawerDetail]             = useState(false);
    const [modalPlanning, setModalPlanning]           = useState(false);
    const [technicienSelectionne, setTechnicienSelectionne] = useState(null);
    const [form]         = Form.useForm();
    const [formModifier] = Form.useForm();

    useEffect(() => {
        chargerTechniciens();
    }, [filtreDisponible, filtreSpecialite]);

    const chargerTechniciens = async () => {
        setLoading(true);
        try {
            let url = '/techniciens/?';
            if (filtreDisponible !== '')
                url += `disponible=${filtreDisponible}&`;
            const res = await api.get(url);
            setTechniciens(res.data);
        } catch {
            message.error('Erreur chargement techniciens');
        } finally {
            setLoading(false);
        }
    };

    const creerTechnicien = async (values) => {
        try {
            await api.post('/techniciens/', values);
            message.success('Technicien créé !');
            setModalCreer(false);
            form.resetFields();
            chargerTechniciens();
        } catch {
            message.error('Erreur création');
        }
    };

    const modifierTechnicien = async (values) => {
        try {
            await api.patch(`/techniciens/${technicienSelectionne.id}/`, values);
            message.success('Technicien modifié !');
            setModalModifier(false);
            chargerTechniciens();
        } catch {
            message.error('Erreur modification');
        }
    };

    const supprimerTechnicien = async (id) => {
        try {
            await api.delete(`/techniciens/${id}/`);
            message.success('Technicien supprimé !');
            chargerTechniciens();
        } catch {
            message.error('Erreur suppression');
        }
    };

    const ouvrirModifier = (t) => {
        setTechnicienSelectionne(t);
        formModifier.setFieldsValue(t);
        setModalModifier(true);
    };

    const ouvrirDetail = (t) => {
        setTechnicienSelectionne(t);
        setDrawerDetail(true);
    };

    const ouvrirPlanning = (t) => {
        setTechnicienSelectionne(t);
        setModalPlanning(true);
    };

    const techniciensFiltres = techniciens.filter(t =>
        t.nom?.toLowerCase().includes(search.toLowerCase()) ||
        t.specialite?.toLowerCase().includes(search.toLowerCase()) ||
        t.telephone?.includes(search)
    );

    // ─── FORMULAIRE ───
    const FormulaireTechnicien = ({ form, onFinish }) => (
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
            <Space style={{ width: '100%' }} size={12}>
                <Form.Item
                    label="Nom complet" name="nom"
                    rules={[{ required: true, message: 'Nom obligatoire' }]}
                    style={{ flex: 1 }}
                >
                    <Input
                        placeholder="Ahmed Alami"
                        prefix={<UserOutlined style={{ color: '#ccc' }} />}
                        style={{ borderRadius: 8 }}
                    />
                </Form.Item>
                <Form.Item label="Téléphone" name="telephone" style={{ flex: 1 }}>
                    <Input placeholder="0612345678" style={{ borderRadius: 8 }} />
                </Form.Item>
            </Space>
            <Space style={{ width: '100%' }} size={12}>
                <Form.Item
                    label="Spécialité" name="specialite"
                    rules={[{ required: true, message: 'Spécialité obligatoire' }]}
                    style={{ flex: 1 }}
                >
                    <Select placeholder="Choisir spécialité">
                        {specialites.map(s => (
                            <Option key={s.key} value={s.key}>
                                <Tag color={couleurSpecialite[s.key]}>{s.label}</Tag>
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
                <Form.Item
                    label="Tarif horaire (MAD)" name="tarif_horaire"
                    rules={[{ required: true, message: 'Tarif obligatoire' }]}
                    style={{ flex: 1 }}
                >
                    <InputNumber
                        min={0} placeholder="150"
                        style={{ width: '100%', borderRadius: 8 }}
                        addonAfter="MAD/h"
                    />
                </Form.Item>
            </Space>
            <Form.Item label="Compétences" name="competences">
                <Input.TextArea
                    rows={3}
                    placeholder="Ex: Réparation PC, Installation Windows..."
                    style={{ borderRadius: 8 }}
                />
            </Form.Item>
            <Form.Item
                label="Disponible" name="disponible"
                valuePropName="checked" initialValue={true}
            >
                <Switch
                    checkedChildren="Disponible"
                    unCheckedChildren="Indisponible"
                    style={{ background: '#FF8C00' }}
                />
            </Form.Item>
            <div style={{
                display: 'flex', justifyContent: 'flex-end',
                gap: 12, marginTop: 8
            }}>
                <Button style={{ borderRadius: 8 }} onClick={() => {
                    setModalCreer(false);
                    setModalModifier(false);
                    form.resetFields();
                }}>
                    Annuler
                </Button>
                <Button
                    type="primary" htmlType="submit"
                    style={{
                        background: '#FF8C00', borderColor: '#FF8C00',
                        borderRadius: 8, fontWeight: 600
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
            render: (nom, record) => (
                <Space>
                    <Badge
                        dot
                        color={record.disponible ? '#52c41a' : '#f5222d'}
                        offset={[-2, 32]}
                    >
                        <Avatar style={{ background: '#FF8C00', fontSize: 14, fontWeight: 700 }}>
                            {nom?.charAt(0)?.toUpperCase()}
                        </Avatar>
                    </Badge>
                    <span style={{ fontWeight: 600 }}>{nom}</span>
                </Space>
            )
        },
        {
            title: 'Spécialité',
            dataIndex: 'specialite',
            render: (s) => (
                <Tag color={couleurSpecialite[s]} style={{ borderRadius: 6 }}>
                    {s?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Téléphone',
            dataIndex: 'telephone',
            render: (tel) => tel || <span style={{ color: '#ccc' }}>N/A</span>
        },
        {
            title: 'Tarif/heure',
            dataIndex: 'tarif_horaire',
            render: (tarif) => (
                <span style={{ color: '#FF8C00', fontWeight: 700 }}>{tarif} MAD</span>
            )
        },
        {
            title: 'Compétences',
            dataIndex: 'competences',
            render: (comp) => comp ? (
                <span style={{ color: '#666', fontSize: 12 }}>
                    {comp.length > 40 ? comp.substring(0, 40) + '...' : comp}
                </span>
            ) : <span style={{ color: '#ccc' }}>Non renseigné</span>
        },
        {
            title: 'Disponibilité',
            dataIndex: 'disponible',
            render: (dispo) => dispo ? (
                <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span style={{ color: '#52c41a', fontWeight: 600 }}>Disponible</span>
                </Space>
            ) : (
                <Space>
                    <CloseCircleOutlined style={{ color: '#f5222d' }} />
                    <span style={{ color: '#f5222d', fontWeight: 600 }}>Indisponible</span>
                </Space>
            )
        },
        {
            title: 'Actions',
            width: 180,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir planning">
                        <Button
                            type="text"
                            icon={<CalendarOutlined />}
                            style={{
                                color: '#fff',
                                background: '#FF8C00',
                                borderRadius: 6,
                                fontWeight: 600,
                                fontSize: 12,
                                height: 28,
                                padding: '0 10px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                            onClick={() => ouvrirPlanning(record)}
                        >
                            Planning
                        </Button>
                    </Tooltip>
                    <Tooltip title="Voir détail">
                        <Button
                            type="text"
                            icon={<EyeOutlined />}
                            style={{ color: '#FF8C00' }}
                            onClick={() => ouvrirDetail(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Modifier">
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => ouvrirModifier(record)}
                        />
                    </Tooltip>
                    <Tooltip title="Supprimer">
                        <Popconfirm
                            title="Supprimer ce technicien ?"
                            onConfirm={() => supprimerTechnicien(record.id)}
                            okText="Oui" cancelText="Non"
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
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 24
            }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                        Techniciens
                    </h1>
                    <p style={{ color: '#999', margin: '4px 0 0', fontSize: 14 }}>
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
                        type="primary" icon={<PlusOutlined />} size="large"
                        onClick={() => setModalCreer(true)}
                        style={{
                            background: '#FF8C00', borderColor: '#FF8C00',
                            borderRadius: 10, fontWeight: 600, height: 44
                        }}
                    >
                        Nouveau technicien
                    </Button>
                </Space>
            </div>

            {/* ─── FILTRES ─── */}
            <Card bordered={false} style={{
                borderRadius: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                marginBottom: 16
            }}>
                <Space wrap>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                        placeholder="Rechercher par nom, spécialité ou téléphone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 340, borderRadius: 8 }}
                    />
                    <Select
                        placeholder="Spécialité" allowClear
                        style={{ width: 160 }}
                        onChange={setFiltreSpecialite}
                    >
                        {specialites.map(s => (
                            <Option key={s.key} value={s.key}>{s.label}</Option>
                        ))}
                    </Select>
                    <Select
                        placeholder="Disponibilité" allowClear
                        style={{ width: 160 }}
                        onChange={setFiltreDisponible}
                    >
                        <Option value="true">✅ Disponible</Option>
                        <Option value="false">❌ Indisponible</Option>
                    </Select>
                </Space>
            </Card>

            {/* ─── TABLEAU ─── */}
            <Card bordered={false} style={{
                borderRadius: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
            }}>
                <Table
                    columns={colonnes}
                    dataSource={techniciensFiltres}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showTotal: (t) => `${t} techniciens` }}
                />
            </Card>

            {/* ─── MODAL CRÉER ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>➕ Nouveau technicien</span>}
                open={modalCreer}
                onCancel={() => { setModalCreer(false); form.resetFields(); }}
                footer={null} width={560}
            >
                <FormulaireTechnicien form={form} onFinish={creerTechnicien} />
            </Modal>

            {/* ─── MODAL MODIFIER ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>✏️ Modifier technicien</span>}
                open={modalModifier}
                onCancel={() => { setModalModifier(false); formModifier.resetFields(); }}
                footer={null} width={560}
            >
                <FormulaireTechnicien form={formModifier} onFinish={modifierTechnicien} />
            </Modal>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <Space>
                        <Avatar style={{ background: '#FF8C00' }}>
                            {technicienSelectionne?.nom?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <span style={{ fontWeight: 700 }}>
                            {technicienSelectionne?.nom}
                        </span>
                    </Space>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={420}
                extra={
                    <Button
                        icon={<CalendarOutlined />}
                        style={{
                            background: '#FF8C00', borderColor: '#FF8C00',
                            color: '#fff', borderRadius: 8, fontWeight: 600
                        }}
                        onClick={() => {
                            setDrawerDetail(false);
                            setModalPlanning(true);
                        }}
                    >
                        Voir planning
                    </Button>
                }
            >
                {technicienSelectionne && (
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Nom">
                            {technicienSelectionne.nom}
                        </Descriptions.Item>
                        <Descriptions.Item label="Spécialité">
                            <Tag color={couleurSpecialite[technicienSelectionne.specialite]}>
                                {technicienSelectionne.specialite?.toUpperCase()}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Téléphone">
                            {technicienSelectionne.telephone || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Tarif horaire">
                            <span style={{ color: '#FF8C00', fontWeight: 700 }}>
                                {technicienSelectionne.tarif_horaire} MAD/h
                            </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Compétences">
                            {technicienSelectionne.competences || 'Non renseigné'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Disponibilité">
                            {technicienSelectionne.disponible ? '✅ Disponible' : '❌ Indisponible'}
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Drawer>

            {/* ─── MODAL PLANNING ─── */}
            <ModalPlanning
                technicien={technicienSelectionne}
                open={modalPlanning}
                onClose={() => setModalPlanning(false)}
            />
        </div>
    );
};

export default Techniciens;