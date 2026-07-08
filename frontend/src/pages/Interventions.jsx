import React, { useState, useEffect, useCallback } from 'react';
import {
    Table, Card, Button, Tag, Input, Select,
    Space, Modal, Form, message, Tooltip,
    Popconfirm, DatePicker, Drawer, Descriptions,
    InputNumber, Divider, Alert, Result, Steps,
    Spin, Badge
} from 'antd';
import {
    PlusOutlined, SearchOutlined, EyeOutlined,
    DeleteOutlined, FilterOutlined, SwapOutlined,
    UserAddOutlined, ReloadOutlined, CheckCircleOutlined,
    RobotOutlined, BulbOutlined, ToolOutlined,
    ThunderboltOutlined, UserOutlined, ArrowRightOutlined,
    SafetyOutlined, ShoppingOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import api from '../services/api';
import GestionImages from '../components/GestionImages';

const { Option } = Select;
const { TextArea } = Input;

// ══════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════

const COULEUR_STATUT = {
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

const COULEUR_URGENCE = {
    'faible':   { color: '#52c41a', bg: '#f6ffed' },
    'normale':  { color: '#1890ff', bg: '#e6f7ff' },
    'haute':    { color: '#fa8c16', bg: '#fff7e6' },
    'critique': { color: '#f5222d', bg: '#fff1f0' },
};

const ICONE_URGENCE = {
    'faible':   '🟢',
    'normale':  '🔵',
    'haute':    '🟠',
    'critique': '🔴',
};

const TYPES_SERVICE = {
    'reparation':    '🔧 Réparation',
    'installation':  '💿 Installation',
    'configuration': '⚙️ Configuration',
    'maintenance':   '🔩 Maintenance',
    'depannage':     '🛠️ Dépannage',
};

const COULEUR_CATEGORIE = {
    'hardware': '#722ed1',
    'software': '#1890ff',
    'reseau':   '#13c2c2',
};

// ══════════════════════════════════════════════════
// COMPOSANT RÉSULTAT DIAGNOSTIC (NOUVELLE VERSION)
// ══════════════════════════════════════════════════

const ResultatDiagnostic = ({
    diagnostic,
    technicienChoisi,
    onChoisirTechnicien
}) => {
    const [voirTousTech, setVoirTousTech] = useState(false);

    if (!diagnostic) return null;

    const urgCouleur = COULEUR_URGENCE[diagnostic.urgence] || { color: '#666', bg: '#f0f0f0' };

    return (
        <div style={{
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16
        }}>

            {/* HEADER */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <RobotOutlined style={{
                        color: '#52c41a',
                        fontSize: 18
                    }} />
                    <span style={{
                        fontWeight: 700,
                        color: '#52c41a',
                        fontSize: 14
                    }}>
                        Diagnostic IA
                    </span>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#fff',
                    padding: '3px 10px',
                    borderRadius: 20,
                    border: '1px solid #b7eb8f'
                }}>
                    <span style={{
                        fontSize: 11,
                        color: '#666'
                    }}>
                        Confiance :
                    </span>
                    <span style={{
                        fontWeight: 800,
                        fontSize: 13,
                        color: diagnostic.confiance?.globale >= 70
                            ? '#52c41a'
                            : '#fa8c16'
                    }}>
                        {diagnostic.confiance?.globale}%
                    </span>
                </div>
            </div>

            {/* Alert */}
            <Alert
                message={
                    <span style={{ fontSize: 12 }}>
                        ✅ Les champs ont été pré-remplis. Vérifiez et modifiez si nécessaire.
                    </span>
                }
                type="success"
                style={{
                    borderRadius: 8,
                    marginBottom: 12,
                    padding: '5px 10px'
                }}
            />

            {/* PRÉDICTIONS GRILLE */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: 12
            }}>
                {[
                    {
                        label: 'CATÉGORIE',
                        value: diagnostic.categorie?.toUpperCase(),
                        color: '#1890ff',
                        bg: '#e6f7ff',
                        conf: diagnostic.confiance?.categorie
                    },
                    {
                        label: 'URGENCE',
                        value: ICONE_URGENCE[diagnostic.urgence] + ' ' + diagnostic.urgence?.toUpperCase(),
                        color: urgCouleur.color,
                        bg: urgCouleur.bg,
                        conf: diagnostic.confiance?.urgence
                    },
                    {
                        label: 'TYPE SERVICE',
                        value: diagnostic.type_service?.toUpperCase(),
                        color: '#722ed1',
                        bg: '#f9f0ff',
                        conf: diagnostic.confiance?.type_service
                    },
                    {
                        label: 'DURÉE EST.',
                        value: `⏱️ ${diagnostic.duree}h`,
                        color: '#FF8C00',
                        bg: '#FFF3E0',
                        conf: null
                    }
                ].map((item, i) => (
                    <div key={i} style={{
                        padding: '8px 10px',
                        background: item.bg,
                        borderRadius: 8,
                        textAlign: 'center'
                    }}>
                        <div style={{
                            fontSize: 9,
                            color: '#999',
                            fontWeight: 700,
                            marginBottom: 3,
                            letterSpacing: 0.5
                        }}>
                            {item.label}
                        </div>
                        <div style={{
                            fontWeight: 700,
                            color: item.color,
                            fontSize: 11
                        }}>
                            {item.value}
                        </div>
                        {item.conf && (
                            <div style={{
                                fontSize: 9,
                                color: '#ccc',
                                marginTop: 2
                            }}>
                                {item.conf}%
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ORIGINE DU PROBLÈME */}
            {diagnostic.origine_probleme && (
                <div style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 10,
                    border: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8
                }}>
                    <ThunderboltOutlined style={{
                        color: '#faad14',
                        marginTop: 2,
                        flexShrink: 0
                    }} />
                    <div>
                        <div style={{
                            fontSize: 10,
                            color: '#faad14',
                            fontWeight: 700,
                            marginBottom: 2
                        }}>
                            ORIGINE DU PROBLÈME
                        </div>
                        <div style={{
                            fontSize: 12,
                            color: '#333'
                        }}>
                            {diagnostic.origine_probleme}
                        </div>
                    </div>
                </div>
            )}

            {/* SOLUTION PROPOSÉE */}
            {diagnostic.solution && (
                <div style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 10,
                    border: '2px solid #FF8C00',
                }}>
                    <div style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#FF8C00',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        <BulbOutlined style={{ fontSize: 14 }} />
                        Solution recommandée
                        <Badge
                            count="IA"
                            style={{
                                background: '#FF8C00',
                                fontSize: 9
                            }}
                        />
                    </div>
                    <div style={{
                        fontSize: 13,
                        color: '#333',
                        lineHeight: 1.6,
                        fontWeight: 500
                    }}>
                        {diagnostic.solution}
                    </div>
                    {diagnostic.confiance?.solution && (
                        <div style={{
                            fontSize: 10,
                            color: '#ccc',
                            marginTop: 6
                        }}>
                            Confiance solution : {diagnostic.confiance.solution}%
                        </div>
                    )}
                </div>
            )}

            {/* PIÈCES + PRÉVENTION */}
            {(diagnostic.pieces_suggerees?.length > 0 || diagnostic.prevention) && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    marginBottom: 12
                }}>

                    {/* Pièces */}
                    {diagnostic.pieces_suggerees?.length > 0 && (
                        <div style={{
                            background: '#fff7e6',
                            borderRadius: 8,
                            padding: '10px 12px',
                            border: '1px solid #ffd591'
                        }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: 11,
                                color: '#fa8c16',
                                marginBottom: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <ShoppingOutlined />
                                Pièces suggérées
                            </div>
                            {diagnostic.pieces_suggerees.map((p, i) => (
                                <div key={i} style={{
                                    fontSize: 11,
                                    color: '#333',
                                    padding: '2px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <span style={{
                                        color: '#fa8c16',
                                        fontWeight: 700
                                    }}>•</span>
                                    {p}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Prévention */}
                    {diagnostic.prevention && (
                        <div style={{
                            background: '#fffbe6',
                            borderRadius: 8,
                            padding: '10px 12px',
                            border: '1px solid #ffe58f'
                        }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: 11,
                                color: '#faad14',
                                marginBottom: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <SafetyOutlined />
                                Conseil préventif
                            </div>
                            <div style={{
                                fontSize: 11,
                                color: '#666',
                                lineHeight: 1.5
                            }}>
                                {diagnostic.prevention}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TECHNICIEN RECOMMANDÉ */}
            {diagnostic.technicien_recommande && (
                <div style={{
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 14px',
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: '#1A1A1A',
                        marginBottom: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <UserOutlined style={{ color: '#722ed1' }} />
                            Technicien recommandé
                        </div>
                        <Button
                            size="small"
                            type="text"
                            onClick={() => setVoirTousTech(!voirTousTech)}
                            style={{
                                fontSize: 11,
                                color: '#1890ff'
                            }}
                        >
                            {voirTousTech ? 'Masquer' : `Voir tous (${diagnostic.tous_techniciens?.length || 0})`}
                        </Button>
                    </div>

                    {/* Technicien principal */}
                    {(() => {
                        const tech = diagnostic.technicien_recommande;
                        const estChoisi = technicienChoisi === tech.id;
                        return (
                            <div
                                onClick={() => onChoisirTechnicien(tech.id, tech.nom)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    background: estChoisi ? '#e6f7ff' : '#f6ffed',
                                    border: estChoisi ? '2px solid #1890ff' : '1px solid #b7eb8f',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    marginBottom: voirTousTech ? 10 : 0
                                }}
                            >
                                {/* Avatar */}
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: '50%',
                                    background: '#52c41a22',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 20,
                                    flexShrink: 0
                                }}>
                                    👨‍🔧
                                </div>

                                {/* Infos */}
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginBottom: 3
                                    }}>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: 13
                                        }}>
                                            {tech.nom}
                                        </span>
                                        <Tag style={{
                                            fontSize: 10,
                                            borderRadius: 6
                                        }}>
                                            {tech.specialite}
                                        </Tag>
                                        <span style={{
                                            background: '#52c41a22',
                                            color: '#52c41a',
                                            borderRadius: 10,
                                            padding: '1px 8px',
                                            fontSize: 10,
                                            fontWeight: 700
                                        }}>
                                            ⭐ IA
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: 11,
                                        color: '#666',
                                        lineHeight: 1.4
                                    }}>
                                        {tech.explication}
                                    </div>
                                </div>

                                {/* Score */}
                                <div style={{
                                    textAlign: 'center',
                                    minWidth: 52
                                }}>
                                    <div style={{
                                        fontSize: 22,
                                        fontWeight: 900,
                                        color: tech.score >= 80 ? '#52c41a' : '#1890ff',
                                        lineHeight: 1
                                    }}>
                                        {tech.score}
                                    </div>
                                    <div style={{
                                        fontSize: 10,
                                        color: '#999'
                                    }}>
                                        /100
                                    </div>
                                </div>

                                {estChoisi && (
                                    <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                                )}
                            </div>
                        );
                    })()}

                    {/* Tous les techniciens */}
                    {voirTousTech && diagnostic.tous_techniciens?.length > 0 && (
                        <div>
                            <Divider style={{ margin: '8px 0', fontSize: 11, color: '#ccc' }}>
                                Classement complet
                            </Divider>

                            {diagnostic.tous_techniciens.map((tech, i) => (
                                <div
                                    key={tech.id}
                                    onClick={() => onChoisirTechnicien(tech.id, tech.nom)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        marginBottom: 4,
                                        background: technicienChoisi === tech.id ? '#e6f7ff' : '#fafafa',
                                        border: technicienChoisi === tech.id ? '2px solid #1890ff' : '1px solid #f0f0f0',
                                        opacity: tech.disponible ? 1 : 0.6
                                    }}
                                >
                                    {/* Rang */}
                                    <div style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: '50%',
                                        background: i === 0 ? '#52c41a' : i === 1 ? '#1890ff' : '#d9d9d9',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        flexShrink: 0
                                    }}>
                                        {i + 1}
                                    </div>

                                    {/* Infos */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6
                                        }}>
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: 12
                                            }}>
                                                {tech.nom}
                                            </span>
                                            <span style={{
                                                background: '#f0f0f0',
                                                borderRadius: 6,
                                                padding: '1px 6px',
                                                fontSize: 10,
                                                color: '#666'
                                            }}>
                                                {tech.specialite}
                                            </span>
                                            {!tech.disponible && (
                                                <span style={{
                                                    color: '#f5222d',
                                                    fontSize: 10
                                                }}>
                                                    Indispo
                                                </span>
                                            )}
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            gap: 8,
                                            marginTop: 2
                                        }}>
                                            <span style={{
                                                fontSize: 10,
                                                color: tech.charge_color || '#52c41a',
                                                fontWeight: 600
                                            }}>
                                                {tech.charge}
                                            </span>
                                            <span style={{
                                                fontSize: 10,
                                                color: '#ccc'
                                            }}>
                                                {tech.interventions_en_cours} en cours
                                            </span>
                                        </div>
                                    </div>

                                    {/* Score */}
                                    <div style={{
                                        textAlign: 'center',
                                        minWidth: 44
                                    }}>
                                        <div style={{
                                            fontSize: 16,
                                            fontWeight: 800,
                                            color: tech.score >= 80 ? '#52c41a' : tech.score >= 60 ? '#1890ff' : '#fa8c16',
                                            lineHeight: 1
                                        }}>
                                            {tech.score}
                                        </div>
                                        <div style={{
                                            fontSize: 9,
                                            color: '#ccc'
                                        }}>
                                            /100
                                        </div>
                                    </div>

                                    {technicienChoisi === tech.id && (
                                        <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                                    )}
                                </div>
                            ))}

                            <div style={{
                                fontSize: 10,
                                color: '#ccc',
                                textAlign: 'center',
                                marginTop: 6
                            }}>
                                Cliquez pour sélectionner
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════

