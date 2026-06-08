// frontend/src/components/GestionImages.jsx
// CRÉER CE NOUVEAU FICHIER

import React, {
    useState, useEffect, useRef
} from 'react';
import {
    Button, message, Modal, Select,
    Input, Popconfirm, Empty, Spin,
    Tag, Progress
} from 'antd';
import {
    DeleteOutlined, EyeOutlined,
    CameraOutlined, FileImageOutlined,
    CloudUploadOutlined, ReloadOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Option } = Select;

const TYPES = {
    'avant': {
        label: 'Avant intervention',
        color: '#1890ff', emoji: '📷'
    },
    'apres': {
        label: 'Après intervention',
        color: '#52c41a', emoji: '✅'
    },
    'panne': {
        label: 'Photo de la panne',
        color: '#f5222d', emoji: '⚠️'
    },
    'piece': {
        label: 'Pièce de rechange',
        color: '#fa8c16', emoji: '🔩'
    },
    'document': {
        label: 'Document',
        color: '#722ed1', emoji: '📄'
    },
    'autre': {
        label: 'Autre',
        color: '#8c8c8c', emoji: '📎'
    },
};

const GestionImages = ({
    interventionId,
    readOnly = false
}) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] =
        useState(false);
    const [progress, setProgress] = useState(0);
    const [modalAjout, setModalAjout] =
        useState(false);
    const [imagePreview, setImagePreview] =
        useState(null);
    const [typeImage, setTypeImage] =
        useState('autre');
    const [description, setDescription] =
        useState('');
    const [fichier, setFichier] = useState(null);
    const [previewLocal, setPreviewLocal] =
        useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (interventionId) chargerImages();
    }, [interventionId]);

    // ─── CHARGER IMAGES ───
    const chargerImages = async () => {
        setLoading(true);
        try {
            const res = await api.get(
                `/interventions/`
                + `${interventionId}/images/`
            );
            setImages(res.data.images || []);
        } catch (error) {
            setImages([]);
        } finally {
            setLoading(false);
        }
    };

    // ─── SÉLECTIONNER FICHIER ───
    const selectionnerFichier = (e) => {
        const f = e.target.files[0];
        if (!f) return;

        const typesOk = [
            'image/jpeg', 'image/jpg',
            'image/png', 'image/webp'
        ];
        if (!typesOk.includes(
                f.type.toLowerCase())) {
            message.error(
                'Format non autorisé. '
                + 'JPG, PNG ou WEBP uniquement');
            return;
        }
        if (f.size > 5 * 1024 * 1024) {
            message.error('Max 5 Mo');
            return;
        }

        setFichier(f);
        setPreviewLocal(URL.createObjectURL(f));
    };

    // ─── UPLOADER ───
    const uploaderImage = async () => {
        if (!fichier) {
            message.warning(
                'Sélectionnez une image');
            return;
        }

        setUploading(true);
        setProgress(20);

        try {
            const formData = new FormData();
            // ✅ Nom exact : 'image'
            formData.append(
                'image', fichier, fichier.name);
            formData.append(
                'type_image', typeImage);
            formData.append(
                'description', description || '');

            setProgress(50);

            // ✅ Pas de headers Content-Type
            const res = await api.post(
                `/interventions/${interventionId}`
                + `/ajouter-image/`,
                formData
            );

            setProgress(100);
            message.success(
                '☁️ Image uploadée sur Cloudinary !');
            setModalAjout(false);
            resetForm();
            chargerImages();

        } catch (error) {
            message.error(
                error.response?.data?.erreur
                || 'Erreur upload');
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

    // ─── SUPPRIMER ───
    const supprimerImage = async (imageId) => {
        try {
            await api.delete(
                `/images/${imageId}/supprimer/`);
            message.success(
                'Image supprimée de Cloudinary');
            chargerImages();
        } catch {
            message.error('Erreur suppression');
        }
    };

    // ─── RESET ───
    const resetForm = () => {
        setFichier(null);
        setPreviewLocal(null);
        setTypeImage('autre');
        setDescription('');
        setProgress(0);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    // ─── Grouper par type ───
    const imagesParType = images.reduce(
        (acc, img) => {
            const t = img.type_image || 'autre';
            if (!acc[t]) acc[t] = [];
            acc[t].push(img);
            return acc;
        }, {}
    );

    return (
        <div>

            {/* ─── HEADER ─── */}
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
                    <span style={{
                        fontWeight: 700,
                        fontSize: 13
                    }}>
                        📸 Photos
                    </span>
                    <span style={{
                        background: '#f0f0f0',
                        borderRadius: 10,
                        padding: '1px 8px',
                        fontSize: 11,
                        color: '#666',
                        fontWeight: 600
                    }}>
                        {images.length}
                    </span>
                    <span style={{
                        background: '#e6f7ff',
                        color: '#1890ff',
                        borderRadius: 10,
                        padding: '1px 8px',
                        fontSize: 10,
                        fontWeight: 700
                    }}>
                        ☁️ Cloudinary
                    </span>
                </div>

                <div style={{
                    display: 'flex', gap: 6
                }}>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={chargerImages}
                        style={{ borderRadius: 6 }}
                    />
                    {!readOnly && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<CameraOutlined />}
                            onClick={() => {
                                setModalAjout(true);
                                resetForm();
                            }}
                            style={{
                                background: '#FF8C00',
                                borderColor: '#FF8C00',
                                borderRadius: 8,
                                fontWeight: 600
                            }}
                        >
                            Ajouter
                        </Button>
                    )}
                </div>
            </div>

            {/* ─── CONTENU ─── */}
            {loading ? (
                <div style={{
                    textAlign: 'center', padding: 20
                }}>
                    <Spin size="small" />
                </div>
            ) : images.length === 0 ? (
                <Empty
                    image={
                        Empty.PRESENTED_IMAGE_SIMPLE
                    }
                    description={
                        <span style={{
                            fontSize: 12,
                            color: '#ccc'
                        }}>
                            {readOnly
                                ? 'Aucune photo'
                                : 'Cliquez "Ajouter" '
                                  + 'pour ajouter des photos'}
                        </span>
                    }
                    style={{ padding: '12px 0' }}
                />
            ) : (
                Object.entries(imagesParType)
                    .map(([type, imgs]) => (
                    <div key={type}
                         style={{ marginBottom: 14 }}>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6, marginBottom: 8
                        }}>
                            <span style={{ fontSize: 14 }}>
                                {TYPES[type]?.emoji
                                 || '📎'}
                            </span>
                            <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: TYPES[type]
                                    ?.color || '#666'
                            }}>
                                {TYPES[type]?.label
                                 || type}
                            </span>
                            <span style={{
                                fontSize: 10,
                                color: '#ccc'
                            }}>
                                ({imgs.length})
                            </span>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns:
                                'repeat(3, 1fr)',
                            gap: 8
                        }}>
                            {imgs.map(img => (
                                <div
                                    key={img.id}
                                    style={{
                                        position:
                                            'relative',
                                        borderRadius:
                                            10,
                                        overflow:
                                            'hidden',
                                        border:
                                            '1px solid'
                                            + ' #f0f0f0',
                                        cursor:
                                            'pointer',
                                        background:
                                            '#f8f9fa'
                                    }}
                                    onClick={() =>
                                        setImagePreview(
                                            img)
                                    }
                                >
                                    {/* thumbnail_url = miniature CDN */}
                                    <img
                                        src={
                                            img.thumbnail_url
                                            || img.image_url
                                        }
                                        alt={
                                            img.description
                                            || type
                                        }
                                        style={{
                                            width: '100%',
                                            height: 90,
                                            objectFit:
                                                'cover',
                                            display:
                                                'block'
                                        }}
                                        onError={e => {
                                            e.target.src =
                                                img.image_url;
                                        }}
                                    />

                                    {/* Boutons overlay */}
                                    <div style={{
                                        position:
                                            'absolute',
                                        top: 4,
                                        right: 4,
                                        display:
                                            'flex',
                                        gap: 3
                                    }}>
                                        <Button
                                            size="small"
                                            icon={
                                                <EyeOutlined />
                                            }
                                            style={{
                                                background:
                                                    'rgba(0,0,0,0.5)',
                                                border:
                                                    'none',
                                                color:
                                                    '#fff',
                                                padding:
                                                    '0 5px',
                                                height: 22
                                            }}
                                            onClick={e => {
                                                e.stopPropagation();
                                                setImagePreview(
                                                    img);
                                            }}
                                        />
                                        {!readOnly && (
                                            <Popconfirm
                                                title="Supprimer ?"
                                                onConfirm={e => {
                                                    supprimerImage(
                                                        img.id);
                                                }}
                                                okText="Oui"
                                                cancelText="Non"
                                                okButtonProps={{
                                                    danger: true
                                                }}
                                            >
                                                <Button
                                                    size="small"
                                                    icon={
                                                        <DeleteOutlined />
                                                    }
                                                    style={{
                                                        background:
                                                            'rgba(245,34,45,0.8)',
                                                        border:
                                                            'none',
                                                        color:
                                                            '#fff',
                                                        padding:
                                                            '0 5px',
                                                        height: 22
                                                    }}
                                                    onClick={e =>
                                                        e.stopPropagation()
                                                    }
                                                />
                                            </Popconfirm>
                                        )}
                                    </div>

                                    {img.description && (
                                        <div style={{
                                            padding:
                                                '3px 6px',
                                            fontSize: 9,
                                            color: '#666',
                                            background:
                                                '#fff',
                                            overflow:
                                                'hidden',
                                            textOverflow:
                                                'ellipsis',
                                            whiteSpace:
                                                'nowrap'
                                        }}>
                                            {img.description}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {/* ─── MODAL AJOUTER ─── */}
            <Modal
                title={
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <CloudUploadOutlined
                            style={{
                                color: '#1890ff'
                            }}
                        />
                        <span style={{
                            fontWeight: 700
                        }}>
                            Ajouter une photo
                        </span>
                        <Tag color="blue"
                             style={{ fontSize: 10 }}>
                            ☁️ Cloudinary
                        </Tag>
                    </div>
                }
                open={modalAjout}
                onCancel={() => {
                    if (!uploading) {
                        setModalAjout(false);
                        resetForm();
                    }
                }}
                footer={null}
                width={460}
                maskClosable={!uploading}
            >
                <div style={{ marginTop: 16 }}>

                    {/* Type */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{
                            fontWeight: 600,
                            fontSize: 12,
                            display: 'block',
                            marginBottom: 6
                        }}>
                            Type de photo
                        </label>
                        <Select
                            value={typeImage}
                            onChange={setTypeImage}
                            style={{ width: '100%' }}
                            disabled={uploading}
                        >
                            {Object.entries(TYPES)
                                .map(([k, v]) => (
                                <Option key={k} value={k}>
                                    {v.emoji}{' '}
                                    <span style={{
                                        color: v.color,
                                        fontWeight: 600
                                    }}>
                                        {v.label}
                                    </span>
                                </Option>
                            ))}
                        </Select>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{
                            fontWeight: 600,
                            fontSize: 12,
                            display: 'block',
                            marginBottom: 6
                        }}>
                            Description
                            <span style={{
                                color: '#ccc',
                                fontWeight: 400,
                                marginLeft: 6,
                                fontSize: 11
                            }}>
                                (optionnel)
                            </span>
                        </label>
                        <Input
                            placeholder="Décrivez la photo..."
                            value={description}
                            onChange={e =>
                                setDescription(
                                    e.target.value)
                            }
                            disabled={uploading}
                            style={{ borderRadius: 8 }}
                        />
                    </div>

                    {/* Zone sélection fichier */}
                    <div style={{ marginBottom: 14 }}>
                        <label style={{
                            fontWeight: 600,
                            fontSize: 12,
                            display: 'block',
                            marginBottom: 6
                        }}>
                            Photo
                        </label>

                        <div
                            onClick={() => {
                                if (!uploading) {
                                    inputRef.current
                                        ?.click();
                                }
                            }}
                            style={{
                                border: `2px dashed ${
                                    fichier
                                        ? '#52c41a'
                                        : '#d9d9d9'
                                }`,
                                borderRadius: 12,
                                padding: 16,
                                textAlign: 'center',
                                cursor: uploading
                                    ? 'not-allowed'
                                    : 'pointer',
                                background: fichier
                                    ? '#f6ffed'
                                    : '#fafafa',
                                transition: 'all 0.2s'
                            }}
                        >
                            {previewLocal ? (
                                <div>
                                    <img
                                        src={previewLocal}
                                        alt="aperçu"
                                        style={{
                                            maxHeight: 160,
                                            maxWidth:
                                                '100%',
                                            borderRadius:
                                                8,
                                            objectFit:
                                                'contain'
                                        }}
                                    />
                                    <div style={{
                                        marginTop: 8,
                                        fontSize: 11,
                                        color: '#52c41a',
                                        fontWeight: 600
                                    }}>
                                        ✅ {fichier?.name}
                                        {' · '}
                                        {(
                                            (fichier?.size
                                             || 0)
                                            / 1024
                                        ).toFixed(0)} Ko
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <FileImageOutlined
                                        style={{
                                            fontSize: 36,
                                            color: '#ccc',
                                            display:
                                                'block',
                                            marginBottom:
                                                8
                                        }}
                                    />
                                    <div style={{
                                        color: '#666',
                                        fontSize: 13,
                                        fontWeight: 500
                                    }}>
                                        Cliquez pour
                                        choisir
                                    </div>
                                    <div style={{
                                        color: '#ccc',
                                        fontSize: 11,
                                        marginTop: 4
                                    }}>
                                        JPG · PNG · WEBP
                                        · Max 5 Mo
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input fichier caché */}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={
                                selectionnerFichier
                            }
                        />
                    </div>

                    {/* Barre progression */}
                    {uploading && (
                        <div style={{
                            marginBottom: 14
                        }}>
                            <div style={{
                                fontSize: 11,
                                color: '#1890ff',
                                fontWeight: 600,
                                marginBottom: 6
                            }}>
                                ☁️ Upload vers
                                Cloudinary...
                            </div>
                            <Progress
                                percent={progress}
                                status="active"
                                strokeColor="#1890ff"
                                size="small"
                            />
                        </div>
                    )}

                    {/* Boutons */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10
                    }}>
                        <Button
                            onClick={() => {
                                setModalAjout(false);
                                resetForm();
                            }}
                            disabled={uploading}
                            style={{ borderRadius: 8 }}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="primary"
                            icon={
                                <CloudUploadOutlined />
                            }
                            loading={uploading}
                            disabled={!fichier}
                            onClick={uploaderImage}
                            style={{
                                background: '#FF8C00',
                                borderColor: '#FF8C00',
                                borderRadius: 8,
                                fontWeight: 700
                            }}
                        >
                            {uploading
                                ? 'Upload...'
                                : 'Envoyer sur Cloud'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ─── MODAL PLEIN ÉCRAN ─── */}
            <Modal
                open={!!imagePreview}
                onCancel={() =>
                    setImagePreview(null)
                }
                footer={null}
                width={750}
                title={
                    imagePreview && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <span style={{
                                fontSize: 16
                            }}>
                                {TYPES[
                                    imagePreview
                                        .type_image
                                ]?.emoji}
                            </span>
                            <Tag color={
                                TYPES[
                                    imagePreview
                                        .type_image
                                ]?.color
                            }>
                                {TYPES[
                                    imagePreview
                                        .type_image
                                ]?.label}
                            </Tag>
                            {imagePreview
                                .description && (
                                <span style={{
                                    fontSize: 12,
                                    color: '#666'
                                }}>
                                    {imagePreview
                                        .description}
                                </span>
                            )}
                        </div>
                    )
                }
            >
                {imagePreview && (
                    <div style={{
                        textAlign: 'center'
                    }}>
                        {/* image_url = HD Cloudinary */}
                        <img
                            src={
                                imagePreview.image_url
                            }
                            alt={
                                imagePreview
                                    .description
                                || 'image'
                            }
                            style={{
                                maxWidth: '100%',
                                maxHeight: '70vh',
                                borderRadius: 10,
                                objectFit: 'contain'
                            }}
                        />
                        <div style={{
                            marginTop: 10,
                            fontSize: 11,
                            color: '#ccc'
                        }}>
                            Ajouté le{' '}
                            {new Date(
                                imagePreview.date_ajout
                            ).toLocaleDateString(
                                'fr-FR',
                                {
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric'
                                }
                            )}
                            {' · '}
                            <span style={{
                                color: '#1890ff',
                                fontWeight: 600
                            }}>
                                ☁️ Cloudinary CDN
                            </span>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default GestionImages;