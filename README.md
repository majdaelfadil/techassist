# TechAssist - Gestion Interventions

## Fonctionnalités principales
- Gestion clients, techniciens, agents
- Création interventions avec diagnostic IA
- Planning techniciens avec vérif conflits
- Gestion pièces/stock
- Génération rapports IA
- Facturation automatique
- Dashboard role-based

## Installation
```
cd frontend
npm install
npm start

cd ../
python -m venv env
env\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Rôles
- **Responsable** : Tout accès
- **Agent** : Interventions, clients
- **Technicien** : Mes interventions, pièces, planning

## Anti-double assign ✅
**Backend validation** : Conflits bloqués même date/heure (duree_estimee)
```
400 "Conflit de planning" + liste conflits
Horaires Maroc 8h30-13h / 15h-19h
```

**Test** : /interventions → Assigner technicien
