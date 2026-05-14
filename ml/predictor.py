# ml/predictor.py
"""
ÉTAPE 3 : MODULE DE PRÉDICTION
================================
Ce module charge les modèles entraînés UNE SEULE FOIS
au démarrage de Django, puis les utilise pour chaque
requête de diagnostic.

Utilisation :
    from ml.predictor import predire
    resultat = predire("L'écran reste noir", techniciens)
"""

import joblib
import re
import os
import json

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

# ══════════════════════════════════════════════════
# ─── CHARGEMENT DES MODÈLES AU DÉMARRAGE ───
# Les modèles sont chargés UNE SEULE FOIS en mémoire
# pour éviter de les recharger à chaque requête
# ══════════════════════════════════════════════════

def _charger_modeles():
    fichiers = {
        'categorie':    'modele_categorie.joblib',
        'type_service': 'modele_type_service.joblib',
        'urgence':      'modele_urgence.joblib',
        'origine':      'modele_origine.joblib',
        'specialite':   'modele_specialite.joblib',
    }
    modeles = {}
    for nom, fichier in fichiers.items():
        chemin = os.path.join(MODELS_DIR, fichier)
        if not os.path.exists(chemin):
            raise FileNotFoundError(
                f"Modèle manquant : {chemin}\n"
                f"→ Lancez : python ml/train_models.py"
            )
        modeles[nom] = joblib.load(chemin)
    return modeles

try:
    MODELES = _charger_modeles()
    MODELES_OK = True
    print("✅ Modèles IA chargés avec succès")
except FileNotFoundError as e:
    print(f"⚠️  {e}")
    MODELES = {}
    MODELES_OK = False

# ── Prétraitement identique à l'entraînement ──
def _pretraiter(texte):
    texte = str(texte).lower()
    texte = re.sub(r'[^\w\s\'\-]', ' ', texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    return texte

# ── Pièces suggérées par catégorie/type ──
PIECES_MAP = {
    ('hardware', 'reparation'): [
        'Disque dur HDD 1TB', 'Disque SSD 256GB',
        'RAM DDR4 8GB', 'Alimentation 500W',
        'Ventilateur CPU', 'Pâte thermique',
    ],
    ('hardware', 'maintenance'): [
        'Pâte thermique', 'Spray air comprimé',
    ],
    ('reseau', 'installation'): [
        'Câble RJ45 10m', 'Connecteurs RJ45',
        'Switch 8 ports',
    ],
    ('reseau', 'configuration'): ['Câble RJ45 5m'],
    ('reseau', 'depannage'):     ['Câble RJ45 5m'],
}

# ══════════════════════════════════════════════════
# ─── FONCTION PRINCIPALE DE PRÉDICTION ───
# ══════════════════════════════════════════════════

def predire(description, techniciens_disponibles=None):
    """
    Analyse une description et retourne le diagnostic complet.

    Paramètres :
        description (str) : texte du problème client
        techniciens_disponibles (list) : liste de dicts
            [{'id':1, 'nom':'Ali', 'specialite':'Hardware', ...}]

    Retourne (dict) :
        categorie, type_service, urgence,
        origine_probleme, specialite_requise,
        pieces_suggerees, technicien_recommande,
        confiance
    """
    if not MODELES_OK:
        return {
            'erreur': (
                'Modèles IA non disponibles. '
                'Lancez python ml/train_models.py'
            )
        }

    if not description or len(description.strip()) < 5:
        return {'erreur': 'Description trop courte'}

    desc = _pretraiter(description)

    # ── Prédictions ──
    categorie    = MODELES['categorie'].predict([desc])[0]
    type_service = MODELES['type_service'].predict([desc])[0]
    urgence      = MODELES['urgence'].predict([desc])[0]
    origine      = MODELES['origine'].predict([desc])[0]
    specialite   = MODELES['specialite'].predict([desc])[0]

    # ── Probabilités (niveau de confiance) ──
    def confiance(modele, label):
        classes = modele.classes_.tolist()
        probas  = modele.predict_proba([desc])[0]
        idx     = classes.index(label)
        return round(float(probas[idx]) * 100, 1)

    conf_categorie    = confiance(MODELES['categorie'], categorie)
    conf_type_service = confiance(MODELES['type_service'], type_service)
    conf_urgence      = confiance(MODELES['urgence'], urgence)

    # ── Pièces suggérées ──
    pieces = PIECES_MAP.get((categorie, type_service), [])

    # ── Technicien recommandé ──
    technicien_recommande = None
    if techniciens_disponibles:
        # Priorité 1 : spécialité exacte + disponible
        experts = [
            t for t in techniciens_disponibles
            if t.get('specialite') == specialite
            and t.get('disponible', True)
        ]
        # Priorité 2 : Généraliste disponible
        generalistes = [
            t for t in techniciens_disponibles
            if t.get('specialite') == 'Généraliste'
            and t.get('disponible', True)
        ]

        if experts:
            technicien_recommande = experts[0]
        elif generalistes:
            technicien_recommande = generalistes[0]

    return {
        'categorie':              categorie,
        'type_service':           type_service,
        'urgence':                urgence,
        'origine_probleme':       origine,
        'specialite_requise':     specialite,
        'pieces_suggerees':       pieces,
        'technicien_recommande':  technicien_recommande,
        'confiance': {
            'categorie':    conf_categorie,
            'type_service': conf_type_service,
            'urgence':      conf_urgence,
        }
    }