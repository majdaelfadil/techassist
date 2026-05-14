# ml/train_models.py
"""
ÉTAPE 2 : ENTRAÎNEMENT DES MODÈLES
====================================
On entraîne 5 modèles indépendants, un par tâche :
  1. Catégorie          → hardware / software / reseau
  2. Type de service    → reparation / installation / ...
  3. Urgence            → critique / haute / normale / faible
  4. Origine problème   → cause racine
  5. Spécialité requise → Hardware / Software / Réseau / Généraliste

Pipeline utilisé :
  Texte → TF-IDF → RandomForest ou LogisticRegression → Label
"""

import pandas as pd
import numpy as np
import json
import joblib
import os
import warnings
warnings.filterwarnings('ignore')

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import (
    train_test_split, cross_val_score,
    StratifiedKFold)
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    f1_score)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

# ══════════════════════════════════════════════════
# ─── CONFIGURATION ───
# ══════════════════════════════════════════════════

MODELS_DIR  = 'ml/models'
DATASET_PATH = 'ml/dataset_interventions.csv'
os.makedirs(MODELS_DIR, exist_ok=True)

# Stop words français — mots sans valeur discriminante
# On les retire pour que TF-IDF se concentre sur
# les mots techniques importants
STOP_WORDS_FR = [
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de',
    'et', 'est', 'en', 'au', 'aux', 'ce', 'se', 'sa',
    'son', 'sur', 'par', 'pour', 'pas', 'plus', 'ne',
    'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous',
    'vous', 'qui', 'que', 'quoi', 'dont', 'où', 'mais',
    'ou', 'donc', 'or', 'ni', 'car', 'très', 'tout',
    'bien', 'avec', 'dans', 'depuis', 'après', 'avant',
    'client', 'signale', 'signalement', 'problème',
    'souvent', 'matin', 'hier', 'aide', 'besoin',
    'produit', 'cela', 'urgente', 'urgent', 'souvent',
    'intervention', 'requise', 'indique', 'fonctionne'
]

# ══════════════════════════════════════════════════
# ─── PRÉTRAITEMENT TEXTE ───
# ══════════════════════════════════════════════════

import re

def pretraiter(texte):
    """
    Normalise le texte pour le TF-IDF :
    1. Minuscules
    2. Supprime la ponctuation excessive
    3. Normalise les espaces
    """
    texte = str(texte).lower()
    texte = re.sub(r'[^\w\s\'\-]', ' ', texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    return texte

# ══════════════════════════════════════════════════
# ─── CHARGEMENT DES DONNÉES ───
# ══════════════════════════════════════════════════

print("=" * 55)
print("ENTRAÎNEMENT — TECHASSIST AI")
print("=" * 55)

df = pd.read_csv(DATASET_PATH)
df['description_clean'] = df['description'].apply(pretraiter)
X = df['description_clean']

print(f"\n✅ Dataset : {len(df)} exemples chargés")
print(f"   Features : descriptions textuelles")
print(f"   Targets  : 5 labels à prédire")

# ══════════════════════════════════════════════════
# ─── FONCTION D'ENTRAÎNEMENT GÉNÉRIQUE ───
# ══════════════════════════════════════════════════

def entrainer_et_sauvegarder(
        X, y, nom, classificateur_type='rf'):
    """
    Pipeline complet pour un modèle :
    1. Split train/test stratifié (80/20)
    2. Construction du pipeline TF-IDF + Classificateur
    3. Entraînement
    4. Évaluation (accuracy, F1, cross-validation)
    5. Matrice de confusion
    6. Sauvegarde du modèle
    """
    print(f"\n{'─'*50}")
    print(f"Modèle : {nom}")
    print(f"Classes : {sorted(y.unique().tolist())}")
    print(f"Algorithme : "
          f"{'RandomForest' if classificateur_type == 'rf' else 'LogisticRegression'}")

    # ── Split stratifié ──
    # Stratifié = chaque classe est représentée
    # proportionnellement dans train et test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=42,
        stratify=y
    )
    print(f"Train : {len(X_train)} | Test : {len(X_test)}")

    # ── Choisir le classificateur ──
    if classificateur_type == 'rf':
        clf = RandomForestClassifier(
            n_estimators=200,   # 200 arbres de décision
            max_depth=None,     # Arbres non limités
            min_samples_split=2,
            class_weight='balanced',  # Gère déséquilibre
            random_state=42,
            n_jobs=-1           # Utilise tous les CPUs
        )
    else:
        clf = LogisticRegression(
            max_iter=1000,
            C=1.0,              # Régularisation L2
            class_weight='balanced',
            random_state=42,
            multi_class='multinomial',
            solver='lbfgs'
        )

    # ── Pipeline TF-IDF + Classificateur ──
    # TF-IDF transforme le texte en vecteurs numériques
    # ngram_range=(1,3) capture les expressions
    # comme "écran bleu", "ne démarre plus", etc.
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 3),   # 1 à 3 mots
            max_features=8000,    # Vocabulaire max
            min_df=1,             # Mot vu au moins 1 fois
            max_df=0.95,          # Ignore mots trop fréquents
            stop_words=STOP_WORDS_FR,
            sublinear_tf=True,    # log(TF) → réduit effet mots fréquents
            analyzer='word'
        )),
        ('clf', clf)
    ])

    # ── Entraînement ──
    pipeline.fit(X_train, y_train)

    # ── Évaluation ──
    y_pred = pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted')

    print(f"\n📊 Résultats sur le jeu de test :")
    print(f"   Accuracy  : {accuracy*100:.2f}%")
    print(f"   F1-score  : {f1*100:.2f}%")
    print(f"\n{classification_report(y_test, y_pred)}")

    # ── Cross-validation 5 folds ──
    # Évaluation plus robuste : on divise en 5 parties,
    # on entraîne 5 fois et on moyenne les scores
    cv = StratifiedKFold(n_splits=5, shuffle=True,
                         random_state=42)
    cv_scores = cross_val_score(
        pipeline, X, y, cv=cv, scoring='accuracy')
    print(f"📊 Cross-validation 5-fold :")
    print(f"   Scores : {[f'{s:.3f}' for s in cv_scores]}")
    print(f"   Moyenne : {cv_scores.mean():.4f} "
          f"± {cv_scores.std():.4f}")

    # ── Matrice de confusion ──
    classes = sorted(y.unique().tolist())
    cm = confusion_matrix(y_test, y_pred, labels=classes)

    fig, ax = plt.subplots(figsize=(max(6, len(classes)*2),
                                    max(5, len(classes)*1.5)))
    sns.heatmap(
        cm, annot=True, fmt='d',
        xticklabels=classes, yticklabels=classes,
        cmap='Blues', ax=ax,
        linewidths=0.5
    )
    ax.set_title(f'Matrice de confusion\n{nom}',
                 fontsize=13, pad=12)
    ax.set_ylabel('Réel', fontsize=11)
    ax.set_xlabel('Prédit', fontsize=11)
    plt.xticks(rotation=30, ha='right')
    plt.tight_layout()
    plt.savefig(f'{MODELS_DIR}/confusion_{nom}.png', dpi=150)
    plt.close()

    # ── Importance des features (si RandomForest) ──
    if classificateur_type == 'rf':
        feature_names = pipeline.named_steps[
            'tfidf'].get_feature_names_out()
        importances = pipeline.named_steps[
            'clf'].feature_importances_
        top_idx = np.argsort(importances)[-20:][::-1]
        top_features = [(feature_names[i],
                         importances[i]) for i in top_idx]

        print(f"\n🔍 Top 10 mots/expressions importants :")
        for feat, imp in top_features[:10]:
            print(f"   '{feat}' → {imp:.4f}")

    # ── Sauvegarder le modèle ──
    chemin = f'{MODELS_DIR}/{nom}.joblib'
    joblib.dump(pipeline, chemin)
    print(f"\n💾 Modèle sauvegardé : {chemin}")

    return pipeline, {
        'accuracy': float(accuracy),
        'f1': float(f1),
        'cv_mean': float(cv_scores.mean()),
        'cv_std': float(cv_scores.std()),
        'n_train': len(X_train),
        'n_test': len(X_test),
        'classes': sorted(y.unique().tolist())
    }

