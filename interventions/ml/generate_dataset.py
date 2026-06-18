# interventions/ml/generate_dataset.py
"""
GÉNÉRATION DU DATASET SYNTHÉTIQUE
===================================
Dataset enrichi avec :
- solutions    : solution recommandée
- duree        : durée estimée
- prevention   : conseil préventif
"""

import pandas as pd
import random
import json
import os

random.seed(42)

# ══════════════════════════════════════════════════
# DESCRIPTIONS PAR CATÉGORIE
# ══════════════════════════════════════════════════

DESCRIPTIONS = {

    'hardware': [
        "L'ordinateur ne démarre plus du tout",
        "L'écran reste noir après allumage",
        "Le ventilateur fait un bruit très fort",
        "L'ordinateur s'éteint tout seul",
        "Le disque dur fait un bruit de cliquetis",
        "La batterie du laptop ne charge plus",
        "Le clavier ne fonctionne plus",
        "La souris ne répond plus",
        "L'imprimante ne reconnaît plus le papier",
        "L'ordinateur chauffe excessivement",
        "Le port USB ne détecte plus les périphériques",
        "L'écran affiche des lignes horizontales",
        "La carte graphique affiche des artefacts",
        "Le PC redémarre aléatoirement",
        "Le chargeur du laptop est cassé",
        "Écran bleu fréquent RAM peut-être défectueuse",
        "Le bouton d'alimentation ne répond plus",
        "L'imprimante imprime des pages vides",
        "La webcam intégrée n'est plus détectée",
        "Le haut-parleur ne produit aucun son",
        "La carte mère émet des bips au démarrage",
        "Le connecteur de charge est endommagé",
        "L'écran tactile ne répond plus",
        "Le disque SSD n'est plus reconnu par le BIOS",
        "La pile CMOS est vide l'heure se réinitialise",
        "Le processeur surchauffe pc très lent",
        "La carte réseau intégrée ne fonctionne plus",
        "L'alimentation électrique ne démarre pas",
        "Le lecteur CD DVD n'ouvre plus",
        "Le touchpad du laptop est bloqué",
        "L'imprimante bourre constamment le papier",
        "Le scanner ne détecte plus les documents",
        "La carte graphique ne s'affiche plus",
        "Le disque dur externe n'est plus reconnu",
        "L'écran du laptop est fissuré",
        "La charnière du laptop est cassée",
        "La batterie gonfle et déforme le boîtier",
        "Le bloc d'alimentation émet des odeurs",
        "La RAM est défectueuse écrans bleus fréquents",
        "Le processeur est surchargé température critique",
    ],

    'software': [
        "Windows ne démarre plus écran bleu",
        "L'ordinateur est infecté par un virus",
        "L'ordinateur est très lent au démarrage",
        "Microsoft Office ne s'ouvre plus",
        "Le navigateur redirige vers des sites inconnus",
        "Impossible d'installer un logiciel",
        "Windows Update bloqué depuis plusieurs jours",
        "Le système affiche une erreur de registre",
        "Les fichiers ont disparu après une mise à jour",
        "Le logiciel de comptabilité plante",
        "Impossible d'accéder à certains dossiers",
        "L'antivirus ne peut pas supprimer les menaces",
        "Windows demande une activation non valide",
        "Les drivers de la carte graphique sont corrompus",
        "L'ordinateur est infecté par un ransomware",
        "Outlook ne se synchronise plus avec le mail",
        "Le logiciel métier affiche erreur base de données",
        "Windows à réinstaller suite à corruption",
        "Le profil utilisateur est corrompu",
        "Adobe Acrobat plante à l'ouverture",
        "Le système est bloqué en mode sans échec",
        "Une mise à jour a cassé une application",
        "Le pare-feu bloque une application métier",
        "Récupération de données après formatage",
        "Le logiciel ERP ne se lance plus",
        "Migration de Windows 7 vers Windows 10",
        "Le logiciel de caisse ne fonctionne plus",
        "Excel affiche des erreurs de calcul",
        "Le système est bloqué sur l'écran de connexion",
        "Les mises à jour automatiques échouent",
        "Désinstallation impossible d'un logiciel",
        "Le système de sauvegarde automatique est arrêté",
        "Problème de compatibilité après mise à jour",
        "Le logiciel de facturation perd ses données",
        "Installation d'un nouveau système d'exploitation",
        "Configuration des droits d'accès utilisateurs",
        "Nettoyage complet du système après infection",
        "Réinstallation complète de Windows",
        "Erreur critique au démarrage du système",
        "Le système ne reconnaît plus le disque dur",
    ],

    'reseau': [
        "Pas de connexion internet câble branché",
        "Le WiFi est très lent et instable",
        "Impossible de se connecter au réseau",
        "Le routeur ne distribue plus d'adresses IP",
        "La connexion WiFi se déconnecte souvent",
        "Impossible d'accéder au serveur de fichiers",
        "La box internet clignote en rouge",
        "Le réseau local est très lent",
        "Configuration d'un nouveau point d'accès WiFi",
        "Mise en place d'un réseau local pour bureaux",
        "Le VPN de l'entreprise ne se connecte plus",
        "Partage d'imprimante réseau impossible",
        "Configuration du pare-feu pour accès externe",
        "Le switch réseau tombe en panne",
        "Câblage réseau RJ45 à installer",
        "Le serveur NAS n'est plus accessible",
        "Problème de DNS sites web ne chargent pas",
        "La bande passante est saturée",
        "Configuration d'un serveur DHCP",
        "Le téléphone IP ne se connecte plus",
        "Sécurisation du réseau WiFi entreprise",
        "Installation d'un câble fibre optique",
        "Boucle réseau détectée réseau instable",
        "Configuration du proxy pour internet",
        "Le firewall bloque le trafic légitime",
        "Configuration accès distant RDP",
        "Perte de paquets réseau fréquente",
        "Installation d'un nouveau routeur fibre",
        "Le réseau est trop lent pour la vidéoconférence",
        "Remplacement d'un switch défaillant",
        "Configuration QoS pour prioriser les appels",
        "Mise à jour du firmware du routeur",
        "Configuration d'un réseau invité séparé",
        "Problème de routage entre deux sites",
        "Sécurisation contre les intrusions réseau",
        "Le serveur de messagerie est inaccessible",
        "Le réseau sans fil ne couvre pas tous les bureaux",
        "Deux réseaux à fusionner après déménagement",
        "Configuration d'un réseau WiFi sécurisé WPA3",
        "Mise en place d'un réseau pour nouveaux bureaux",
    ]
}

