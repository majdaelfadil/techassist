# interventions/ml/train_models.py
"""
ÉTAPE 2 : ENTRAÎNEMENT DES MODÈLES
=====================================
Entraîne 7 modèles :
1. categorie
2. type_service
3. urgence
4. origine_probleme
5. specialite_requise
6. solution       ← NOUVEAU
7. duree          ← NOUVEAU (régression)

Et génère les matrices de confusion + métriques.
"""

import os
import json
import joblib
import pandas as pd
import numpy as np

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, classification_report,
    confusion_matrix, mean_absolute_error, r2_score
)

# ── Chemins ──
ML_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(
    ML_DIR, 'dataset_interventions.csv')
MODELS_DIR = os.path.join(ML_DIR, 'models')
os.makedirs(MODELS_DIR, exist_ok=True)


# ══════════════════════════════════════════════════
# PRÉTRAITEMENT
# ══════════════════════════════════════════════════

def pretraiter(texte):
    """Nettoyage simple du texte."""
    import re
    texte = str(texte).lower()
    texte = re.sub(r'[^\w\s\'\-]', ' ', texte)
    texte = re.sub(r'\s+', ' ', texte).strip()
    return texte


# ══════════════════════════════════════════════════
# ENTRAÎNEMENT D'UN CLASSIFICATEUR
# ══════════════════════════════════════════════════

def entrainer_classificateur(
        X_train, X_test,
        y_train, y_test,
        nom_modele):
    """
    Entraîne un Pipeline TF-IDF + RandomForest
    pour la classification.

    Les hyperparamètres sont adaptés selon
    le nombre de classes à prédire :
    - Peu de classes (3-5) → modèle plus profond
      pour bien séparer les frontières
    - Beaucoup de classes (8+) → modèle plus
      régularisé pour éviter le surapprentissage

    Retourne : modele, métriques
    """
    print(f"\n{'─'*50}")
    print(f"  Modèle : {nom_modele.upper()}")
    print(f"{'─'*50}")

    nb_classes = len(set(y_train))
    print(f"  Nombre de classes : {nb_classes}")

    # ── Hyperparamètres adaptatifs ──
    if nb_classes <= 5:
        # Tâches simples (categorie, urgence,
        # type_service, specialite)
        # → garder plus de profondeur
        max_depth = 22
        min_samples_split = 2
        min_samples_leaf = 1
        max_features = 3000
        min_df = 2
    else:
        # Tâches complexes (solution, origine)
        # → régulariser plus pour éviter
        # le surapprentissage sur de
        # nombreuses classes peu fréquentes
        max_depth = 16
        min_samples_split = 3
        min_samples_leaf = 2
        max_features = 2500
        min_df = 3

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=max_features,
            min_df=min_df,
            max_df=0.92,
            sublinear_tf=True
        )),
        ('clf', RandomForestClassifier(
            n_estimators=300,
            max_depth=max_depth,
            min_samples_split=min_samples_split,
            min_samples_leaf=min_samples_leaf,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        ))
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    # ── Validation croisée 5-fold ──
    try:
        scores_cv = cross_val_score(
            pipeline, X_train, y_train,
            cv=5, scoring='accuracy',
            n_jobs=-1
        )
        print(
            f"  CV 5-fold  : "
            f"{scores_cv.mean()*100:.2f}% "
            f"(+/- {scores_cv.std()*100:.2f}%)"
        )
    except Exception as e:
        print(f"  ⚠️ Validation croisée : {e}")

    acc = accuracy_score(y_test, y_pred)
    rapport = classification_report(
        y_test, y_pred,
        zero_division=0,
        output_dict=True
    )

    classes = sorted(set(y_test))
    cm = confusion_matrix(
        y_test, y_pred, labels=classes)

    print(f"  Accuracy  : {acc:.4f} ({acc*100:.2f}%)")
    print(f"  F1 macro  : {rapport['macro avg']['f1-score']:.4f}")
    print(f"\n  Rapport détaillé :")
    print(classification_report(
        y_test, y_pred, zero_division=0))

    # Sauvegarder matrice de confusion
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import seaborn as sns

        plt.figure(figsize=(8, 6))
        sns.heatmap(
            cm,
            annot=True,
            fmt='d',
            cmap='Blues',
            xticklabels=classes,
            yticklabels=classes
        )
        plt.title(
            f'Matrice de confusion — {nom_modele}')
        plt.ylabel('Réel')
        plt.xlabel('Prédit')
        plt.tight_layout()
        plt.savefig(
            os.path.join(
                MODELS_DIR,
                f'confusion_{nom_modele}.png'),
            dpi=100,
            bbox_inches='tight'
        )
        plt.close()
        print(f"  ✅ Matrice sauvegardée")
    except Exception as e:
        print(f"  ⚠️ Matplotlib : {e}")

    metriques = {
        'accuracy': round(acc * 100, 2),
        'f1_macro': round(
            rapport['macro avg']['f1-score']
            * 100, 2),
        'f1_weighted': round(
            rapport['weighted avg']['f1-score']
            * 100, 2),
        'classes': classes,
    }

    return pipeline, metriques