# ══════════════════════════════════════════════════
# ─── ENTRAÎNEMENT DES 5 MODÈLES ───
# ══════════════════════════════════════════════════

metriques = {}

# ── Modèle 1 : Catégorie ──
# RandomForest → bien pour classes peu nombreuses
# et très distinctes (hardware vs software vs réseau)
m1, met1 = entrainer_et_sauvegarder(
    X, df['categorie'],
    'modele_categorie', 'rf')
metriques['categorie'] = met1

# ── Modèle 2 : Type de service ──
# LogisticRegression → mieux pour classes
# qui se chevauchent (reparation vs depannage)
m2, met2 = entrainer_et_sauvegarder(
    X, df['type_service'],
    'modele_type_service', 'lr')
metriques['type_service'] = met2

# ── Modèle 3 : Urgence ──
# RandomForest → robuste pour 4 classes ordinales
m3, met3 = entrainer_et_sauvegarder(
    X, df['urgence'],
    'modele_urgence', 'rf')
metriques['urgence'] = met3

# ── Modèle 4 : Origine du problème ──
# LogisticRegression → bonne pour
# descriptions longues et précises
m4, met4 = entrainer_et_sauvegarder(
    X, df['origine_probleme'],
    'modele_origine', 'lr')
metriques['origine'] = met4

# ── Modèle 5 : Spécialité technicien ──
# RandomForest → simple et efficace
m5, met5 = entrainer_et_sauvegarder(
    X, df['specialite_requise'],
    'modele_specialite', 'rf')
metriques['specialite'] = met5

# ══════════════════════════════════════════════════
# ─── RAPPORT FINAL ───
# ══════════════════════════════════════════════════

print("\n" + "=" * 55)
print("RÉSUMÉ FINAL DES PERFORMANCES")
print("=" * 55)
print(f"{'Modèle':<25} {'Accuracy':>10} {'F1':>8} {'CV':>10}")
print("─" * 55)
for nom, m in metriques.items():
    print(f"{nom:<25} "
          f"{m['accuracy']*100:>9.1f}% "
          f"{m['f1']*100:>7.1f}% "
          f"{m['cv_mean']*100:>9.1f}%")

# Sauvegarder les métriques
with open(f'{MODELS_DIR}/metriques.json', 'w',
          encoding='utf-8') as f:
    json.dump(metriques, f, indent=2, ensure_ascii=False)

print(f"\n✅ Entraînement terminé !")
print(f"📁 Modèles sauvegardés dans : {MODELS_DIR}/")
print(f"📊 Métriques sauvegardées : {MODELS_DIR}/metriques.json")