# ══════════════════════════════════════════════════
# SOLUTIONS PAR (CATÉGORIE, TYPE_SERVICE)
# Chaque solution = texte résumé en une phrase
# qui sera prédit par le modèle
# ══════════════════════════════════════════════════

SOLUTIONS_TEXTE = {

    ('hardware', 'reparation'):
        "Diagnostiquer et remplacer le composant matériel défaillant (disque dur, RAM, alimentation ou carte mère)",

    ('hardware', 'maintenance'):
        "Nettoyer la poussière avec air comprimé et remplacer la pâte thermique du processeur",

    ('software', 'reparation'):
        "Scanner et réparer le système avec un antivirus à jour et les outils de réparation Windows (sfc /scannow, DISM)",

    ('software', 'installation'):
        "Installer et configurer le logiciel demandé avec les paramètres adaptés aux besoins du client",

    ('software', 'configuration'):
        "Configurer les paramètres système et les droits d'accès selon les besoins de l'entreprise",

    ('reseau', 'depannage'):
        "Redémarrer les équipements réseau, vérifier les câbles et renouveler la configuration IP pour rétablir la connexion",

    ('reseau', 'configuration'):
        "Configurer le routeur, switch et DHCP pour mettre en place ou sécuriser le réseau local de l'entreprise",

    ('reseau', 'installation'):
        "Installer le câblage RJ45, le switch et configurer le réseau local complet des bureaux",
}

# ══════════════════════════════════════════════════
# DURÉES PAR (CATÉGORIE, TYPE_SERVICE)
# ══════════════════════════════════════════════════

DUREES = {
    ('hardware', 'reparation'):    [1.0, 1.5, 2.0, 2.5, 3.0],
    ('hardware', 'maintenance'):   [0.5, 1.0, 1.5],
    ('software', 'reparation'):    [1.0, 1.5, 2.0, 2.5, 3.0],
    ('software', 'installation'):  [0.5, 1.0, 1.5, 2.0],
    ('software', 'configuration'): [0.5, 1.0, 1.5],
    ('reseau', 'depannage'):       [0.5, 1.0, 1.5],
    ('reseau', 'configuration'):   [1.0, 1.5, 2.0, 2.5],
    ('reseau', 'installation'):    [2.0, 2.5, 3.0, 4.0, 5.0],
}

