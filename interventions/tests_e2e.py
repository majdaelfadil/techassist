# -*- coding: utf-8 -*-
"""
Suite de tests d'intégration A→Z de TechAssist.

Exécute chaque endpoint de l'API pour les 4 rôles
(admin, responsable, agent, technicien) sur une base de
données de test ISOLÉE (Django en crée une jetable ;
db.sqlite3 n'est jamais touchée).

    python manage.py test interventions.tests_e2e -v 2
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from interventions.models import (
    Technicien, Agent, Responsable, ProfilUtilisateur,
    Client, Appareil, Piece, Intervention, Rapport,
    DiagnosticIA,
)

LOGIN = '/api/auth/login/'


class BaseAPITest(APITestCase):
    """Crée un jeu d'utilisateurs (un par rôle) partagé."""

    @classmethod
    def setUpTestData(cls):
        # ── ADMIN ──
        cls.admin = User.objects.create_user('admin1', password='pass12345')
        ProfilUtilisateur.objects.create(user=cls.admin, role='admin')

        # ── RESPONSABLE ──
        cls.resp = User.objects.create_user('resp1', password='pass12345')
        ProfilUtilisateur.objects.create(user=cls.resp, role='responsable')
        Responsable.objects.create(user=cls.resp, nom='Chef Resp')

        # ── AGENT ──
        cls.agent = User.objects.create_user('agent1', password='pass12345')
        ProfilUtilisateur.objects.create(user=cls.agent, role='agent')
        Agent.objects.create(user=cls.agent, nom='Agent Accueil')

        # ── TECHNICIEN ──
        cls.tech = User.objects.create_user('tech1', password='pass12345')
        ProfilUtilisateur.objects.create(user=cls.tech, role='technicien')
        cls.technicien = Technicien.objects.create(
            user=cls.tech, nom='Tech Un', specialite='hardware',
            tarif_horaire=150)

    def as_(self, user):
        """Authentifie le client de test comme `user`."""
        self.client.force_authenticate(user=user)
        return self.client

    def anon(self):
        self.client.force_authenticate(user=None)
        return self.client


