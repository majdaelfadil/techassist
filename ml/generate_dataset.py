# ml/generate_dataset.py
"""
ÉTAPE 1 : GÉNÉRATION DU DATASET SYNTHÉTIQUE
============================================
On crée 2000 descriptions de problèmes informatiques
avec leurs labels correspondants.

Chaque exemple contient :
- description    : texte du problème (entrée du modèle)
- categorie      : hardware / software / reseau
- type_service   : reparation / installation / configuration / maintenance / depannage
- urgence        : critique / haute / normale / faible
- origine        : cause racine du problème
- specialite     : spécialité du technicien requis
- pieces         : liste des pièces nécessaires
"""

import pandas as pd
import random
import json
import os

random.seed(42)

# ══════════════════════════════════════════════════
# ─── BANQUE DE DESCRIPTIONS PAR CATÉGORIE ───
# Chaque description représente un problème réel
# qu'un client peut signaler à Media Telecom
# ══════════════════════════════════════════════════

DESCRIPTIONS = {

    # ── HARDWARE : pannes matérielles ──
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
        "Écran bleu fréquent, RAM peut-être défectueuse",
        "Le bouton d'alimentation ne répond plus",
        "L'imprimante imprime des pages vides",
        "La webcam intégrée n'est plus détectée",
        "Le haut-parleur ne produit aucun son",
        "La carte mère émet des bips au démarrage",
        "Le connecteur de charge est endommagé",
        "L'écran tactile ne répond plus",
        "Le disque SSD n'est plus reconnu par le BIOS",
        "La pile CMOS est vide, l'heure se réinitialise",
        "Le processeur surchauffe, pc très lent",
        "La carte réseau intégrée ne fonctionne plus",
        "L'alimentation électrique ne démarre pas",
        "Le lecteur CD DVD n'ouvre plus",
        "Le touchpad du laptop est bloqué",
        "L'imprimante bourre constamment le papier",
        "Le scanner ne détecte plus les documents",
        "Le câble d'alimentation est endommagé",
        "La carte graphique ne s'affiche plus",
        "Le disque dur externe n'est plus reconnu",
        "L'écran du laptop est fissuré",
        "La charnière du laptop est cassée",
        "Le clavier du laptop a des touches enfoncées",
        "La batterie gonfle et déforme le boîtier",
        "Le bloc d'alimentation émet des odeurs",
    ],

    # ── SOFTWARE : pannes logicielles ──
    'software': [
        "Windows ne démarre plus, écran bleu",
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
        "Erreur 0x80070057 lors d'une opération Windows",
        "Le pare-feu bloque une application métier",
        "Récupération de données après formatage",
        "Le logiciel ERP ne se lance plus",
        "Migration de Windows 7 vers Windows 10",
        "Configuration du démarrage automatique",
        "Sauvegarde et restauration après panne",
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
    ],

    # ── RÉSEAU : pannes réseau ──
    'reseau': [
        "Pas de connexion internet, câble branché",
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
        "Problème de DNS, sites web ne chargent pas",
        "La bande passante est saturée",
        "Configuration d'un serveur DHCP",
        "Redirection de port sur le routeur",
        "Le téléphone IP ne se connecte plus",
        "Sécurisation du réseau WiFi entreprise",
        "Installation d'un câble fibre optique",
        "Boucle réseau détectée, réseau instable",
        "Configuration du proxy pour internet",
        "Le firewall bloque le trafic légitime",
        "Configuration accès distant RDP",
        "Le réseau sans fil ne couvre pas tous les bureaux",
        "Perte de paquets réseau fréquente",
        "Deux réseaux à fusionner après déménagement",
        "Mise en place d'un réseau WiFi sécurisé",
        "Le serveur de messagerie est inaccessible",
        "Configuration d'un réseau invité séparé",
        "Problème de routage entre deux sites",
        "Installation d'un nouveau routeur fibre",
        "Le réseau est trop lent pour la vidéoconférence",
        "Sécurisation contre les intrusions réseau",
        "Mise à jour du firmware du routeur",
        "Configuration QoS pour prioriser les appels",
        "Remplacement d'un switch défaillant",
    ]
}

# ══════════════════════════════════════════════════
# ─── RÈGLES DE MAPPING ───
# Chaque catégorie → types de service possibles
# ══════════════════════════════════════════════════

TYPE_SERVICE = {
    'hardware': ['reparation', 'maintenance'],
    'software': ['reparation', 'configuration', 'installation'],
    'reseau':   ['configuration', 'installation', 'depannage']
}

# Mots-clés pour déterminer l'urgence
MOTS_CRITIQUE = [
    'ne démarre plus', 'virus', 'ransomware',
    'données disparu', 'bloqué', 'écran bleu',
    'formatage', 'ne fonctionne plus', 'corruption',
    'infection', 'ne s\'ouvre plus', 'ne charge plus'
]
MOTS_HAUTE = [
    'très lent', 'surchauffe', 'instable',
    'plante', 'déconnecte', 'erreur', 'bruit',
    'bourre', 'ne répond plus', 'endommagé'
]
MOTS_NORMALE = [
    'lent', 'impossible', 'configuration',
    'mise à jour', 'ne détecte plus', 'bloque'
]

def determiner_urgence(description):
    """
    Détermine l'urgence basée sur les mots-clés
    avec une légère randomisation pour réalisme.
    """
    desc = description.lower()
    if any(m in desc for m in MOTS_CRITIQUE):
        return random.choices(
            ['critique', 'haute'],
            weights=[65, 35])[0]
    elif any(m in desc for m in MOTS_HAUTE):
        return random.choices(
            ['haute', 'normale'],
            weights=[60, 40])[0]
    elif any(m in desc for m in MOTS_NORMALE):
        return random.choices(
            ['normale', 'faible'],
            weights=[70, 30])[0]
    else:
        return random.choices(
            ['normale', 'faible'],
            weights=[55, 45])[0]