# ══════════════════════════════════════════════════
# ENTRAÎNEMENT DU RÉGRESSEUR (DURÉE)
# ══════════════════════════════════════════════════

def entrainer_regresseur(
        X_train, X_test,
        y_train, y_test):
    """
    Entraîne un Pipeline TF-IDF + RandomForest
    pour prédire la durée (régression).
    """
    print(f"\n{'─'*50}")
    print(f"  Modèle : DURÉE (régression)")
    print(f"{'─'*50}")

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=2000,
            min_df=3,
            max_df=0.90,
            sublinear_tf=True
        )),
        ('reg', RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_split=4,
            min_samples_leaf=3,
            random_state=42,
            n_jobs=-1
        ))
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"  MAE : {mae:.3f}h")
    print(f"  R²  : {r2:.3f}")
    print(f"\n  Exemples prédictions :")
    print(f"  {'Réel':>6} | {'Prédit':>7}")
    print(f"  {'─'*6}+{'─'*8}")
    for r, p in zip(y_test[:8], y_pred[:8]):
        flag = "✓" if abs(r - p) <= 0.5 else "✗"
        print(f"  {r:>5.1f}h | {p:>6.2f}h {flag}")

    metriques = {
        'mae': round(mae, 3),
        'r2': round(r2, 3),
    }

    return pipeline, metriques


# ══════════════════════════════════════════════════
# PIPELINE PRINCIPAL
# ══════════════════════════════════════════════════