# ══════════════════════════════════════════════════
# CONSEILS PRÉVENTIFS PAR CATÉGORIE
# ══════════════════════════════════════════════════

PREVENTION = {
    'hardware': [
        "Nettoyer régulièrement l'intérieur du PC "
        "tous les 6 mois pour éviter la surchauffe.",
        "Utiliser un onduleur pour protéger "
        "contre les coupures et surtensions.",
        "Éviter les chocs physiques et "
        "les environnements humides.",
        "Remplacer la pâte thermique "
        "tous les 2 ans.",
        "Vérifier régulièrement l'état "
        "de la batterie et des ventilateurs.",
    ],
    'software': [
        "Mettre à jour régulièrement le système "
        "et les logiciels pour la sécurité.",
        "Installer un antivirus fiable "
        "et le maintenir à jour.",
        "Effectuer des sauvegardes régulières "
        "sur disque externe ou cloud.",
        "Éviter les logiciels piratés "
        "qui peuvent contenir des malwares.",
        "Créer des points de restauration "
        "avant toute modification système.",
    ],
    'reseau': [
        "Vérifier régulièrement les câbles "
        "et connexions réseau.",
        "Mettre à jour le firmware "
        "des équipements réseau.",
        "Surveiller la bande passante "
        "et optimiser l'utilisation.",
        "Sécuriser le réseau WiFi avec "
        "un mot de passe fort WPA3.",
        "Documenter la configuration réseau "
        "pour faciliter les interventions futures.",
    ],
}

# ══════════════════════════════════════════════════
# RÈGLES EXISTANTES (inchangées)
# ══════════════════════════════════════════════════

TYPE_SERVICE = {
    'hardware': ['reparation', 'maintenance'],
    'software': ['reparation', 'configuration',
                 'installation'],
    'reseau':   ['configuration', 'installation',
                 'depannage']
}

MOTS_CRITIQUE = [
    'ne démarre plus', 'virus', 'ransomware',
    'données disparu', 'bloqué', 'écran bleu',
    'formatage', 'ne fonctionne plus',
    'corruption', 'infection',
]
MOTS_HAUTE = [
    'très lent', 'surchauffe', 'instable',
    'plante', 'déconnecte', 'erreur', 'bruit',
    'bourre', 'ne répond plus', 'endommagé'
]
MOTS_NORMALE = [
    'lent', 'impossible', 'configuration',
    'mise à jour', 'ne détecte plus'
]


# Mots-clés qui indiquent le type_service
# pour rendre la relation description→type_service
# apprenable (avant, c'était un choix aléatoire
# pur sans rapport avec le texte, ce qui rendait
# la tâche impossible à apprendre pour le modèle)
MOTS_REPARATION = [
    'ne démarre plus', 'ne fonctionne plus',
    'cassé', 'cassée', 'endommagé', 'défaillant',
    'fissuré', 'gonfle', 'grillé', 'panne',
]
MOTS_INSTALLATION = [
    'installer', 'installation', 'mise en place',
    'déployer', 'nouveau', 'nouvel',
]
MOTS_CONFIGURATION = [
    'configurer', 'configuration', 'paramétrer',
    'sécuriser', 'mettre à jour',
]
MOTS_MAINTENANCE = [
    'nettoyer', 'nettoyage', 'entretien',
    'préventif', 'préventive', 'vérifier',
]
MOTS_DEPANNAGE = [
    'pas de connexion', 'coupé', 'coupée',
    'déconnecte', 'inaccessible', 'bloqué',
    'lent', 'instable',
]


def determiner_type_service(
        description, categorie):
    """
    Détermine le type_service en se basant
    d'abord sur les mots-clés présents dans
    la description, puis en repli sur les
    types possibles pour la catégorie.
    """
    desc = description.lower()
    types_possibles = TYPE_SERVICE[categorie]

    if (any(m in desc for m in MOTS_INSTALLATION)
            and 'installation' in types_possibles):
        return 'installation'
    if (any(m in desc for m in MOTS_MAINTENANCE)
            and 'maintenance' in types_possibles):
        return 'maintenance'
    if (any(m in desc for m in MOTS_CONFIGURATION)
            and 'configuration' in types_possibles):
        return 'configuration'
    if (any(m in desc for m in MOTS_DEPANNAGE)
            and 'depannage' in types_possibles):
        return 'depannage'
    if (any(m in desc for m in MOTS_REPARATION)
            and 'reparation' in types_possibles):
        return 'reparation'

    # Repli : choix aléatoire parmi les
    # types possibles pour cette catégorie
    return random.choice(types_possibles)