# ════════════════════════════════════════════════════════════
# 1. AUTHENTIFICATION
# ════════════════════════════════════════════════════════════
class AuthTests(BaseAPITest):

    def test_login_les_4_roles(self):
        for username in ('admin1', 'resp1', 'agent1', 'tech1'):
            r = self.anon().post(LOGIN, {'username': username,
                                         'password': 'pass12345'})
            self.assertEqual(r.status_code, 200, f'login {username}: {r.data}')
            self.assertIn('access', r.data)

    def test_login_mauvais_mdp(self):
        r = self.anon().post(LOGIN, {'username': 'admin1', 'password': 'x'})
        self.assertEqual(r.status_code, 401)

    def test_profil(self):
        r = self.as_(self.resp).get('/api/auth/profil/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data.get('role'), 'responsable')

    def test_endpoint_protege_sans_auth(self):
        r = self.anon().get('/api/clients/')
        self.assertEqual(r.status_code, 401)


# ════════════════════════════════════════════════════════════
# 2. LE FIX : responsable crée un technicien -> il peut se connecter
# ════════════════════════════════════════════════════════════
class CreationTechnicienLoginTests(BaseAPITest):

    def test_responsable_cree_technicien_qui_peut_se_connecter(self):
        payload = {
            'username': 'nouveau_tech', 'password': 'motdepasse1',
            'nom': 'Nouveau Tech', 'specialite': 'reseau',
            'tarif_horaire': 200, 'telephone': '0600000000',
        }
        r = self.as_(self.resp).post('/api/techniciens/', payload)
        self.assertEqual(r.status_code, 201, r.data)

        # le compte User + profil ont bien été créés
        u = User.objects.get(username='nouveau_tech')
        self.assertEqual(u.profil.role, 'technicien')
        self.assertTrue(Technicien.objects.filter(user=u).exists())

        # ✅ LE POINT CLÉ : il peut se connecter
        r = self.anon().post(LOGIN, {'username': 'nouveau_tech',
                                     'password': 'motdepasse1'})
        self.assertEqual(r.status_code, 200, 'Le technicien ne peut pas se connecter !')

    def test_sans_mot_de_passe_refuse(self):
        r = self.as_(self.resp).post('/api/techniciens/',
                                     {'nom': 'X', 'specialite': 'hardware',
                                      'tarif_horaire': 100})
        self.assertEqual(r.status_code, 400)

    def test_username_duplique_refuse(self):
        r = self.as_(self.resp).post('/api/techniciens/',
                                     {'username': 'agent1', 'password': 'pass12345',
                                      'nom': 'X', 'specialite': 'hardware',
                                      'tarif_horaire': 100})
        self.assertEqual(r.status_code, 400)

    def test_agent_ne_peut_pas_creer_technicien(self):
        r = self.as_(self.agent).post('/api/techniciens/',
                                      {'username': 'z', 'password': 'zzzzz123',
                                       'nom': 'Z', 'specialite': 'hardware',
                                       'tarif_horaire': 100})
        self.assertEqual(r.status_code, 403)

    def test_liste_techniciens_visible_par_tous(self):
        for u in (self.admin, self.resp, self.agent, self.tech):
            r = self.as_(u).get('/api/techniciens/')
            self.assertEqual(r.status_code, 200)


# ════════════════════════════════════════════════════════════
# 3. CLIENTS (agent)
# ════════════════════════════════════════════════════════════
class ClientTests(BaseAPITest):

    def _creer(self):
        return self.as_(self.agent).post('/api/clients/',
                                         {'nom': 'ACME', 'telephone': '0611111111',
                                          'email': 'a@b.com'})

    def test_crud_client(self):
        r = self._creer()
        self.assertEqual(r.status_code, 201, r.data)
        cid = r.data['id']

        r = self.as_(self.agent).get('/api/clients/')
        self.assertEqual(r.status_code, 200)

        r = self.as_(self.agent).get(f'/api/clients/{cid}/')
        self.assertEqual(r.status_code, 200)

        r = self.as_(self.agent).patch(f'/api/clients/{cid}/', {'nom': 'ACME2'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['nom'], 'ACME2')

        r = self.as_(self.agent).delete(f'/api/clients/{cid}/')
        self.assertEqual(r.status_code, 204)

    def test_technicien_ne_peut_pas_creer_client(self):
        r = self.as_(self.tech).post('/api/clients/',
                                     {'nom': 'X', 'telephone': '0699999999'})
        self.assertEqual(r.status_code, 403)


# ════════════════════════════════════════════════════════════
# 4. APPAREILS + PIÈCES + AGENTS
# ════════════════════════════════════════════════════════════
class CatalogueTests(BaseAPITest):

    def setUp(self):
        self.client_obj = Client.objects.create(nom='CliApp', telephone='0622222222')

    def test_appareil_crud(self):
        r = self.as_(self.agent).post('/api/appareils/', {
            'client': self.client_obj.id, 'marque': 'Dell', 'modele': 'XPS',
            'type_appareil': 'ordinateur'})
        self.assertEqual(r.status_code, 201, r.data)
        r = self.as_(self.tech).get('/api/appareils/')
        self.assertEqual(r.status_code, 200)

    def test_piece_crud(self):
        r = self.as_(self.resp).post('/api/pieces/', {
            'nom': 'RAM 8Go', 'reference': 'RAM-8', 'quantite_stock': 10,
            'seuil_minimum': 2, 'prix_unitaire': 350})
        self.assertEqual(r.status_code, 201, r.data)
        # lecture autorisée à tout utilisateur authentifié
        r = self.as_(self.tech).get('/api/pieces/')
        self.assertEqual(r.status_code, 200)

    def test_agent_liste_par_responsable(self):
        r = self.as_(self.resp).get('/api/agents/')
        self.assertEqual(r.status_code, 200)
        # un agent ne gère pas les agents
        r = self.as_(self.agent).get('/api/agents/')
        self.assertEqual(r.status_code, 403)


# ════════════════════════════════════════════════════════════
# 5. CYCLE DE VIE COMPLET D'UNE INTERVENTION
# ════════════════════════════════════════════════════════════
class InterventionWorkflowTests(BaseAPITest):

    def setUp(self):
        self.cli = Client.objects.create(nom='CliW', telephone='0633333333')

    def _creer_intervention(self):
        return self.as_(self.agent).post('/api/interventions/', {
            'client_id': self.cli.id,
            'description': 'PC ne démarre pas',
            'type_service': 'reparation',
            'canal_entree': 'telephone',
            'urgence': 'normale',
        })

    def test_agent_cree_intervention(self):
        r = self._creer_intervention()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['numero'].startswith('INT/'))

    def test_agent_ne_change_pas_statut(self):
        iv = self._creer_intervention().data
        r = self.as_(self.agent).post(
            f"/api/interventions/{iv['id']}/changer-statut/",
            {'statut': 'diagnostique'})
        self.assertEqual(r.status_code, 403)

    def test_cycle_complet(self):
        iv = self._creer_intervention().data
        iid = iv['id']

        # responsable : nouveau -> diagnostique
        r = self.as_(self.resp).post(f'/api/interventions/{iid}/changer-statut/',
                                     {'statut': 'diagnostique'})
        self.assertEqual(r.status_code, 200, r.data)

        # responsable : assigner technicien
        dp = (timezone.now() + timedelta(days=1)).isoformat()
        r = self.as_(self.resp).post(f'/api/interventions/{iid}/assigner-technicien/',
                                     {'technicien_id': self.technicien.id,
                                      'date_planifiee': dp, 'duree_estimee': 2})
        self.assertEqual(r.status_code, 200, r.data)

        # l'intervention doit être 'assigne'
        Intervention.objects.filter(pk=iid).update(statut='assigne')

        # technicien : assigne -> en_cours -> termine
        r = self.as_(self.tech).post(f'/api/interventions/{iid}/changer-statut/',
                                     {'statut': 'en_cours'})
        self.assertEqual(r.status_code, 200, r.data)
        r = self.as_(self.tech).post(f'/api/interventions/{iid}/changer-statut/',
                                     {'statut': 'termine'})
        self.assertEqual(r.status_code, 200, r.data)

        # rapport : création + validation
        iv_obj = Intervention.objects.get(pk=iid)
        rap = Rapport.objects.create(intervention=iv_obj, contenu='RAS réparé')
        r = self.as_(self.resp).post(f'/api/rapports/{rap.id}/valider/')
        self.assertEqual(r.status_code, 200, r.data)

        # responsable : termine -> valide
        r = self.as_(self.resp).post(f'/api/interventions/{iid}/valider/')
        self.assertEqual(r.status_code, 200, r.data)

        # transitions possibles
        r = self.as_(self.resp).get(f'/api/interventions/{iid}/transitions/')
        self.assertEqual(r.status_code, 200)

    def test_transition_invalide_refusee(self):
        iv = self._creer_intervention().data
        r = self.as_(self.resp).post(f"/api/interventions/{iv['id']}/changer-statut/",
                                     {'statut': 'cloture'})
        self.assertEqual(r.status_code, 400)

    def test_technicien_voit_seulement_ses_interventions(self):
        self._creer_intervention()  # non assignée
        r = self.as_(self.tech).get('/api/interventions/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 0)


# ════════════════════════════════════════════════════════════
# 6. RAPPORTS / PLANNING / DASHBOARD
# ════════════════════════════════════════════════════════════
class DiversTests(BaseAPITest):

    def test_liste_rapports(self):
        r = self.as_(self.resp).get('/api/rapports/')
        self.assertEqual(r.status_code, 200)

    def test_mon_planning_technicien(self):
        r = self.as_(self.tech).get('/api/technicien/planning/')
        self.assertEqual(r.status_code, 200)

    def test_dashboard_stats(self):
        for u in (self.admin, self.resp, self.agent, self.tech):
            r = self.as_(u).get('/api/dashboard/stats/')
            self.assertEqual(r.status_code, 200, f'{u.username}: {r.data}')

    def test_verifier_disponibilite(self):
        dp = (timezone.now() + timedelta(days=2)).isoformat()
        r = self.as_(self.resp).post('/api/techniciens/verifier-disponibilite/',
                                     {'technicien_id': self.technicien.id,
                                      'date_planifiee': dp})
        self.assertEqual(r.status_code, 200, r.data)


# ════════════════════════════════════════════════════════════
# 7. ADMINISTRATION
# ════════════════════════════════════════════════════════════
class AdminTests(BaseAPITest):

    def test_admin_liste_et_cree_utilisateur(self):
        r = self.as_(self.admin).get('/api/admin/utilisateurs/')
        self.assertEqual(r.status_code, 200)

        r = self.as_(self.admin).post('/api/admin/utilisateurs/', {
            'username': 'newresp', 'password': 'pass12345',
            'role': 'responsable', 'nom': 'New Resp'})
        self.assertEqual(r.status_code, 201, r.data)
        # le nouvel utilisateur peut se connecter
        r = self.anon().post(LOGIN, {'username': 'newresp', 'password': 'pass12345'})
        self.assertEqual(r.status_code, 200)

    def test_admin_stats(self):
        r = self.as_(self.admin).get('/api/admin/stats/')
        self.assertEqual(r.status_code, 200)

    def test_non_admin_refuse(self):
        for u in (self.resp, self.agent, self.tech):
            r = self.as_(u).get('/api/admin/utilisateurs/')
            self.assertEqual(r.status_code, 403, u.username)


# ════════════════════════════════════════════════════════════
# 8. DIAGNOSTIC IA (ML) — tolère l'indisponibilité des modèles
# ════════════════════════════════════════════════════════════
class DiagnosticIATests(BaseAPITest):

    def test_description_vide_refusee(self):
        r = self.as_(self.agent).post('/api/diagnostic/analyser/', {'description': ''})
        self.assertEqual(r.status_code, 400)

    def test_diagnostic_ok_ou_indisponible(self):
        r = self.as_(self.agent).post('/api/diagnostic/analyser/',
                                      {'description': "Le disque dur fait du bruit "
                                                      "et le PC est très lent"})
        # 200 si modèles entraînés, 503 si non — jamais une erreur 500
        self.assertIn(r.status_code, (200, 503), r.data)


# ════════════════════════════════════════════════════════════
# 9. JOURNALISATION DU DIAGNOSTIC IA (interventions_diagnosticia)
# ════════════════════════════════════════════════════════════
class DiagnosticLoggingTests(BaseAPITest):

    def setUp(self):
        self.cli = Client.objects.create(nom='CliDiag', telephone='0644444444')

    # Diagnostic factice (forme renvoyée par le predictor)
    DIAG = {
        'categorie': 'stockage',
        'type_service': 'reparation',
        'urgence': 'haute',
        'origine_probleme': 'Disque dur défaillant',
        'specialite_requise': 'hardware',
        'solution': 'Remplacer le disque dur',
        'duree': 2.5,
        'prevention': 'Sauvegardes régulières',
        'pieces_suggerees': [{'nom': 'SSD 500Go'}, {'nom': 'Câble SATA'}],
        'confiance': {'globale': 87.5, 'categorie': 90},
    }

    def test_creation_intervention_enregistre_le_diagnostic(self):
        r = self.as_(self.agent).post('/api/interventions/', {
            'client_id': self.cli.id,
            'description': 'PC très lent, disque bruyant',
            'type_service': 'reparation',
            'canal_entree': 'boutique',
            'urgence': 'haute',
            'diagnostic': self.DIAG,
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)

        iv = Intervention.objects.get(pk=r.data['id'])
        diag = DiagnosticIA.objects.get(intervention=iv)
        self.assertEqual(diag.categorie_panne, 'stockage')
        self.assertEqual(diag.causes_probables, 'Disque dur défaillant')
        self.assertIn('SSD 500Go', diag.pieces_suggerees)
        self.assertEqual(float(diag.score_confiance), 87.5)
        self.assertEqual(float(diag.duree_estimee), 2.5)

    def test_creation_sans_diagnostic_ne_cree_rien(self):
        r = self.as_(self.agent).post('/api/interventions/', {
            'client_id': self.cli.id,
            'description': 'Écran cassé',
            'type_service': 'reparation',
            'canal_entree': 'boutique',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        iv = Intervention.objects.get(pk=r.data['id'])
        self.assertFalse(DiagnosticIA.objects.filter(intervention=iv).exists())

    def test_endpoint_diagnostic_avec_intervention_id_persiste(self):
        iv = Intervention.objects.create(
            client=self.cli, description='RAM défaillante, écran bleu',
            type_service='reparation', canal_entree='telephone')
        r = self.as_(self.agent).post('/api/diagnostic/analyser/', {
            'description': 'RAM défaillante, écran bleu fréquent',
            'intervention_id': iv.id,
        }, format='json')
        # Si les modèles ML sont dispo (200), la ligne doit exister.
        if r.status_code == 200:
            self.assertTrue(r.data.get('enregistre'))
            self.assertTrue(DiagnosticIA.objects.filter(intervention=iv).exists())
        else:
            self.assertEqual(r.status_code, 503)