# Origines par catégorie
ORIGINES = {
    'hardware': [
        'Défaillance matérielle due à l\'usure',
        'Composant électronique endommagé',
        'Surchauffe causée par poussière accumulée',
        'Dommage physique suite à choc',
        'Court-circuit dans l\'alimentation',
        'Vieillissement de la batterie',
        'Connexion interne défaillante',
    ],
    'software': [
        'Corruption du système d\'exploitation',
        'Infection par malware ou virus',
        'Conflit entre logiciels installés',
        'Mise à jour défectueuse du système',
        'Erreur de configuration système',
        'Licence expirée ou fichiers corrompus',
        'Surcharge mémoire et fragmentation',
    ],
    'reseau': [
        'Mauvaise configuration des paramètres réseau',
        'Équipement réseau défaillant',
        'Câblage endommagé ou mal branché',
        'Surcharge de la bande passante',
        'Problème de sécurité réseau',
        'Incompatibilité de protocoles réseau',
        'Interférence WiFi avec autres équipements',
    ]
}

# Pièces par (catégorie, type_service)
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
        ['Câble d\'alimentation'],
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
        ['Câble RJ45 5m'],
        ['Switch 8 ports'],
        [],
    ],
    ('reseau', 'installation'): [
        ['Câble RJ45 10m', 'Connecteurs RJ45'],
        ['Point d\'accès WiFi'],
        ['Switch 16 ports', 'Câble RJ45 20m'],
        ['Routeur fibre'],
    ],
    ('reseau', 'depannage'): [
        ['Câble RJ45 5m'],
        ['Switch 8 ports'],
        [],
    ],
}

# Spécialité requise par catégorie
SPECIALITES = {
    'hardware': ['Hardware', 'Généraliste'],
    'software': ['Software', 'Généraliste'],
    'reseau':   ['Réseau', 'Généraliste'],
}

# Variations de formulation pour diversifier
PREFIXES = [
    "",
    "Client signale : ",
    "Signalement client : ",
    "Problème signalé : ",
    "Le client indique que ",
    "Intervention requise : ",
]
SUFFIXES = [
    "",
    " depuis hier.",
    " depuis ce matin.",
    " Problème urgent.",
    " Cela se produit souvent.",
    " Le client a besoin d'aide.",
    " Problème récurrent.",
]

# ══════════════════════════════════════════════════
# ─── GÉNÉRATION PRINCIPALE ───
# ══════════════════════════════════════════════════

def generer_dataset(n=2000, chemin='ml/dataset_interventions.csv'):
    """
    Génère n exemples synthétiques réalistes.

    Répartition : 40% hardware, 35% software, 25% réseau
    Cette répartition reflète la réalité d'une PME IT.
    """
    data = []

    # Répartition des catégories
    nb_hardware = int(n * 0.40)
    nb_software = int(n * 0.35)
    nb_reseau   = n - nb_hardware - nb_software

    categories = (
        ['hardware'] * nb_hardware +
        ['software'] * nb_software +
        ['reseau']   * nb_reseau
    )
    random.shuffle(categories)

    for categorie in categories:
        # Choisir description de base
        desc_base = random.choice(DESCRIPTIONS[categorie])

        # Appliquer préfixe/suffixe aléatoire
        # pour diversifier les formulations
        prefixe = random.choice(PREFIXES)
        suffixe = random.choice(SUFFIXES)

        if prefixe and prefixe.endswith(': '):
            description = prefixe + desc_base.lower() + suffixe
        elif prefixe.endswith('que '):
            description = prefixe + desc_base[0].lower() + \
                          desc_base[1:] + suffixe
        else:
            description = prefixe + desc_base + suffixe

        description = description.strip()

        # Déterminer les labels
        type_service = random.choice(TYPE_SERVICE[categorie])
        urgence      = determiner_urgence(description)
        origine      = random.choice(ORIGINES[categorie])
        specialite   = random.choice(SPECIALITES[categorie])

        cle_pieces = (categorie, type_service)
        options_pieces = PIECES.get(cle_pieces, [[]])
        pieces = random.choice(options_pieces)

        data.append({
            'description':        description,
            'categorie':          categorie,
            'type_service':       type_service,
            'urgence':            urgence,
            'origine_probleme':   origine,
            'specialite_requise': specialite,
            'pieces_necessaires': json.dumps(
                pieces, ensure_ascii=False),
        })

    df = pd.DataFrame(data)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    df.to_csv(chemin, index=False, encoding='utf-8')

    print("=" * 55)
    print("DATASET GÉNÉRÉ AVEC SUCCÈS")
    print("=" * 55)
    print(f"Total exemples     : {len(df)}")
    print(f"\nRépartition catégories :")
    for cat, nb in df['categorie'].value_counts().items():
        print(f"  {cat:10s} : {nb} ({nb/len(df)*100:.1f}%)")
    print(f"\nRépartition urgences :")
    for urg, nb in df['urgence'].value_counts().items():
        print(f"  {urg:10s} : {nb} ({nb/len(df)*100:.1f}%)")
    print(f"\nRépartition types de service :")
    for ts, nb in df['type_service'].value_counts().items():
        print(f"  {ts:15s} : {nb} ({nb/len(df)*100:.1f}%)")
    print(f"\nFichier sauvegardé : {chemin}")

    return df

if __name__ == '__main__':
    generer_dataset(2000)