def determiner_urgence(description):
    """
    Détermine l'urgence basée sur les mots-clés.

    ✅ Le bruit aléatoire a été fortement réduit
    par rapport à la version précédente
    (poids 90/10 au lieu de 65/35) car un excès
    de hasard rendait la relation description→
    urgence trop ambiguë pour être apprise
    correctement par le modèle, ce qui plafonnait
    artificiellement sa confiance et son accuracy.
    """
    desc = description.lower()
    if any(m in desc for m in MOTS_CRITIQUE):
        return random.choices(
            ['critique', 'haute'],
            weights=[90, 10])[0]
    elif any(m in desc for m in MOTS_HAUTE):
        return random.choices(
            ['haute', 'normale'],
            weights=[85, 15])[0]
    elif any(m in desc for m in MOTS_NORMALE):
        return random.choices(
            ['normale', 'faible'],
            weights=[85, 15])[0]
    else:
        return random.choices(
            ['normale', 'faible'],
            weights=[70, 30])[0]


ORIGINES = {
    'hardware': [
        "Défaillance matérielle due à l'usure",
        "Composant électronique endommagé",
        "Surchauffe causée par poussière accumulée",
        "Dommage physique suite à choc",
        "Court-circuit dans l'alimentation",
        "Vieillissement de la batterie",
        "Connexion interne défaillante",
    ],
    'software': [
        "Corruption du système d'exploitation",
        "Infection par malware ou virus",
        "Conflit entre logiciels installés",
        "Mise à jour défectueuse du système",
        "Erreur de configuration système",
        "Licence expirée ou fichiers corrompus",
        "Surcharge mémoire et fragmentation",
    ],
    'reseau': [
        "Mauvaise configuration des paramètres réseau",
        "Équipement réseau défaillant",
        "Câblage endommagé ou mal branché",
        "Surcharge de la bande passante",
        "Problème de sécurité réseau",
        "Incompatibilité de protocoles réseau",
        "Interférence WiFi avec autres équipements",
    ]
}

PIECES = {
    ('hardware', 'reparation'): [
        ['Disque dur HDD 1TB'],
        ['Disque SSD 256GB', 'Câble SATA'],
        ['RAM DDR4 8GB'],
        ['Alimentation 500W'],
        ['Ventilateur CPU', 'Pâte thermique'],
        ['Écran LCD 15.6"'],
        ['Batterie laptop'],
        ['Clavier laptop'],
        ['Carte mère'],
        ['Connecteur de charge'],
        [],
    ],
    ('hardware', 'maintenance'): [
        ['Pâte thermique'],
        ['Spray air comprimé', 'Spray nettoyant'],
        ['Pâte thermique', 'Spray air comprimé'],
        [],
    ],
    ('software', 'reparation'):    [[], [], []],
    ('software', 'configuration'): [[], []],
    ('software', 'installation'):  [[], []],
    ('reseau', 'configuration'): [
        ['Câble RJ45 5m'], ['Switch 8 ports'], [],
    ],
    ('reseau', 'installation'): [
        ['Câble RJ45 10m', 'Connecteurs RJ45'],
        ['Point d\'accès WiFi'],
        ['Switch 16 ports', 'Câble RJ45 20m'],
        ['Routeur fibre'],
    ],
    ('reseau', 'depannage'): [
        ['Câble RJ45 5m'], ['Switch 8 ports'], [],
    ],
}

SPECIALITES = {
    'hardware': 'Hardware',
    'software': 'Software',
    'reseau':   'Réseau',
}

PREFIXES = [
    "",
    "",
    "Client signale : ",
    "Signalement client : ",
    "Problème signalé : ",
    "Le client indique que ",
    "Intervention requise : ",
    "Demande d'intervention : ",
    "Le client se plaint que ",
    "Suite à un appel client : ",
]
SUFFIXES = [
    "",
    "",
    " depuis hier.",
    " depuis ce matin.",
    " Problème urgent.",
    " Cela se produit souvent.",
    " Le client a besoin d'aide.",
    " Merci d'intervenir rapidement.",
    " Cela bloque le travail.",
    " Le client est inquiet.",
]


# ══════════════════════════════════════════════════
# GÉNÉRATION PRINCIPALE
# ══════════════════════════════════════════════════

