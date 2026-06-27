# TechAssist - Gestion Interventions

## Fonctionnalités principales
- Gestion clients, techniciens, agents
- Création interventions avec diagnostic IA (5 classifieurs ML)
- Planning techniciens avec vérif conflits
- Gestion pièces/stock
- Génération rapports IA
- Facturation automatique
- Dashboard role-based
- **Administration** : gestion des utilisateurs (CRUD, rôles, mots de passe) et statistiques système — réservée au rôle Admin
- 4 rôles avec menus et permissions dédiés (Admin, Responsable, Agent, Technicien)

---

## Prérequis

- Python 3.10+
- Node.js 18+
- PostgreSQL (ou SQLite pour le dev local)

---

## Installation & Lancement

### 1. Cloner le projet

```bash
git clone <repo-url>
cd techassist
```

### 2. Backend Django

```bash
# Créer et activer l'environnement virtuel
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

# Installer les dépendances
pip install -r requirements.txt
pip install joblib scikit-learn==1.7.2   # pour le module ML

# Configurer les variables d'environnement
# Créer un fichier "env" à la racine avec :
#   SECRET_KEY=your-secret-key
#   DEBUG=True
#   DB_NAME=techassist_db
#   DB_USER=postgres
#   DB_PASSWORD=your-password
#   DB_HOST=localhost
#   DB_PORT=5432
#
# Pour SQLite (dev sans PostgreSQL), remplacer dans settings.py :
#   DATABASES = { 'default': { 'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3' } }

# Appliquer les migrations
python manage.py migrate

# Créer un superutilisateur Django (accès /admin/)
python manage.py createsuperuser

# Créer un compte applicatif "Admin" (menu Administration dans l'app)
python manage.py shell -c "from django.contrib.auth.models import User; from interventions.models import ProfilUtilisateur; u,_=User.objects.get_or_create(username='admin'); u.set_password('admin123'); u.is_active=True; u.save(); ProfilUtilisateur.objects.update_or_create(user=u, defaults={'role':'admin'})"

# Lancer le serveur Django (port 8000)
python manage.py runserver
```

> Une fois connecté avec un compte **Admin** (`admin` / `admin123`), le menu **Administration** permet de créer tous les autres comptes (responsable, agent, technicien) sans passer par la ligne de commande.

### 3. Frontend React

```bash
cd frontend
npm install
npm start        # ouvre http://localhost:3000
```

### 4. Module ML (optionnel — modèles déjà entraînés)

Le diagnostic IA repose sur **5 classifieurs** (TF-IDF + RandomForest / LogisticRegression / LinearSVC) qui prédisent, à partir de la description d'un problème en français : `catégorie`, `type de service`, `urgence`, `origine du problème`, `spécialité requise`. Les modèles `.joblib` sont déjà présents dans `ml/models/`.

```bash
# Regénérer le dataset français + ré-entraîner les 5 modèles
python ml/generate_french_dataset.py
python ml/train_models.py

# Évaluer (benchmark 455 cas) et validation réaliste indépendante
python ml/test_1000_real.py
python ml/validation_independante.py

# Tester une prédiction directe
python test_ml.py
```

Les taxonomies consolidées (`ml/origine_mapping.py`, `ml/type_service_mapping.py`) sont appliquées à l'entraînement **et** au test. Performance honnête mesurée sur des tickets réels indépendants : **~83 %** en moyenne.

---

## URLs

| Service | URL |
|---------|-----|
| Frontend (React) | http://localhost:3000 |
| Backend API | http://localhost:8000/api/ |
| Admin Django | http://localhost:8000/admin/ |

---

## Rôles & permissions

4 rôles, chacun avec son menu et ses accès. Le rôle est stocké dans
`ProfilUtilisateur.role` et appliqué côté backend (permissions DRF :
`EstAdmin`, `EstResponsable`, `EstAgent`, `EstTechnicien`) **et** côté frontend
(menus + routes protégées).

| Rôle | Accès |
|------|-------|
| **Admin** | Administration (création/gestion des comptes, statistiques système) + accès complet |
| **Responsable** *(Manager)* | Dashboard · Interventions (créer, diagnostic IA, planifier, **assigner technicien**) · Planning techniciens · Gestion techniciens · Stock pièces · **Valider** rapports & interventions |
| **Agent d'accueil** *(Réception)* | Dashboard · Interventions (consulter) · Clients (rechercher/créer + historique) · Appareils · Factures |
| **Technicien** | Dashboard · Mes interventions (notes techniques, pièces utilisées, rapport IA) · Mon planning · Stock pièces · Mes rapports |

### Workflows

- **Responsable** : créer intervention → (diagnostic IA) → planifier → vérifier planning → assigner technicien → valider rapport → valider intervention
- **Agent** : rechercher/créer client → enregistrer appareil → intervention créée → gérer la facture
- **Technicien** : consulter interventions assignées → saisir notes → ajouter pièces → générer rapport IA → (modifier) → enregistrer pour validation

---

## Anti-double assign

**Backend validation** : Conflits bloqués même date/heure (`duree_estimee`)

```
400 "Conflit de planning" + liste conflits
Horaires Maroc 8h30-13h / 15h-19h
```

**Test** : `/interventions` → Assigner technicien
