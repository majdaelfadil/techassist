# diagnostic_urgence.py
"""
Script de diagnostic ciblé pour comprendre
pourquoi le modèle 'urgence' se trompe sur
des descriptions contenant des mots-clés
critiques évidents.

✅ USAGE CORRECT (ne pas coller dans le shell
interactif >>> car le multi-lignes y est
mal géré). Lancer plutôt directement :

    python diagnostic_urgence.py

depuis le dossier techassist/ (racine du projet,
au même niveau que manage.py).
"""

import os
import sys
import django

# ── Initialiser Django ──
sys.path.insert(0, os.path.dirname(
    os.path.abspath(__file__)))
os.environ.setdefault(
    'DJANGO_SETTINGS_MODULE',
    'techassist_backend.settings')
django.setup()

from interventions.ml.predictor import (
    MODELES, _pretraiter)


def main():
    desc_test = (
        "Ransomware a chiffré toutes les données, "
        "entreprise totalement bloquée, urgent"
    )

    print("=" * 70)
    print("DIAGNOSTIC CIBLÉ — MODÈLE URGENCE")
    print("=" * 70)

    desc_clean = _pretraiter(desc_test)
    print(f"\nDescription originale : {desc_test}")
    print(f"Description nettoyée  : {desc_clean}")

    modele_urgence = MODELES['urgence']
    tfidf = modele_urgence.named_steps['tfidf']
    vocab = tfidf.vocabulary_

    print(f"\nTaille du vocabulaire TF-IDF "
          f"(urgence) : {len(vocab)}")

    mots_cles_a_verifier = [
        'ransomware', 'chiffre', 'chiffré',
        'bloquee', 'bloquée', 'bloque', 'bloqué',
        'urgent', 'donnees', 'données',
        'entreprise', 'totalement',
    ]

    print("\nPrésence des mots-clés dans "
          "le vocabulaire :")
    for mot in mots_cles_a_verifier:
        present = mot in vocab
        print(f"  {mot:15s} : "
              f"{'✅ présent' if present else '❌ ABSENT'}")

    print("\n" + "-" * 70)
    print("Probabilités du modèle 'urgence' :")
    print("-" * 70)

    classes = list(modele_urgence.classes_)
    probas = modele_urgence.predict_proba(
        [desc_clean])[0]

    for classe, proba in sorted(
            zip(classes, probas),
            key=lambda x: x[1], reverse=True):
        barre = '█' * int(proba * 50)
        print(f"  {classe:12s} : {proba*100:5.1f}% "
              f"{barre}")

    prediction = modele_urgence.predict(
        [desc_clean])[0]
    print(f"\nPrédiction finale : {prediction}")

    print("\n" + "-" * 70)
    print("Top 20 mots les plus importants "
          "pour le modèle 'urgence' :")
    print("-" * 70)

    clf = modele_urgence.named_steps['clf']
    importances = clf.feature_importances_
    noms_features = tfidf.get_feature_names_out()

    top_indices = importances.argsort()[-20:][::-1]
    for idx in top_indices:
        print(f"  {noms_features[idx]:25s} : "
              f"{importances[idx]:.4f}")

    # ── Vérifier les n-grammes contenant
    # nos mots-clés (le vocab peut contenir
    # "ransomware donnees" en bigramme plutôt
    # que "ransomware" seul) ──
    print("\n" + "-" * 70)
    print("Termes du vocabulaire contenant "
          "'ransom', 'chiffr', 'bloq', 'urgen' :")
    print("-" * 70)
    for terme in vocab:
        if any(p in terme for p in
               ['ransom', 'chiffr',
                'bloq', 'urgen']):
            print(f"  → {terme}")

    print("\n" + "=" * 70)


if __name__ == '__main__':
    main()