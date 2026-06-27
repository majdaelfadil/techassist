import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))

from ml.predictor import predire

techniciens = [
    {'id': 1, 'nom': 'Ali',    'specialite': 'Hardware',    'disponible': True},
    {'id': 2, 'nom': 'Sara',   'specialite': 'Software',    'disponible': True},
    {'id': 3, 'nom': 'Karim',  'specialite': 'Réseau',      'disponible': True},
    {'id': 4, 'nom': 'Fatima', 'specialite': 'Généraliste', 'disponible': True},
]

tests = [
    "L'écran reste noir au démarrage, l'ordinateur ne s'allume plus",
    "Impossible de se connecter au réseau WiFi, connexion perdue",
    "Windows plante avec écran bleu au démarrage",
    "L'imprimante ne répond plus et fait un bruit bizarre",
    "Le serveur est tombé en panne, tous les employés sont bloqués",
]

print("=" * 65)
for desc in tests:
    print(f"\nDescription : {desc[:60]}...")
    r = predire(desc, techniciens)
    print(f"  Catégorie       : {r.get('categorie')} ({r.get('confiance', {}).get('categorie')}%)")
    print(f"  Type service    : {r.get('type_service')} ({r.get('confiance', {}).get('type_service')}%)")
    print(f"  Urgence         : {r.get('urgence')} ({r.get('confiance', {}).get('urgence')}%)")
    print(f"  Origine         : {r.get('origine_probleme')}")
    print(f"  Spécialité req. : {r.get('specialite_requise')}")
    if r.get('technicien_recommande'):
        t = r['technicien_recommande']
        print(f"  Technicien rec. : {t['nom']} ({t['specialite']})")
    if r.get('pieces_suggerees'):
        print(f"  Pièces sugg.    : {', '.join(r['pieces_suggerees'][:3])}")
    print("-" * 65)