def generer_dataset(
        n=5000,
        chemin='interventions/ml/'
               'dataset_interventions.csv'):
    """
    Génère n exemples synthétiques avec :
    - solution   : solution recommandée (texte)
                   UNE SEULE par combinaison
                   (categorie, type_service)
                   pour réduire le nombre de
                   classes et améliorer la
                   confiance du modèle
    - prevention : conseil préventif
    - duree      : durée estimée en heures
    """
    data = []

    nb_hardware = int(n * 0.40)
    nb_software = int(n * 0.35)
    nb_reseau = n - nb_hardware - nb_software

    categories = (
        ['hardware'] * nb_hardware +
        ['software'] * nb_software +
        ['reseau'] * nb_reseau
    )
    random.shuffle(categories)

    for categorie in categories:
        desc_base = random.choice(
            DESCRIPTIONS[categorie])

        prefixe = random.choice(PREFIXES)
        suffixe = random.choice(SUFFIXES)

        if prefixe and prefixe.endswith(': '):
            description = (
                prefixe
                + desc_base.lower()
                + suffixe
            )
        elif prefixe.endswith('que '):
            description = (
                prefixe
                + desc_base[0].lower()
                + desc_base[1:]
                + suffixe
            )
        else:
            description = (
                prefixe + desc_base + suffixe)

        description = description.strip()

        # Labels existants
        # ✅ type_service lié aux mots-clés
        # de la description (plus apprenable)
        type_service = determiner_type_service(
            description, categorie)
        urgence = determiner_urgence(description)
        origine = random.choice(
            ORIGINES[categorie])
        specialite = SPECIALITES[categorie]

        cle = (categorie, type_service)

        # Pièces
        options_pieces = PIECES.get(cle, [[]])
        pieces = random.choice(options_pieces)

        # Solution recommandée
        # ✅ Une seule solution par combinaison
        # (categorie, type_service) pour réduire
        # le nombre de classes et améliorer
        # la confiance du modèle
        solution = SOLUTIONS_TEXTE.get(
            cle,
            "Diagnostiquer et résoudre "
            "le problème signalé"
        )

        # Prévention
        prevention = random.choice(
            PREVENTION[categorie])

        # Durée
        options_duree = DUREES.get(
            cle, [1.0, 1.5, 2.0])
        duree = random.choice(options_duree)

        data.append({
            'description':        description,
            'categorie':          categorie,
            'type_service':       type_service,
            'urgence':            urgence,
            'origine_probleme':   origine,
            'specialite_requise': specialite,
            'pieces_necessaires': json.dumps(
                pieces,
                ensure_ascii=False),
            'solution':           solution,
            'prevention':         prevention,
            'duree':              duree,
        })

    df = pd.DataFrame(data)

    os.makedirs(
        os.path.dirname(chemin),
        exist_ok=True)

    df.to_csv(
        chemin,
        index=False,
        encoding='utf-8')

    # ✅ Sauvegarder aussi SOLUTIONS_TEXTE
    # en JSON pour que predictor.py puisse
    # dériver la solution depuis les prédictions
    # categorie + type_service sans dupliquer
    # ce dictionnaire dans deux fichiers
    solutions_json_path = os.path.join(
        os.path.dirname(chemin),
        'solutions_map.json')
    solutions_serialisable = {
        f"{cat}|{ts}": texte
        for (cat, ts), texte
        in SOLUTIONS_TEXTE.items()
    }
    with open(solutions_json_path, 'w',
              encoding='utf-8') as f:
        json.dump(
            solutions_serialisable, f,
            indent=2, ensure_ascii=False)
    print(f"Solutions map : "
          f"{solutions_json_path}")

    print("=" * 55)
    print("DATASET GÉNÉRÉ AVEC SUCCÈS")
    print("=" * 55)
    print(f"Total exemples : {len(df)}")

    print(f"\nRépartition catégories :")
    for cat, nb in \
            df['categorie'].value_counts()\
            .items():
        pct = nb / len(df) * 100
        print(f"  {cat:10s} : {nb} ({pct:.1f}%)")

    print(f"\nRépartition urgences :")
    for urg, nb in \
            df['urgence'].value_counts()\
            .items():
        pct = nb / len(df) * 100
        print(f"  {urg:10s} : {nb} ({pct:.1f}%)")

    print(f"\nRépartition solutions :")
    for sol, nb in \
            df['solution'].value_counts()\
            .head(5).items():
        print(f"  {sol[:50]}... : {nb}")

    print(f"\nFichier : {chemin}")
    return df


if __name__ == '__main__':
    generer_dataset(5000)