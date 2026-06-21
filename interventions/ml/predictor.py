# interventions/ml/predictor.py
"""
MODULE DE PRÉDICTION COMPLET
==============================
Prédit :
- categorie
- type_service
- urgence
- origine_probleme
- specialite_requise
- solution          ← NOUVEAU
- duree             ← NOUVEAU
- technicien recommandé avec score ← NOUVEAU
- prevention        ← NOUVEAU
"""

import joblib
import re
import os
import json

ML_DIR = os.path.dirname(
    os.path.abspath(__file__))
MODELS_DIR = os.path.join(ML_DIR, 'models')

# ══════════════════════════════════════════════════
# CHARGEMENT DES MODÈLES
# ══════════════════════════════════════════════════

def _charger_modeles():
    fichiers = {
        'categorie':    'modele_categorie.joblib',
        'type_service': 'modele_type_service.joblib',
        'urgence':      'modele_urgence.joblib',
        'origine':      'modele_origine.joblib',
        'specialite':   'modele_specialite.joblib',
        'duree':        'modele_duree.joblib',
    }
    modeles = {}
    for nom, fichier in fichiers.items():
        chemin = os.path.join(MODELS_DIR, fichier)
        if not os.path.exists(chemin):
            raise FileNotFoundError(
                f"Modèle manquant : {chemin}\n"
                f"→ Lancez : "
                f"python interventions/ml/"
                f"train_models.py"
            )
        modeles[nom] = joblib.load(chemin)
    return modeles


def _charger_solutions_map():
    """
    Charge le mapping (categorie, type_service)
    → solution, généré par generate_dataset.py.
    """
    chemin = os.path.join(
        ML_DIR, 'solutions_map.json')
    if not os.path.exists(chemin):
        return {}
    with open(chemin, 'r',
              encoding='utf-8') as f:
        data = json.load(f)
    return {
        tuple(k.split('|')): v
        for k, v in data.items()
    }


# ══════════════════════════════════════════════════
# RÈGLES MÉTIER PRIORITAIRES POUR L'URGENCE
# ══════════════════════════════════════════════════
# ✅ Approche hybride : certains mots-clés sont
# des signaux métier absolus et fiables à 100%
# (un agent qui tape "ransomware" veut une
# urgence critique, indépendamment de ce que
# le ML a statistiquement appris sur un dataset
# synthétique forcément limité et déséquilibré).
#
# Le ML reste utilisé pour les cas où AUCUN
# mot-clé fort n'est détecté (cas ambigus),
# ce qui est la majorité des descriptions réelles.
#
# Cette approche combine la fiabilité des règles
# expertes avec la flexibilité du ML, plutôt que
# de forcer le ML à réapprendre des règles déjà
# connues à partir d'un signal statistique faible.

MOTS_CRITIQUE_ABSOLU = [
    'ransomware', 'rançongiciel',
    'ne démarre plus', 'ne fonctionne plus',
    'données disparu', 'données perdu',
    'serveur en panne', 'entreprise bloqué',
    'entreprise totalement bloqué',
    'activité bloqué', 'activité arrêté',
    'formatage', 'infection',
]

MOTS_HAUTE_ABSOLU = [
    'virus', 'surchauffe', 'très lent',
    'instable', 'plante', 'écran bleu',
]


def _ajuster_urgence_par_motscles(
        description_nettoyee,
        urgence_predite,
        proba_critique,
        proba_haute):
    """
    Vérifie la présence de mots-clés métier
    absolus dans la description. Si trouvés,
    ils priment sur la prédiction ML si celle-ci
    semble incohérente avec la gravité évidente
    du texte (ex: "ransomware" → critique, même
    si le ML a prédit faible/normale par manque
    de signal statistique suffisant).

    Retourne : (urgence_finale, ajustee: bool)
    """
    desc = description_nettoyee.lower()

    # Mots critiques absolus présents ?
    if any(m in desc
           for m in MOTS_CRITIQUE_ABSOLU):
        if urgence_predite not in (
                'critique', 'haute'):
            return 'critique', True
        return urgence_predite, False

    # Mots haute priorité absolus présents ?
    if any(m in desc for m in MOTS_HAUTE_ABSOLU):
        if urgence_predite not in (
                'haute', 'critique'):
            return 'haute', True
        return urgence_predite, False

    return urgence_predite, False


try:
    MODELES = _charger_modeles()
    MODELES_OK = True
    print("✅ Modèles IA chargés avec succès")