const Interventions = () => {
    // États existants
    const [interventions, setInterventions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filtreStatut, setFiltreStatut] = useState('');
    const [filtreUrgence, setFiltreUrgence] = useState('');
    const [filtreType, setFiltreType] = useState('');
    const [modalCreer, setModalCreer] = useState(false);
    const [modalStatut, setModalStatut] = useState(false);
    const [modalAssigner, setModalAssigner] = useState(false);
    const [modalValidation, setModalValidation] = useState(false);
    const [drawerDetail, setDrawerDetail] = useState(false);
    const [interventionSelectionnee, setInterventionSelectionnee] = useState(null);
    const [clients, setClients] = useState([]);
    const [techniciens, setTechniciens] = useState([]);
    const [appareils, setAppareils] = useState([]);
    const [transitions, setTransitions] = useState([]);
    const [validationResult, setValidationResult] = useState(null);
    const [validating, setValidating] = useState(false);
    const [disponibilite, setDisponibilite] = useState(null);
    const [checkingDispo, setCheckingDispo] = useState(false);

    // ─── NOUVEAUX ÉTATS DIAGNOSTIC IA ───
    const [diagnostic, setDiagnostic] = useState(null);
    const [loadingDiag, setLoadingDiag] = useState(false);
    const [technicienChoisi, setTechnicienChoisi] = useState(null);
    const [nomTechChoisi, setNomTechChoisi] = useState('');

    const [form] = Form.useForm();
    const [formStatut] = Form.useForm();
    const [formAssigner] = Form.useForm();

    // ════════════════════════════════════
    // ─── CHARGEMENT DONNÉES ───
    // ════════════════════════════════════

    const chargerInterventions = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/interventions/?';
            if (filtreStatut)  url += `statut=${filtreStatut}&`;
            if (filtreUrgence) url += `urgence=${filtreUrgence}&`;
            if (filtreType)    url += `type_service=${filtreType}&`;
            const res = await api.get(url);
            setInterventions(res.data);
        } catch {
            message.error('Erreur chargement interventions');
        } finally {
            setLoading(false);
        }
    }, [filtreStatut, filtreUrgence, filtreType]);

    const chargerClients = useCallback(async () => {
        try {
            const res = await api.get('/clients/');
            setClients(res.data);
        } catch {}
    }, []);

    const chargerTechniciens = useCallback(async () => {
        try {
            const res = await api.get('/techniciens/');
            setTechniciens(res.data);
        } catch {}
    }, []);

    useEffect(() => {
        chargerInterventions();
        chargerClients();
        chargerTechniciens();
    }, [chargerInterventions, chargerClients, chargerTechniciens]);

    const chargerAppareils = async (clientId) => {
        if (!clientId) {
            setAppareils([]);
            return;
        }
        try {
            const res = await api.get(`/appareils/?client_id=${clientId}`);
            setAppareils(res.data);
        } catch {
            setAppareils([]);
        }
    };

    const chargerTransitions = async (id) => {
        try {
            const res = await api.get(`/interventions/${id}/transitions/`);
            setTransitions(res.data.transitions_possibles);
        } catch {}
    };

    // ════════════════════════════════════
    // ─── DIAGNOSTIC IA (NOUVELLE VERSION) ───
    // ════════════════════════════════════

    const lancerDiagnostic = async () => {
        const values = form.getFieldsValue();
        const description = values.description;

        if (!description || description.trim().length < 5) {
            message.warning('Saisissez une description (minimum 5 caractères)');
            return;
        }

        setLoadingDiag(true);
        setDiagnostic(null);
        setTechnicienChoisi(null);
        setNomTechChoisi('');

        try {
            const res = await api.post('/diagnostic/analyser/', {
                description: description
            });

            const diag = res.data.diagnostic;
            setDiagnostic(diag);

            // Pré-remplir le formulaire
            form.setFieldsValue({
                type_service: diag.type_service,
                urgence:      diag.urgence,
                duree_estimee: diag.duree,
            });

            // Sélectionner technicien recommandé
            if (diag.technicien_recommande) {
                const tech = diag.technicien_recommande;
                setTechnicienChoisi(tech.id);
                setNomTechChoisi(tech.nom);
                form.setFieldsValue({
                    technicien_id: tech.id
                });
            }

            message.success('🤖 Diagnostic IA généré !');

        } catch (error) {
            message.error(
                error.response?.data?.erreur || 'Erreur diagnostic IA'
            );
        } finally {
            setLoadingDiag(false);
        }
    };

    const onChoisirTechnicien = (id, nom) => {
        setTechnicienChoisi(id);
        setNomTechChoisi(nom);
        form.setFieldsValue({
            technicien_id: id
        });
        message.info(`✅ Technicien sélectionné : ${nom}`);
    };

    const reinitialiserModal = () => {
        setModalCreer(false);
        setDiagnostic(null);
        setTechnicienChoisi(null);
        setNomTechChoisi('');
        form.resetFields();
    };

    // ════════════════════════════════════
    // ─── CRÉER INTERVENTION ───
    // ════════════════════════════════════

    const creerIntervention = async (values) => {
        try {
            const data = {
                ...values,
                technicien_id: technicienChoisi,
                // Joint le diagnostic IA (s'il a été généré) pour qu'il soit
                // enregistré dans interventions_diagnosticia côté serveur.
                diagnostic: diagnostic || undefined,
            };
            await api.post('/interventions/', data);
            message.success('✅ Intervention créée !');
            reinitialiserModal();
            chargerInterventions();
        } catch (error) {
            message.error(
                error.response?.data?.erreur || 'Erreur création'
            );
        }
    };

    // ════════════════════════════════════
    // ─── AUTRES ACTIONS ───
    // ════════════════════════════════════

    const supprimerIntervention = async (id) => {
        try {
            await api.delete(`/interventions/${id}/`);
            message.success('Intervention supprimée !');
            chargerInterventions();
        } catch {
            message.error('Erreur suppression');
        }
    };

    const changerStatut = async (values) => {
        try {
            await api.post(
                `/interventions/${interventionSelectionnee.id}/changer-statut/`,
                { statut: values.statut }
            );
            message.success('Statut mis à jour !');
            setModalStatut(false);
            formStatut.resetFields();
            chargerInterventions();
        } catch {
            message.error('Transition non autorisée');
        }
    };

    const validerInterventionAvecFacture = async () => {
        setValidating(true);
        try {
            const res = await api.post(
                `/interventions/${interventionSelectionnee.id}/valider-generer-facture/`
            );
            setValidationResult(res.data);
            message.success('Intervention validée et facture générée !');
            chargerInterventions();
        } catch (e) {
            message.error(
                e.response?.data?.erreur || 'Erreur lors de la validation'
            );
        } finally {
            setValidating(false);
        }
    };

    const verifierDisponibilite = async (values) => {
        if (!values.technicien_id || !values.date_planifiee) return;
        setCheckingDispo(true);
        setDisponibilite(null);
        try {
            const res = await api.post('/techniciens/verifier-disponibilite/', {
                technicien_id: values.technicien_id,
                date_planifiee: values.date_planifiee.toISOString(),
                duree_estimee: values.duree_estimee || 1,
                intervention_id: interventionSelectionnee?.id
            });
            setDisponibilite(res.data);
        } catch {
            setDisponibilite(null);
        } finally {
            setCheckingDispo(false);
        }
    };

    const assignerTechnicien = async (values) => {
        if (!disponibilite?.disponible) {
            message.warning('Vérifiez d\'abord la disponibilité !');
            return;
        }
        try {
            await api.post(
                `/interventions/${interventionSelectionnee.id}/assigner-technicien/`,
                {
                    technicien_id: values.technicien_id,
                    date_planifiee: values.date_planifiee?.toISOString(),
                    duree_estimee: values.duree_estimee
                }
            );
            message.success('Technicien assigné !');
            setModalAssigner(false);
            setDisponibilite(null);
            formAssigner.resetFields();
            chargerInterventions();
        } catch (e) {
            message.error(
                e.response?.data?.message || 'Erreur assignation'
            );
        }
    };

    const ouvrirModalStatut = async (intervention) => {
        setInterventionSelectionnee(intervention);
        await chargerTransitions(intervention.id);
        setModalStatut(true);
    };

    const ouvrirDetail = async (intervention) => {
        try {
            const res = await api.get(`/interventions/${intervention.id}/`);
            setInterventionSelectionnee(res.data);
            setDrawerDetail(true);
        } catch {}
    };

    // ════════════════════════════════════
    // ─── CONSTANTES UI ───
    // ════════════════════════════════════

    const interventionsFiltrees = interventions.filter(i =>
        i.numero?.toLowerCase().includes(search.toLowerCase()) ||
        i.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
        i.technicien_nom?.toLowerCase().includes(search.toLowerCase())
    );

    // ════════════════════════════════════
    // ─── COLONNES ───
    // ════════════════════════════════════

    const colonnes = [
        {
            title: 'Numéro',
            dataIndex: 'numero',
            width: 140,
            render: (text) => (
                <span style={{
                    color: '#FF8C00', fontWeight: 700, fontSize: 13
                }}>
                    {text}
                </span>
            )
        },
        {
            title: 'Client',
            dataIndex: 'client_nom',
            render: (text) => (
                <span style={{ fontWeight: 500 }}>{text}</span>
            )
        },
        {
            title: 'Technicien',
            dataIndex: 'technicien_nom',
            render: (text) => text ? (
                <span style={{ fontWeight: 500 }}>{text}</span>
            ) : (
                <span style={{ color: '#ccc', fontSize: 12 }}>Non assigné</span>
            )
        },
        {
            title: 'Type',
            dataIndex: 'type_service',
            render: (text) => TYPES_SERVICE[text] || text
        },
        {
            title: 'Urgence',
            dataIndex: 'urgence',
            render: (urgence) => {
                const c = COULEUR_URGENCE[urgence] || COULEUR_URGENCE['normale'];
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 20,
                        fontSize: 12, fontWeight: 600,
                        color: c.color, background: c.bg
                    }}>
                        {ICONE_URGENCE[urgence]} {urgence?.toUpperCase()}
                    </span>
                );
            }
        },
        {
            title: 'Statut',
            dataIndex: 'statut',
            render: (statut) => (
                <Tag color={COULEUR_STATUT[statut]}
                     style={{ borderRadius: 6, fontWeight: 500 }}>
                    {statut?.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Canal',
            dataIndex: 'canal_entree',
            render: (canal) => ({
                'telephone': '📞 Téléphone',
                'boutique':  '🏪 Boutique',
                'email':     '✉️ Email'
            }[canal] || canal)
        },
        {
            title: 'Date',
            dataIndex: 'date_creation',
            render: (date) => new Date(date).toLocaleDateString('fr-FR')
        },
        {
            title: 'Actions',
            width: 240,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Voir détail">
                        <Button type="text" icon={<EyeOutlined />}
                            style={{ color: '#FF8C00' }}
                            onClick={() => ouvrirDetail(record)} />
                    </Tooltip>
                    <Tooltip title="Changer statut">
                        <Button type="text" icon={<SwapOutlined />}
                            style={{ color: '#722ed1' }}
                            onClick={() => ouvrirModalStatut(record)} />
                    </Tooltip>
                    <Tooltip title="Assigner technicien">
                        <Button type="text" icon={<UserAddOutlined />}
                            style={{ color: '#1890ff' }}
                            onClick={() => {
                                setInterventionSelectionnee(record);
                                setModalAssigner(true);
                            }} />
                    </Tooltip>
                    {record.statut === 'termine' && (
                        <Tooltip title="Valider et générer facture">
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                style={{
                                    background: '#52c41a',
                                    borderColor: '#52c41a',
                                    fontWeight: 500
                                }}
                                onClick={() => {
                                    setInterventionSelectionnee(record);
                                    setValidationResult(null);
                                    setModalValidation(true);
                                }}
                            >
                                Valider
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip title="Supprimer">
                        <Popconfirm
                            title="Supprimer cette intervention ?"
                            description="Cette action est irréversible."
                            onConfirm={() => supprimerIntervention(record.id)}
                            okText="Oui" cancelText="Non"
                            okButtonProps={{ danger: true }}
                        >
                            <Button type="text" icon={<DeleteOutlined />}
                                style={{ color: '#f5222d' }} />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            )
        },
    ];

    // ════════════════════════════════════
    // ─── RENDER ───
    // ════════════════════════════════════

    return (
        <div style={{ padding: 28 }}>

            {/* ─── TITRE ─── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', marginBottom: 24
            }}>
                <div>
                    <h1 style={{
                        fontSize: 24, fontWeight: 700,
                        color: '#1A1A1A', margin: 0
                    }}>
                        Interventions
                    </h1>
                    <p style={{ color: '#999', margin: '4px 0 0', fontSize: 14 }}>
                        {interventionsFiltrees.length} résultat(s)
                    </p>
                </div>
                <Space>
                    <Button icon={<ReloadOutlined />}
                        onClick={chargerInterventions}
                        style={{ borderRadius: 10 }}>
                        Actualiser
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size="large"
                        onClick={() => {
                            setModalCreer(true);
                            form.resetFields();
                            setDiagnostic(null);
                            setTechnicienChoisi(null);
                            setNomTechChoisi('');
                        }}
                        style={{
                            background: '#FF8C00',
                            borderColor: '#FF8C00',
                            borderRadius: 10,
                            fontWeight: 600, height: 44
                        }}
                    >
                        Nouvelle intervention
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
                        placeholder="Rechercher par numéro, client ou technicien..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        allowClear
                        style={{ width: 320, borderRadius: 8 }}
                    />
                    <Select placeholder="Statut" allowClear
                        style={{ width: 160 }} onChange={setFiltreStatut}
                        suffixIcon={<FilterOutlined />}>
                        {['nouveau','diagnostique','assigne','en_cours',
                          'attente_pieces','termine','valide','facture','cloture']
                            .map(s => (
                            <Option key={s} value={s}>
                                <Tag color={COULEUR_STATUT[s]} style={{ borderRadius: 4 }}>
                                    {s.toUpperCase()}
                                </Tag>
                            </Option>
                        ))}
                    </Select>
                    <Select placeholder="Urgence" allowClear
                        style={{ width: 140 }} onChange={setFiltreUrgence}>
                        {['faible','normale','haute','critique'].map(u => (
                            <Option key={u} value={u}>
                                {ICONE_URGENCE[u]} {u.toUpperCase()}
                            </Option>
                        ))}
                    </Select>
                    <Select placeholder="Type de service" allowClear
                        style={{ width: 180 }} onChange={setFiltreType}>
                        {Object.entries(TYPES_SERVICE).map(([k, v]) => (
                            <Option key={k} value={k}>{v}</Option>
                        ))}
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
                    dataSource={interventionsFiltrees}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1300 }}
                    pagination={{
                        pageSize: 10,
                        showTotal: (total) => `${total} interventions`,
                        showSizeChanger: true,
                    }}
                />
            </Card>

            {/* ════════════════════════════════════════
                ─── MODAL CRÉER (AVEC DIAGNOSTIC IA AMÉLIORÉ) ───
                ════════════════════════════════════════ */}
            <Modal
                title={
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                    }}>
                        <PlusOutlined style={{ color: '#FF8C00' }} />
                        <span style={{ fontWeight: 700 }}>
                            Nouvelle intervention
                        </span>
                        {diagnostic && (
                            <Tag color="success" icon={<RobotOutlined />}>
                                Diagnostic IA
                            </Tag>
                        )}
                    </div>
                }
                open={modalCreer}
                onCancel={reinitialiserModal}
                footer={null}
                width={700}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={creerIntervention}
                    style={{ marginTop: 16 }}
                >
                    {/* ── Client & Appareil ── */}
                    <div style={{
                        background: '#f8f9fa',
                        borderRadius: 10,
                        padding: '14px 16px',
                        marginBottom: 14
                    }}>
                        <div style={{
                            fontWeight: 700,
                            fontSize: 13,
                            marginBottom: 12
                        }}>
                            👤 Client & Appareil
                        </div>
                        <Space style={{ width: '100%' }} size={12}>
                            <Form.Item
                                label="Client"
                                name="client_id"
                                rules={[{
                                    required: true,
                                    message: 'Sélectionnez un client'
                                }]}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <Select
                                    placeholder="Choisir..."
                                    showSearch
                                    filterOption={(input, opt) =>
                                        opt.children?.toString()
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    onChange={chargerAppareils}
                                >
                                    {clients.map(c => (
                                        <Option key={c.id} value={c.id}>
                                            {c.nom} — {c.telephone}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                label="Appareil"
                                name="appareil_id"
                                style={{ flex: 1, margin: 0 }}
                            >
                                <Select
                                    placeholder="Optionnel"
                                    allowClear
                                >
                                    {appareils.map(a => (
                                        <Option key={a.id} value={a.id}>
                                            {a.marque} {a.modele}
                                            {a.numero_serie && ` — ${a.numero_serie}`}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Space>
                    </div>

                    {/* ── Description + Bouton IA ── */}
                    <div style={{
                        background: '#f8f9fa',
                        borderRadius: 10,
                        padding: '14px 16px',
                        marginBottom: 14
                    }}>
                        <div style={{
                            fontWeight: 700,
                            fontSize: 13,
                            marginBottom: 12
                        }}>
                            📝 Description du problème
                        </div>

                        <Form.Item
                            name="description"
                            rules={[{
                                required: true,
                                message: 'Description obligatoire'
                            }]}
                            style={{ margin: 0 }}
                        >
                            <TextArea
                                rows={4}
                                placeholder="Décrivez le problème du client en détail..."
                                style={{ borderRadius: 8 }}
                            />
                        </Form.Item>

                        <Button
                            type="dashed"
                            icon={loadingDiag ? <Spin size="small" /> : <RobotOutlined />}
                            loading={loadingDiag}
                            onClick={lancerDiagnostic}
                            style={{
                                marginTop: 10,
                                width: '100%',
                                borderRadius: 8,
                                borderColor: '#FF8C00',
                                color: '#FF8C00',
                                fontWeight: 600,
                                height: 44
                            }}
                        >
                            {loadingDiag
                                ? 'Analyse en cours...'
                                : '🤖 Analyser avec l\'IA — Solution + Technicien'}
                        </Button>
                    </div>

                    {/* ── Résultat diagnostic (NOUVEAU COMPOSANT) ── */}
                    {diagnostic && (
                        <ResultatDiagnostic
                            diagnostic={diagnostic}
                            technicienChoisi={technicienChoisi}
                            onChoisirTechnicien={onChoisirTechnicien}
                        />
                    )}

                    {/* ── Détails intervention ── */}
                    <div style={{
                        background: '#f8f9fa',
                        borderRadius: 10,
                        padding: '14px 16px',
                        marginBottom: 14
                    }}>
                        <div style={{
                            fontWeight: 700,
                            fontSize: 13,
                            marginBottom: 4
                        }}>
                            ⚙️ Détails
                            {diagnostic && (
                                <span style={{
                                    fontSize: 11,
                                    color: '#52c41a',
                                    fontWeight: 400,
                                    marginLeft: 8
                                }}>
                                    (pré-rempli par IA)
                                </span>
                            )}
                        </div>

                        <Space style={{ width: '100%', marginTop: 12 }} size={12}>
                            <Form.Item
                                label="Type service"
                                name="type_service"
                                rules={[{
                                    required: true,
                                    message: 'Obligatoire'
                                }]}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <Select placeholder="Type">
                                    {Object.entries(TYPES_SERVICE).map(([k, v]) => (
                                        <Option key={k} value={k}>{v}</Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item
                                label="Urgence"
                                name="urgence"
                                initialValue="normale"
                                style={{ flex: 1, margin: 0 }}
                            >
                                <Select>
                                    <Option value="faible">🟢 Faible</Option>
                                    <Option value="normale">🔵 Normale</Option>
                                    <Option value="haute">🟠 Haute</Option>
                                    <Option value="critique">🔴 Critique</Option>
                                </Select>
                            </Form.Item>
                        </Space>

                        <Space style={{ width: '100%', marginTop: 12 }} size={12}>
                            <Form.Item
                                label="Canal"
                                name="canal_entree"
                                rules={[{
                                    required: true,
                                    message: 'Obligatoire'
                                }]}
                                style={{ flex: 1, margin: 0 }}
                            >
                                <Select placeholder="Canal">
                                    <Option value="telephone">📞 Téléphone</Option>
                                    <Option value="boutique">🏪 Boutique</Option>
                                    <Option value="email">✉️ Email</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item
                                label="Durée estimée"
                                name="duree_estimee"
                                style={{ flex: 1, margin: 0 }}
                            >
                                <InputNumber
                                    min={0.5}
                                    step={0.5}
                                    style={{ width: '100%', borderRadius: 8 }}
                                    addonAfter="h"
                                />
                            </Form.Item>
                        </Space>

                        {/* Technicien sélectionné */}
                        {technicienChoisi && (
                            <div style={{
                                marginTop: 10,
                                padding: '8px 12px',
                                background: '#e6f7ff',
                                borderRadius: 8,
                                border: '1px solid #91d5ff',
                                fontSize: 12,
                                color: '#1890ff',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}>
                                <CheckCircleOutlined />
                                Technicien sélectionné : {nomTechChoisi}
                            </div>
                        )}
                    </div>

                    {/* ── Boutons ── */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12
                    }}>
                        <Button
                            style={{ borderRadius: 8 }}
                            onClick={reinitialiserModal}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<PlusOutlined />}
                            style={{
                                background: '#FF8C00',
                                borderColor: '#FF8C00',
                                borderRadius: 8,
                                fontWeight: 600
                            }}
                        >
                            Créer l'intervention
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL CHANGER STATUT ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>🔄 Changer le statut</span>}
                open={modalStatut}
                onCancel={() => { setModalStatut(false); formStatut.resetFields(); }}
                footer={null} width={400}
            >
                {interventionSelectionnee && (
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ color: '#666' }}>
                            Intervention :
                            <strong style={{ color: '#FF8C00', marginLeft: 8 }}>
                                {interventionSelectionnee.numero}
                            </strong>
                        </p>
                        <p style={{ color: '#666' }}>
                            Statut actuel :
                            <Tag color={COULEUR_STATUT[interventionSelectionnee.statut]}
                                 style={{ marginLeft: 8 }}>
                                {interventionSelectionnee.statut?.toUpperCase()}
                            </Tag>
                        </p>
                    </div>
                )}
                <Form form={formStatut} layout="vertical" onFinish={changerStatut}>
                    <Form.Item label="Nouveau statut" name="statut"
                        rules={[{ required: true, message: 'Choisissez un statut' }]}>
                        <Select placeholder="Choisir le nouveau statut">
                            {transitions.map(t => (
                                <Option key={t} value={t}>
                                    <Tag color={COULEUR_STATUT[t]}>{t.toUpperCase()}</Tag>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => { setModalStatut(false); formStatut.resetFields(); }}>
                            Annuler
                        </Button>
                        <Button type="primary" htmlType="submit"
                            style={{ background: '#722ed1', borderColor: '#722ed1', borderRadius: 8 }}>
                            Confirmer
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── MODAL VALIDATION ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>✅ Validation de l'intervention</span>}
                open={modalValidation}
                onCancel={() => { setModalValidation(false); setValidationResult(null); }}
                footer={null} width={520}
            >
                {!validationResult ? (
                    <>
                        {interventionSelectionnee && (
                            <div style={{ marginBottom: 20 }}>
                                <Alert type="info" showIcon
                                    message="Confirmation de validation"
                                    description={
                                        <div style={{ marginTop: 8 }}>
                                            <p>Intervention : <strong>{interventionSelectionnee.numero}</strong></p>
                                            <p>Client : <strong>{interventionSelectionnee.client_nom}</strong></p>
                                            <p>Statut actuel : <Tag color="success">TERMINE</Tag></p>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <p style={{ marginBottom: 0 }}>
                                                L'intervention passera en statut <strong>VALIDÉ</strong> et une{' '}
                                                <strong>facture sera générée automatiquement</strong>.
                                            </p>
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }}
                                />
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button onClick={() => setModalValidation(false)}>Annuler</Button>
                            <Button type="primary" icon={<CheckCircleOutlined />}
                                onClick={validerInterventionAvecFacture}
                                loading={validating}
                                style={{
                                    background: '#52c41a',
                                    borderColor: '#52c41a',
                                    borderRadius: 8, fontWeight: 600
                                }}>
                                Valider et générer la facture
                            </Button>
                        </div>
                    </>
                ) : (
                    <Result
                        status="success"
                        title="Intervention validée avec succès !"
                        subTitle={
                            <div style={{ marginTop: 8 }}>
                                <p>La facture a été générée automatiquement.</p>
                                <div style={{
                                    background: '#f6ffed', padding: 12,
                                    borderRadius: 8, marginTop: 16, textAlign: 'left'
                                }}>
                                    <p><strong>📄 Facture :</strong> {validationResult.facture?.numero}</p>
                                    <p><strong>💰 Total TTC :</strong> {parseFloat(validationResult.facture?.total_ttc).toFixed(2)} MAD</p>
                                    <p><strong>📊 Statut :</strong> {validationResult.facture?.statut?.toUpperCase()}</p>
                                </div>
                            </div>
                        }
                        extra={[
                            <Button key="close" type="primary"
                                onClick={() => { setModalValidation(false); setValidationResult(null); }}
                                style={{ background: '#FF8C00', borderColor: '#FF8C00' }}>
                                Fermer
                            </Button>
                        ]}
                    />
                )}
            </Modal>

            {/* ─── MODAL ASSIGNER TECHNICIEN ─── */}
            <Modal
                title={<span style={{ fontWeight: 700 }}>👤 Assigner un technicien</span>}
                open={modalAssigner}
                onCancel={() => {
                    setModalAssigner(false);
                    setDisponibilite(null);
                    formAssigner.resetFields();
                }}
                footer={null} width={480}
            >
                <Form
                    form={formAssigner}
                    layout="vertical"
                    onFinish={assignerTechnicien}
                    style={{ marginTop: 16 }}
                    onValuesChange={() => setDisponibilite(null)}
                >
                    <Form.Item label="Technicien" name="technicien_id"
                        rules={[{ required: true, message: 'Choisissez un technicien' }]}>
                        <Select placeholder="Choisir un technicien" showSearch
                            filterOption={(input, option) =>
                                option.children.toLowerCase().includes(input.toLowerCase())
                            }>
                            {techniciens.map(t => (
                                <Option key={t.id} value={t.id}>
                                    {t.nom} — {t.specialite}{t.disponible ? ' ✅' : ' ❌'}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item label="Date planifiée" name="date_planifiee"
                        rules={[{ required: true, message: 'Date obligatoire' }]}>
                        <DatePicker showTime style={{ width: '100%', borderRadius: 8 }}
                            placeholder="Choisir date et heure"
                            format="DD/MM/YYYY HH:mm"
                            disabledDate={(c) => c && c.day() === 0}
                            disabledTime={(date) => {
                                if (!date) return {};
                                const isSam = date.day() === 6;
                                return {
                                    disabledHours: () => {
                                        const h = [];
                                        for (let i = 0; i < 8; i++) h.push(i);
                                        if (!isSam) { h.push(13, 14); for (let i = 19; i < 24; i++) h.push(i); }
                                        else { for (let i = 13; i < 24; i++) h.push(i); }
                                        return h;
                                    }
                                };
                            }}
                        />
                    </Form.Item>

                    <Form.Item label="Durée estimée (heures)" name="duree_estimee"
                        initialValue={1}
                        rules={[{ required: true, message: 'Durée obligatoire' }]}>
                        <InputNumber min={0.5} max={8} step={0.5}
                            style={{ width: '100%', borderRadius: 8 }} addonAfter="h" />
                    </Form.Item>

                    <Form.Item>
                        <Button type="default" icon={<CheckCircleOutlined />}
                            loading={checkingDispo}
                            onClick={() => verifierDisponibilite(formAssigner.getFieldsValue())}
                            style={{
                                width: '100%', borderRadius: 8,
                                borderColor: '#1890ff', color: '#1890ff', fontWeight: 600
                            }}>
                            Vérifier la disponibilité
                        </Button>
                    </Form.Item>

                    {disponibilite && (
                        <div style={{ marginBottom: 16 }}>
                            {disponibilite.disponible ? (
                                <Alert type="success" showIcon
                                    message="Technicien disponible ✅"
                                    description={
                                        <div>
                                            <div>{disponibilite.message}</div>
                                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                                Début : {disponibilite.date_debut} — Fin : {disponibilite.date_fin}
                                            </div>
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }} />
                            ) : (
                                <Alert type="error" showIcon
                                    message="Technicien non disponible ❌"
                                    description={
                                        <div>
                                            <div>{disponibilite.message}</div>
                                            {disponibilite.suggestion && (
                                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                                    💡 {disponibilite.suggestion}
                                                </div>
                                            )}
                                            {disponibilite.conflits?.map((c, i) => (
                                                <div key={i} style={{
                                                    background: '#fff2f0', padding: '4px 8px',
                                                    borderRadius: 4, marginTop: 4, fontSize: 12
                                                }}>
                                                    🔴 {c.numero} — {c.client} : {c.debut} → {c.fin}
                                                </div>
                                            ))}
                                        </div>
                                    }
                                    style={{ borderRadius: 8 }} />
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={() => {
                            setModalAssigner(false);
                            setDisponibilite(null);
                            formAssigner.resetFields();
                        }}>Annuler</Button>
                        <Button type="primary" htmlType="submit"
                            disabled={!disponibilite?.disponible}
                            style={{
                                background: disponibilite?.disponible ? '#1890ff' : '#d9d9d9',
                                borderColor: disponibilite?.disponible ? '#1890ff' : '#d9d9d9',
                                borderRadius: 8, fontWeight: 600
                            }}>
                            Assigner
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* ─── DRAWER DÉTAIL ─── */}
            <Drawer
                title={
                    <span style={{ fontWeight: 700 }}>
                        Détail intervention —
                        <span style={{ color: '#FF8C00', marginLeft: 8 }}>
                            {interventionSelectionnee?.numero}
                        </span>
                    </span>
                }
                open={drawerDetail}
                onClose={() => setDrawerDetail(false)}
                width={520}
            >
                {interventionSelectionnee && (
                    <div>
                        <Descriptions column={1} bordered size="small">
                            <Descriptions.Item label="Statut">
                                <Tag color={COULEUR_STATUT[interventionSelectionnee.statut]}>
                                    {interventionSelectionnee.statut?.toUpperCase()}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="Client">
                                {interventionSelectionnee.client?.nom}
                            </Descriptions.Item>
                            <Descriptions.Item label="Téléphone">
                                {interventionSelectionnee.client?.telephone}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">
                                {interventionSelectionnee.client?.email || 'Non renseigné'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Appareil">
                                {interventionSelectionnee.appareil
                                    ? `${interventionSelectionnee.appareil.marque} ${interventionSelectionnee.appareil.modele}`
                                    : 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Technicien">
                                {interventionSelectionnee.technicien?.nom || 'Non assigné'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Type">
                                {TYPES_SERVICE[interventionSelectionnee.type_service]}
                            </Descriptions.Item>
                            <Descriptions.Item label="Urgence">
                                {interventionSelectionnee.urgence?.toUpperCase()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Canal">
                                {interventionSelectionnee.canal_entree}
                            </Descriptions.Item>
                            <Descriptions.Item label="Description">
                                {interventionSelectionnee.description}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date création">
                                {new Date(interventionSelectionnee.date_creation)
                                    .toLocaleDateString('fr-FR')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date planifiée">
                                {interventionSelectionnee.date_planifiee
                                    ? new Date(interventionSelectionnee.date_planifiee)
                                        .toLocaleDateString('fr-FR')
                                    : 'Non planifiée'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Durée estimée">
                                {interventionSelectionnee.duree_estimee
                                    ? `${interventionSelectionnee.duree_estimee}h`
                                    : 'N/A'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Notes technicien">
                                {interventionSelectionnee.notes_technicien || 'Aucune note'}
                            </Descriptions.Item>
                        </Descriptions>

                        {interventionSelectionnee.pieces_utilisees?.length > 0 && (
                            <>
                                <Divider>Pièces utilisées</Divider>
                                {interventionSelectionnee.pieces_utilisees.map((p, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '8px 0',
                                        borderBottom: '1px solid #f0f0f0'
                                    }}>
                                        <span>{p.piece_nom}</span>
                                        <span style={{ color: '#FF8C00', fontWeight: 600 }}>
                                            x{p.quantite} — {p.sous_total} MAD
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}

                        <Divider>Photos</Divider>
                        <GestionImages
                            interventionId={interventionSelectionnee?.id}
                            interventionNumero={interventionSelectionnee?.numero}
                            readOnly={true}
                        />
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Interventions;