def entrainer_tous():
    """
    Pipeline complet :
    1. Charger le dataset
    2. Préparer les données
    3. Entraîner les 7 modèles
    4. Sauvegarder avec joblib
    5. Sauvegarder les métriques JSON
    """

    print("=" * 55)
    print("  TECHASSIST AI — ENTRAÎNEMENT NLP")
    print("=" * 55)

    # ── 1. Charger le dataset ──
    if not os.path.exists(DATASET_PATH):
        print(f"❌ Dataset manquant : {DATASET_PATH}")
        print("→ Lancez d'abord generate_dataset.py")
        return False

    df = pd.read_csv(
        DATASET_PATH, encoding='utf-8')
    print(f"\n✅ Dataset chargé : {len(df)} exemples")

    # ── 2. Prétraiter les descriptions ──
    df['description_clean'] = df[
        'description'].apply(pretraiter)

    X = df['description_clean'].tolist()

    # ── 3. Définir les cibles ──
    cibles = {
        'categorie':         df['categorie'].tolist(),
        'type_service':      df['type_service'].tolist(),
        'urgence':           df['urgence'].tolist(),
        'origine':           df['origine_probleme'].tolist(),
        'specialite':        df['specialite_requise'].tolist(),
    }
    # ── 'solution' n'est PAS entraînée comme
    # modèle ML séparé. Elle est une fonction
    # déterministe de (categorie, type_service)
    # — cf. SOLUTIONS_TEXTE dans generate_dataset.py
    # — donc on la dérive directement à partir
    # des prédictions categorie/type_service
    # dans predictor.py, ce qui garantit 100%
    # de cohérence au lieu de faire réapprendre
    # au modèle une relation déjà connue,
    # ce qui plafonnait sa confiance à ~45%.

    # Durée (régression)
    y_duree = df['duree'].astype(float).tolist()

    # ── 4. Split train/test ──
    (X_train, X_test,
     y_cat_train, y_cat_test,
     y_ts_train, y_ts_test,
     y_urg_train, y_urg_test,
     y_ori_train, y_ori_test,
     y_spec_train, y_spec_test,
     y_dur_train, y_dur_test) = train_test_split(
        X,
        cibles['categorie'],
        cibles['type_service'],
        cibles['urgence'],
        cibles['origine'],
        cibles['specialite'],
        y_duree,
        test_size=0.2,
        random_state=42,
        stratify=cibles['categorie']
    )

    print(f"\nSplit :")
    print(f"  Train : {len(X_train)} exemples")
    print(f"  Test  : {len(X_test)} exemples")

    # ── 5. Entraîner les modèles ──
    toutes_metriques = {}

    # Modèle 1 : catégorie
    m_cat, met_cat = entrainer_classificateur(
        X_train, X_test,
        y_cat_train, y_cat_test,
        'modele_categorie'
    )
    toutes_metriques['categorie'] = met_cat
    joblib.dump(
        m_cat,
        os.path.join(MODELS_DIR,
                     'modele_categorie.joblib'))

    # Modèle 2 : type_service
    m_ts, met_ts = entrainer_classificateur(
        X_train, X_test,
        y_ts_train, y_ts_test,
        'modele_type_service'
    )
    toutes_metriques['type_service'] = met_ts
    joblib.dump(
        m_ts,
        os.path.join(MODELS_DIR,
                     'modele_type_service.joblib'))

    # Modèle 3 : urgence
    m_urg, met_urg = entrainer_classificateur(
        X_train, X_test,
        y_urg_train, y_urg_test,
        'modele_urgence'
    )
    toutes_metriques['urgence'] = met_urg
    joblib.dump(
        m_urg,
        os.path.join(MODELS_DIR,
                     'modele_urgence.joblib'))

    # Modèle 4 : origine
    m_ori, met_ori = entrainer_classificateur(
        X_train, X_test,
        y_ori_train, y_ori_test,
        'modele_origine'
    )
    toutes_metriques['origine'] = met_ori
    joblib.dump(
        m_ori,
        os.path.join(MODELS_DIR,
                     'modele_origine.joblib'))

    # Modèle 5 : specialite
    m_spec, met_spec = entrainer_classificateur(
        X_train, X_test,
        y_spec_train, y_spec_test,
        'modele_specialite'
    )
    toutes_metriques['specialite'] = met_spec
    joblib.dump(
        m_spec,
        os.path.join(MODELS_DIR,
                     'modele_specialite.joblib'))

    # Modèle 6 : durée ← NOUVEAU
    # (le modèle 'solution' a été retiré :
    # il est désormais dérivé directement des
    # prédictions categorie + type_service,
    # voir predictor.py)
    m_dur, met_dur = entrainer_regresseur(
        X_train, X_test,
        y_dur_train, y_dur_test
    )
    toutes_metriques['duree'] = met_dur
    joblib.dump(
        m_dur,
        os.path.join(MODELS_DIR,
                     'modele_duree.joblib'))

    # ── 6. Sauvegarder métriques JSON ──
    metriques_path = os.path.join(
        MODELS_DIR, 'metriques.json')
    with open(metriques_path, 'w',
              encoding='utf-8') as f:
        json.dump(
            toutes_metriques, f,
            indent=2,
            ensure_ascii=False)

    # ── 7. Résumé final ──
    print("\n" + "=" * 55)
    print("  RÉSUMÉ DES PERFORMANCES")
    print("=" * 55)
    for nom, met in toutes_metriques.items():
        if nom == 'duree':
            print(
                f"  {nom:15s} : "
                f"MAE={met['mae']}h  "
                f"R²={met['r2']}")
        else:
            print(
                f"  {nom:15s} : "
                f"Acc={met['accuracy']}%  "
                f"F1={met['f1_macro']}%")

    print("\n✅ Tous les modèles sauvegardés :")
    print(f"   {MODELS_DIR}")
    print("\nFichiers créés :")
    for f in os.listdir(MODELS_DIR):
        if f.endswith('.joblib'):
            print(f"  → {f}")

    return True


if __name__ == '__main__':
    entrainer_tous()