except FileNotFoundError as e:
    print(f"⚠️  {e}")
    MODELES = {}
    MODELES_OK = False

SOLUTIONS_MAP = _charger_solutions_map()


# ══════════════════════════════════════════════════
# PRÉTRAITEMENT
# ══════════════════════════════════════════════════

def _pretraiter(texte):
    texte = str(texte).lower()
    texte = re.sub(r'[^\w\s\'\-]', ' ', texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    return texte


# ══════════════════════════════════════════════════
# PIÈCES SUGGÉRÉES PAR CATÉGORIE/TYPE
# ══════════════════════════════════════════════════

PIECES_MAP = {
    ('hardware', 'reparation'): [
        'Disque dur HDD 1TB',
        'Disque SSD 256GB',
        'RAM DDR4 8GB',
        'Alimentation 500W',
        'Ventilateur CPU',
        'Pâte thermique',
        'Batterie laptop',
        'Écran LCD 15.6"',
    ],
    ('hardware', 'maintenance'): [
        'Pâte thermique',
        'Spray air comprimé',
        'Spray nettoyant',
    ],
    ('reseau', 'installation'): [
        'Câble RJ45 10m',
        'Connecteurs RJ45',
        'Switch 8 ports',
        'Point d\'accès WiFi',
    ],
    ('reseau', 'configuration'): [
        'Câble RJ45 5m',
    ],
    ('reseau', 'depannage'): [
        'Câble RJ45 5m',
        'Switch 8 ports',
    ],
}

# ══════════════════════════════════════════════════
# CONSEILS PRÉVENTIFS PAR CATÉGORIE
# ══════════════════════════════════════════════════

PREVENTION_MAP = {
    'hardware': [
        "Nettoyer l'intérieur du PC tous "
        "les 6 mois pour éviter la surchauffe.",
        "Utiliser un onduleur pour protéger "
        "contre les coupures de courant.",
        "Remplacer la pâte thermique "
        "tous les 2 ans.",
        "Éviter les environnements humides "
        "et les chocs physiques.",
    ],
    'software': [
        "Mettre à jour régulièrement le système "
        "et les logiciels.",
        "Installer un antivirus fiable "
        "et le maintenir à jour.",
        "Effectuer des sauvegardes régulières "
        "sur disque externe ou cloud.",
        "Créer des points de restauration "
        "avant toute modification système.",
    ],
    'reseau': [
        "Vérifier régulièrement les câbles "
        "et connexions réseau.",
        "Mettre à jour le firmware "
        "des équipements réseau.",
        "Sécuriser le réseau WiFi avec "
        "un mot de passe fort WPA3.",
        "Documenter la configuration réseau.",
    ],
}


# ══════════════════════════════════════════════════
# CALCUL DU SCORE TECHNICIEN
# ══════════════════════════════════════════════════

def _calculer_score(
        technicien,
        specialite_predite,
        urgence_predite,
        categorie_predite):
    """
    Calcule un score de compatibilité
    entre un technicien et une intervention.

    Score sur 100 :
    ┌──────────────────────────────────┐
    │ Spécialité    : 60 pts           │
    │ Disponibilité : 20 pts           │
    │ Urgence/exp.  : 20 pts           │
    └──────────────────────────────────┘
    """
    score = 0
    details = []

    # ── 1. Spécialité (60 pts) ──
    # ✅ Normalisation : tout en minuscule
    # et sans accents pour comparer correctement
    # peu importe la casse saisie en base
    def _normaliser(texte):
        texte = str(texte or '').strip().lower()
        remplacements = {
            'é': 'e', 'è': 'e', 'ê': 'e',
            'à': 'a', 'â': 'a',
            'ô': 'o', 'î': 'i', 'û': 'u',
        }
        for a, b in remplacements.items():
            texte = texte.replace(a, b)
        return texte

    spec_tech_norm = _normaliser(
        technicien.get('specialite', ''))
    spec_predite_norm = _normaliser(
        specialite_predite)

    spec_tech_affichage = str(
        technicien.get('specialite', '')
    ).strip()

    # Correspondances partielles (normalisées)
    map_partielle = {
        'hardware':    ['generaliste',
                        'maintenance'],
        'software':    ['generaliste',
                        'maintenance'],
        'reseau':      ['hardware',
                        'generaliste',
                        'maintenance'],
        'maintenance': ['hardware',
                        'software',
                        'reseau',
                        'generaliste'],
        'generaliste': ['hardware',
                        'software',
                        'reseau',
                        'maintenance'],
    }

    if spec_tech_norm == spec_predite_norm:
        score += 60
        details.append(
            f"Spécialité exacte : "
            f"{spec_tech_affichage} ✅")
    elif spec_tech_norm in map_partielle.get(
            spec_predite_norm, []):
        score += 35
        details.append(
            f"Spécialité compatible : "
            f"{spec_tech_affichage} ⚠️")
    else:
        score += 10
        details.append(
            f"Spécialité différente : "
            f"{spec_tech_affichage} ❌")

    # ── 2. Disponibilité (20 pts) ──
    disponible = technicien.get(
        'disponible', True)
    if disponible:
        score += 20
        details.append("Disponible ✅")
    else:
        score += 0
        details.append("Non disponible ❌")

    # ── 3. Urgence / Expérience (20 pts) ──
    tarif = float(
        technicien.get('tarif_horaire', 0)
        or 0)

    if urgence_predite == 'critique':
        if tarif >= 160:
            score += 20
            details.append(
                "Expert pour urgence critique ✅")
        elif tarif >= 130:
            score += 15
            details.append(
                "Adapté urgence critique ⚠️")
        else:
            score += 8
            details.append(
                "Urgence critique ❌")

    elif urgence_predite == 'haute':
        if tarif >= 130:
            score += 18
            details.append(
                "Adapté urgence haute ✅")
        else:
            score += 12
            details.append(
                "Urgence haute ⚠️")

    elif urgence_predite == 'normale':
        score += 16
        details.append("Urgence normale ✅")

    else:
        score += 20
        details.append("Urgence faible ✅")

    # ── Niveau global ──
    if score >= 85:
        niveau = "⭐ Excellent choix"
    elif score >= 70:
        niveau = "✅ Très bon choix"
    elif score >= 55:
        niveau = "👍 Bon choix"
    elif score >= 40:
        niveau = "⚠️ Choix acceptable"
    else:
        niveau = "❌ Choix par défaut"

    explication = (
        f"{niveau} — "
        + " · ".join(details)
        + f" (Score : {score}/100)"
    )

    return score, explication


# ══════════════════════════════════════════════════
# RECOMMANDATION DU TECHNICIEN
# ══════════════════════════════════════════════════

def _recommander_technicien(
        specialite_predite,
        urgence_predite,
        categorie_predite,
        techniciens):
    """
    Évalue et classe tous les techniciens
    par score de compatibilité.

    Retourne :
    - technicien recommandé (dict)
    - liste classée de tous les techniciens
    """
    if not techniciens:
        return None, []

    scores = []
    for tech in techniciens:
        score, explication = _calculer_score(
            tech,
            specialite_predite,
            urgence_predite,
            categorie_predite
        )
        scores.append({
            'id':           tech.get('id'),
            'nom':          tech.get('nom', ''),
            'specialite':   tech.get(
                'specialite', ''),
            'disponible':   tech.get(
                'disponible', True),
            'tarif_horaire': tech.get(
                'tarif_horaire', 0),
            'telephone':    tech.get(
                'telephone', ''),
            'score':        score,
            'explication':  explication,
        })

    # Trier : disponible d'abord, puis score
    scores.sort(
        key=lambda x: (
            x['disponible'],
            x['score']
        ),
        reverse=True
    )

    return scores[0], scores


# ══════════════════════════════════════════════════
# FONCTION PRINCIPALE DE PRÉDICTION
# ══════════════════════════════════════════════════

def predire(
        description,
        techniciens_disponibles=None):
    """
    Analyse une description et retourne
    le diagnostic complet.

    Paramètres :
        description (str) :
            texte du problème client
        techniciens_disponibles (list) :
            liste de dicts
            [{
              'id': 1,
              'nom': 'Ahmed',
              'specialite': 'Hardware',
              'disponible': True,
              'tarif_horaire': 150,
              'telephone': '0612...'
            }]

    Retourne (dict) :
        categorie, type_service, urgence,
        origine_probleme, specialite_requise,
        solution, duree, prevention,
        pieces_suggerees,
        technicien_recommande,
        tous_techniciens,
        confiance
    """
    if not MODELES_OK:
        return {
            'succes': False,
            'erreur': (
                'Modèles IA non disponibles. '
                'Lancez : python interventions/'
                'ml/train_models.py'
            )
        }

    if not description or \
            len(str(description).strip()) < 5:
        return {
            'succes': False,
            'erreur': 'Description trop courte'
        }

    desc = _pretraiter(description)

    # ── Prédictions classification ──
    categorie    = MODELES['categorie']\
        .predict([desc])[0]
    type_service = MODELES['type_service']\
        .predict([desc])[0]
    urgence      = MODELES['urgence']\
        .predict([desc])[0]

    # ✅ Ajustement hybride : si un mot-clé
    # métier absolu (ransomware, etc.) est
    # présent mais que le ML a prédit une
    # urgence trop faible (signal statistique
    # insuffisant dans un dataset synthétique
    # forcément limité), on corrige avec la
    # règle métier qui est fiable à 100%.
    proba_urg_brut = MODELES['urgence']\
        .predict_proba([desc])[0]
    classes_urg = list(
        MODELES['urgence'].classes_)

    def _proba_classe(label):
        if label in classes_urg:
            return float(proba_urg_brut[
                classes_urg.index(label)])
        return 0.0

    urgence_ajustee, fut_ajustee = \
        _ajuster_urgence_par_motscles(
            desc, urgence,
            _proba_classe('critique'),
            _proba_classe('haute')
        )
    urgence = urgence_ajustee
    origine      = MODELES['origine']\
        .predict([desc])[0]
    specialite   = MODELES['specialite']\
        .predict([desc])[0]

    # ── Solution : DÉRIVÉE (pas prédite) ──
    # à partir de categorie + type_service,
    # déjà fiables. Repli sur un texte
    # générique si la combinaison est inédite.
    solution = SOLUTIONS_MAP.get(
        (categorie, type_service),
        "Diagnostiquer précisément le problème "
        "puis appliquer la procédure de "
        "résolution adaptée à la panne constatée."
    )

    # ── Prédiction durée (régression) ──
    duree = float(
        MODELES['duree'].predict([desc])[0])
    # Arrondir au 0.5 le plus proche
    duree = max(0.5, round(duree * 2) / 2)

    # ── Probabilités (confiance) ──
    def conf(modele_key, label):
        modele = MODELES[modele_key]
        classes = list(modele.classes_)
        probas = modele.predict_proba([desc])[0]
        if label in classes:
            idx = classes.index(label)
            return round(float(probas[idx])
                         * 100, 1)
        return 0.0

    conf_categorie    = conf('categorie',
                             categorie)
    conf_type_service = conf('type_service',
                             type_service)
    conf_urgence = conf('urgence', urgence)

    # ✅ Si la règle métier a corrigé l'urgence,
    # on affiche une confiance élevée fixe (95%)
    # car la règle est déterministe et fiable,
    # plutôt que la confiance ML (qui serait
    # trompeuse puisqu'elle correspond à la
    # classe que le ML avait prédite à tort)
    if fut_ajustee:
        conf_urgence = 95.0
    conf_specialite   = conf('specialite',
                             specialite)

    # ✅ La confiance de 'solution' est dérivée
    # de celles de categorie + type_service
    # puisque la solution elle-même en découle
    # directement (pas de modèle ML séparé)
    conf_solution = round(
        (conf_categorie + conf_type_service)
        / 2, 1)

    conf_globale = round(
        (conf_categorie +
         conf_type_service +
         conf_urgence) / 3, 1)

    # ── Pièces suggérées ──
    cle = (categorie, type_service)
    pieces = PIECES_MAP.get(cle, [])

    # ── Conseil préventif ──
    import random
    options_prev = PREVENTION_MAP.get(
        categorie,
        ["Effectuer des maintenances régulières."]
    )
    prevention = random.choice(options_prev)

    # ── Recommandation technicien ──
    technicien_recommande = None
    tous_techniciens = []

    if techniciens_disponibles:
        technicien_recommande, tous_techniciens =\
            _recommander_technicien(
                specialite,
                urgence,
                categorie,
                techniciens_disponibles
            )

    return {
        'succes': True,

        # ── Prédictions ──
        'categorie':          categorie,
        'type_service':       type_service,
        'urgence':            urgence,
        'origine_probleme':   origine,
        'specialite_requise': specialite,

        # ── NOUVEAU ──
        'solution':           solution,
        'duree':              duree,
        'prevention':         prevention,
        'pieces_suggerees':   pieces,

        # ── Technicien ──
        'technicien_recommande':  technicien_recommande,
        'tous_techniciens':       tous_techniciens,

        # ── Confiance ──
        'confiance': {
            'categorie':    conf_categorie,
            'type_service': conf_type_service,
            'urgence':      conf_urgence,
            'specialite':   conf_specialite,
            'solution':     conf_solution,
            'globale':      conf_globale,
        }
    }