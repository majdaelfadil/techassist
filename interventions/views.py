from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated, BasePermission)
from django.db.models import Count, F
from django.utils import timezone
from django.http import HttpResponse
from .models import (Client, Technicien, Agent,
                     ProfilUtilisateur, Appareil,
                     Piece, Intervention, PieceUtilisee,
                     DiagnosticIA, Rapport, Facture)
from .serializers import (
    ClientSerializer, TechnicienSerializer,
    AgentSerializer, AppareilSerializer,
    PieceSerializer, PieceUtiliseeSerializer,
    InterventionListSerializer,
    InterventionDetailSerializer,
    RapportSerializer, FactureSerializer,
    DiagnosticIASerializer)
from .workflow import (transition_autorisee,
                       get_transitions_possibles)
from .pdf_generator import generer_facture_pdf
from .email_service import (
    envoyer_notification_technicien,
    envoyer_facture_client)

# ════════════════════════════════
# ─── PERMISSIONS ───
# ════════════════════════════════

class EstResponsable(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role == \
               'responsable'

class EstAgentOuResponsable(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role in \
               ['agent', 'responsable']

class EstTechnicien(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role == \
               'technicien'

# ════════════════════════════════
# ─── CLIENTS ───
# ════════════════════════════════

class ClientListCreateView(
        generics.ListCreateAPIView):
    serializer_class = ClientSerializer
    permission_classes = [EstAgentOuResponsable]

    def get_queryset(self):
        queryset = Client.objects.all()
        search = self.request.query_params.get(
            'search')
        telephone = self.request.query_params.get(
            'telephone')
        if search:
            queryset = queryset.filter(
                nom__icontains=search)
        if telephone:
            queryset = queryset.filter(
                telephone__icontains=telephone)
        return queryset

class ClientDetailView(
        generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [EstAgentOuResponsable]

# ════════════════════════════════
# ─── TECHNICIENS ───
# ════════════════════════════════

class TechnicienListView(
        generics.ListCreateAPIView):
    serializer_class = TechnicienSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [EstResponsable()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Technicien.objects.all()
        disponible = self.request.query_params.get(
            'disponible')
        if disponible:
            queryset = queryset.filter(
                disponible=True)
        return queryset

class TechnicienDetailView(
        generics.RetrieveUpdateDestroyAPIView):
    queryset = Technicien.objects.all()
    serializer_class = TechnicienSerializer
    permission_classes = [EstResponsable]

# ════════════════════════════════
# ─── AGENTS ───
# ════════════════════════════════

class AgentListCreateView(
        generics.ListCreateAPIView):
    serializer_class = AgentSerializer
    permission_classes = [EstResponsable]

    def get_queryset(self):
        return Agent.objects.all()

class AgentDetailView(
        generics.RetrieveUpdateDestroyAPIView):
    queryset = Agent.objects.all()
    serializer_class = AgentSerializer
    permission_classes = [EstResponsable]

# ════════════════════════════════
# ─── APPAREILS ───
# ════════════════════════════════

class AppareilListCreateView(
        generics.ListCreateAPIView):
    serializer_class = AppareilSerializer
    permission_classes = [EstAgentOuResponsable]

    def get_queryset(self):
        queryset = Appareil.objects.all()
        client_id = self.request.query_params.get(
            'client_id')
        if client_id:
            queryset = queryset.filter(
                client_id=client_id)
        return queryset

class AppareilDetailView(
        generics.RetrieveUpdateAPIView):
    queryset = Appareil.objects.all()
    serializer_class = AppareilSerializer
    permission_classes = [EstAgentOuResponsable]

# ════════════════════════════════
# ─── PIECES ───
# ════════════════════════════════

class PieceListCreateView(
        generics.ListCreateAPIView):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [EstResponsable()]
        return [IsAuthenticated()]

class PieceDetailView(
        generics.RetrieveUpdateDestroyAPIView):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [EstResponsable()]

# ════════════════════════════════
# ─── INTERVENTIONS ───
# ════════════════════════════════

class InterventionListCreateView(
        generics.ListCreateAPIView):

    def get_permissions(self):
        if self.request.method == 'POST':
            return [EstAgentOuResponsable()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return InterventionDetailSerializer
        return InterventionListSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Intervention.objects.all()

        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                technicien = Technicien.objects.get(
                    user=user)
                queryset = queryset.filter(
                    technicien=technicien)
            except Technicien.DoesNotExist:
                queryset = queryset.none()

        statut = self.request.query_params.get(
            'statut')
        urgence = self.request.query_params.get(
            'urgence')
        technicien_id = self.request.query_params.get(
            'technicien_id')
        client_id = self.request.query_params.get(
            'client_id')

        if statut:
            queryset = queryset.filter(statut=statut)
        if urgence:
            queryset = queryset.filter(urgence=urgence)
        if technicien_id:
            queryset = queryset.filter(
                technicien_id=technicien_id)
        if client_id:
            queryset = queryset.filter(
                client_id=client_id)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class InterventionDetailView(
        generics.RetrieveUpdateDestroyAPIView):
    queryset = Intervention.objects.all()
    serializer_class = InterventionDetailSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [EstAgentOuResponsable()]
        return [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        user = request.user

        # Technicien peut seulement modifier
        # notes_technicien et duree_reelle
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            champs_autorises = {
                'notes_technicien',
                'duree_reelle'
            }
            champs_envoyes = set(request.data.keys())
            champs_interdits = (
                champs_envoyes - champs_autorises)

            if champs_interdits:
                return Response({
                    'erreur': 'Accès refusé',
                    'champs_interdits':
                        list(champs_interdits),
                    'champs_autorises':
                        list(champs_autorises)
                }, status=status.HTTP_403_FORBIDDEN)

        return super().update(
            request, *args, **kwargs)

# ─── CHANGER STATUT ───
class InterventionChangerStatutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(
                pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                if intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN)
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN)

        nouveau_statut = request.data.get('statut')

        if not nouveau_statut:
            return Response(
                {'erreur': 'Statut manquant'},
                status=status.HTTP_400_BAD_REQUEST)

        if not transition_autorisee(
                intervention.statut, nouveau_statut):
            transitions = get_transitions_possibles(
                intervention.statut)
            return Response({
                'erreur': 'Transition non autorisée',
                'statut_actuel': intervention.statut,
                'transitions_possibles': transitions
            }, status=status.HTTP_400_BAD_REQUEST)

        ancien_statut = intervention.statut
        intervention.statut = nouveau_statut

        if nouveau_statut == 'cloture':
            intervention.date_cloture = timezone.now()

        intervention.save()

        return Response({
            'message': 'Statut changé avec succès',
            'ancien_statut': ancien_statut,
            'nouveau_statut': nouveau_statut,
            'transitions_possibles':
                get_transitions_possibles(
                    nouveau_statut)
        }, status=status.HTTP_200_OK)

# ─── TRANSITIONS POSSIBLES ───
class InterventionTransitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            intervention = Intervention.objects.get(
                pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        transitions = get_transitions_possibles(
            intervention.statut)

        return Response({
            'statut_actuel': intervention.statut,
            'transitions_possibles': transitions
        })

# ─── VALIDER INTERVENTION ───
class InterventionValiderView(APIView):
    permission_classes = [EstAgentOuResponsable]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(
                pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        if intervention.statut != 'termine':
            return Response({
                'erreur':
                    'Intervention doit être terminée',
                'statut_actuel': intervention.statut
            }, status=status.HTTP_400_BAD_REQUEST)

        montant_pieces = sum(
            p.quantite * p.prix_unitaire
            for p in
            intervention.pieces_utilisees.all()
        )

        duree = (intervention.duree_reelle or
                 intervention.duree_estimee or 1)
        technicien = intervention.technicien
        tarif = (technicien.tarif_horaire
                 if technicien else 150)
        montant_main_oeuvre = (float(duree) *
                               float(tarif))

        facture, created = \
            Facture.objects.get_or_create(
                intervention=intervention,
                defaults={
                    'montant_main_oeuvre':
                        montant_main_oeuvre,
                    'montant_pieces': montant_pieces,
                    'montant_deplacement': 0,
                    'tva': 20,
                    'statut': 'brouillon'
                }
            )

        intervention.statut = 'valide'
        intervention.save()

        return Response({
            'message':
                'Intervention validée et '
                'facture générée',
            'intervention_statut':
                intervention.statut,
            'facture': {
                'numero': facture.numero,
                'total_ht': facture.total_ht,
                'total_ttc': facture.total_ttc,
                'statut': facture.statut
            }
        }, status=status.HTTP_200_OK)

# ════════════════════════════════
# ─── RAPPORTS ───
# ════════════════════════════════

class RapportListCreateView(
        generics.ListCreateAPIView):
    serializer_class = RapportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Rapport.objects.all()

        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                queryset = queryset.filter(
                    intervention__technicien=tech)
            except Technicien.DoesNotExist:
                queryset = queryset.none()

        return queryset

class RapportDetailView(
        generics.RetrieveUpdateAPIView):
    queryset = Rapport.objects.all()
    serializer_class = RapportSerializer
    permission_classes = [IsAuthenticated]

# ════════════════════════════════
# ─── PLANNING TECHNICIEN ───
# ════════════════════════════════

class MonPlanningView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        try:
            tech = Technicien.objects.get(user=user)
        except Technicien.DoesNotExist:
            return Response(
                {'erreur': 'Technicien non trouvé'},
                status=status.HTTP_404_NOT_FOUND)

        interventions = Intervention.objects.filter(
            technicien=tech,
            date_planifiee__isnull=False
        ).order_by('date_planifiee')

        serializer = InterventionListSerializer(
            interventions, many=True)

        return Response({
            'technicien': tech.nom,
            'interventions': serializer.data
        })

# ════════════════════════════════
# ─── FACTURES ───
# ════════════════════════════════

class FactureListView(generics.ListAPIView):
    queryset = Facture.objects.all()
    serializer_class = FactureSerializer
    permission_classes = [EstResponsable]

class FactureDetailView(
        generics.RetrieveUpdateAPIView):
    queryset = Facture.objects.all()
    serializer_class = FactureSerializer
    permission_classes = [EstResponsable]

class FacturePDFView(APIView):
    permission_classes = [EstResponsable]

    def get(self, request, pk):
        try:
            facture = Facture.objects.get(pk=pk)
        except Facture.DoesNotExist:
            return Response(
                {'erreur': 'Facture non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        buffer = generer_facture_pdf(facture)
        response = HttpResponse(
            buffer,
            content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename='
            f'"facture_{facture.numero}.pdf"')
        return response

# ════════════════════════════════
# ─── EMAILS ───
# ════════════════════════════════

class EnvoyerEmailTechnicienView(APIView):
    permission_classes = [EstAgentOuResponsable]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(
                pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        if not intervention.technicien:
            return Response(
                {'erreur': 'Aucun technicien assigné'},
                status=status.HTTP_400_BAD_REQUEST)

        resultat = envoyer_notification_technicien(
            intervention)

        if resultat:
            return Response({
                'message': 'Email envoyé au technicien',
                'technicien':
                    intervention.technicien.nom
            })
        return Response(
            {'erreur': 'Échec envoi email'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EnvoyerFactureEmailView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, pk):
        try:
            facture = Facture.objects.get(pk=pk)
        except Facture.DoesNotExist:
            return Response(
                {'erreur': 'Facture non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        if not facture.intervention.client.email:
            return Response(
                {'erreur': 'Client sans email'},
                status=status.HTTP_400_BAD_REQUEST)

        resultat = envoyer_facture_client(facture)

        if resultat:
            return Response({
                'message': 'Facture envoyée par email',
                'client':
                    facture.intervention.client.nom,
                'email':
                    facture.intervention.client.email
            })
        return Response(
            {'erreur': 'Échec envoi email'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ════════════════════════════════
# ─── MON PROFIL ───
# ════════════════════════════════

class MonProfilView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = 'responsable'
        nom = (user.get_full_name() or
               user.username)
        telephone = ''
        technicien_id = None
        agent_id = None

        if hasattr(user, 'profil'):
            role = user.profil.role

        if role == 'technicien':
            try:
                tech = Technicien.objects.get(
                    user=user)
                nom = tech.nom
                telephone = tech.telephone
                technicien_id = tech.id
            except Technicien.DoesNotExist:
                pass

        elif role == 'agent':
            try:
                agent = Agent.objects.get(user=user)
                nom = agent.nom
                telephone = agent.telephone
                agent_id = agent.id
            except Agent.DoesNotExist:
                pass

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'nom': nom,
            'role': role,
            'telephone': telephone,
            'technicien_id': technicien_id,
            'agent_id': agent_id
        })

# ════════════════════════════════
# ─── DASHBOARD ───
# ════════════════════════════════

class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        aujourd_hui = timezone.now().date()

        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                interventions_qs = (
                    Intervention.objects.filter(
                        technicien=tech))
            except Technicien.DoesNotExist:
                interventions_qs = (
                    Intervention.objects.none())
        else:
            interventions_qs = (
                Intervention.objects.all())

        stats = {
            'interventions_aujourd_hui':
                interventions_qs.filter(
                    date_creation__date=
                    aujourd_hui).count(),
            'interventions_en_cours':
                interventions_qs.filter(
                    statut='en_cours').count(),
            'interventions_en_retard':
                interventions_qs.filter(
                    date_planifiee__lt=timezone.now(),
                    statut__in=[
                        'nouveau', 'diagnostique',
                        'assigne', 'en_cours']
                ).count(),
            'interventions_terminees':
                interventions_qs.filter(
                    statut='termine').count(),
            'total_interventions':
                interventions_qs.count(),
            'techniciens_disponibles':
                Technicien.objects.filter(
                    disponible=True).count(),
            'pieces_en_rupture':
                Piece.objects.filter(
                    quantite_stock__lte=F(
                        'seuil_minimum')).count(),
        }

        par_statut = interventions_qs.values(
            'statut').annotate(count=Count('id'))

        par_type = interventions_qs.values(
            'type_service').annotate(
            count=Count('id'))

        return Response({
            'stats': stats,
            'par_statut': list(par_statut),
            'par_type': list(par_type),
        })
# ─── GÉNÉRER RAPPORT IA ───
class GenererRapportIAView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(
                pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        # Vérifier que c'est le bon technicien
        user = request.user
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                if intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN)
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN)

        # Vérifier que des notes existent
        if not intervention.notes_technicien:
            return Response({
                'erreur':
                    'Saisissez d\'abord vos notes'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            import google.generativeai as genai
            import os

            genai.configure(
                api_key=os.getenv('GEMINI_API_KEY'))
            model = genai.GenerativeModel(
                'gemini-pro')

            prompt = f"""
Tu es un expert en maintenance informatique.
Génère un rapport professionnel structuré
basé sur ces informations :

INTERVENTION : {intervention.numero}
CLIENT : {intervention.client.nom}
TYPE : {intervention.type_service}
APPAREIL : {
    f"{intervention.appareil.marque} "
    f"{intervention.appareil.modele}"
    if intervention.appareil else "Non spécifié"
}
DESCRIPTION DU PROBLÈME :
{intervention.description}

NOTES DU TECHNICIEN :
{intervention.notes_technicien}

Le rapport doit contenir :
1. Résumé de l'intervention
2. Diagnostic établi
3. Actions réalisées
4. Résultat obtenu
5. Recommandations

Rédige en français de manière professionnelle.
            """

            response = model.generate_content(prompt)
            contenu_rapport = response.text

        except Exception as e:
            # Si Gemini non configuré — rapport basique
            contenu_rapport = f"""
RAPPORT D'INTERVENTION — {intervention.numero}

CLIENT : {intervention.client.nom}
DATE : {intervention.date_creation.strftime('%d/%m/%Y')}
TYPE : {intervention.type_service}

DESCRIPTION DU PROBLÈME :
{intervention.description}

DIAGNOSTIC ET ACTIONS RÉALISÉES :
{intervention.notes_technicien}

TECHNICIEN : {
    intervention.technicien.nom
    if intervention.technicien else 'Non assigné'
}
            """

        # Créer ou mettre à jour le rapport
        rapport, created = Rapport.objects.get_or_create(
            intervention=intervention,
            defaults={
                'contenu': contenu_rapport,
                'genere_par_ia': True,
                'valide': False
            }
        )

        if not created:
            rapport.contenu = contenu_rapport
            rapport.genere_par_ia = True
            rapport.valide = False
            rapport.save()

        return Response({
            'message': 'Rapport généré avec succès',
            'rapport_id': rapport.id,
            'contenu': rapport.contenu,
            'genere_par_ia': rapport.genere_par_ia
        }, status=status.HTTP_200_OK)

# ─── VALIDER RAPPORT ───
class ValiderRapportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            rapport = Rapport.objects.get(pk=pk)
        except Rapport.DoesNotExist:
            return Response(
                {'erreur': 'Rapport non trouvé'},
                status=status.HTTP_404_NOT_FOUND)

        # Vérifier que c'est le bon technicien
        user = request.user
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                if (rapport.intervention.technicien
                        != tech):
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN)
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN)

        rapport.valide = True
        rapport.date_validation = timezone.now()
        rapport.save()

        return Response({
            'message': 'Rapport validé avec succès',
            'rapport_id': rapport.id,
            'valide': rapport.valide,
            'date_validation': rapport.date_validation
        }, status=status.HTTP_200_OK)