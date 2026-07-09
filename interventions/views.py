from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated, BasePermission)
from django.db.models import Count, F, Sum
from django.contrib.auth.models import User
from django.utils import timezone
from django.http import HttpResponse
from django.db import transaction, IntegrityError
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

from .models import ImageIntervention
from .serializers import ImageInterventionSerializer
from rest_framework.parsers import (
    MultiPartParser, FormParser)

from rest_framework.parsers import (
    MultiPartParser, FormParser)

import traceback
import cloudinary.uploader
 

# ════════════════════════════════
# ─── PERMISSIONS ───
# ════════════════════════════════

class EstAdmin(BasePermission):
    """Administrateur : gestion des utilisateurs + statistiques système."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role == 'admin'

class EstResponsable(BasePermission):
    """Responsable et Admin = accès opérationnel complet."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role in ['responsable', 'admin']

class EstAgent(BasePermission):
    """Agent + Responsable + Admin."""
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role in ['agent', 'responsable', 'admin']

class EstAgentOuResponsable(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role in ['agent', 'responsable', 'admin']

class EstTechnicien(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role == 'technicien'

# ════════════════════════════════
# ─── CLIENTS ───
# Agent seulement
# ════════════════════════════════

class ClientListCreateView(generics.ListCreateAPIView):
    serializer_class = ClientSerializer
    permission_classes = [EstAgent]

    def get_queryset(self):
        queryset = Client.objects.all()
        search = self.request.query_params.get('search')
        telephone = self.request.query_params.get('telephone')
        if search:
            queryset = queryset.filter(nom__icontains=search)
        if telephone:
            queryset = queryset.filter(telephone__icontains=telephone)
        return queryset

class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [EstAgent]

# ════════════════════════════════
# ─── TECHNICIENS ───
# Responsable gère les techniciens
# ════════════════════════════════

class TechnicienListView(generics.ListCreateAPIView):
    serializer_class = TechnicienSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [EstResponsable()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Technicien.objects.all()
        disponible = self.request.query_params.get('disponible')
        if disponible:
            queryset = queryset.filter(disponible=True)
        return queryset

    def create(self, request, *args, **kwargs):
        # Un technicien doit avoir un compte User pour pouvoir se connecter.
        # On crée donc User + ProfilUtilisateur(role='technicien') + Technicien
        # dans une seule transaction (même logique que la création par l'admin).
        d = request.data
        username = (d.get('username') or '').strip()
        password = d.get('password') or ''
        nom = (d.get('nom') or '').strip()

        if not username or not password:
            return Response(
                {'erreur': "Identifiant et mot de passe obligatoires "
                           "pour que le technicien puisse se connecter"},
                status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response(
                {'erreur': "Ce nom d'utilisateur existe déjà"},
                status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                parts = nom.split(' ', 1) if nom else ['', '']
                user = User.objects.create_user(
                    username=username, password=password,
                    email=d.get('email', ''),
                    first_name=parts[0],
                    last_name=parts[1] if len(parts) > 1 else '')
                ProfilUtilisateur.objects.create(
                    user=user, role='technicien')
                tech = Technicien.objects.create(
                    user=user, nom=nom or username,
                    specialite=d.get('specialite', 'hardware'),
                    telephone=d.get('telephone', ''),
                    competences=d.get('competences', ''),
                    tarif_horaire=d.get('tarif_horaire') or 0,
                    disponible=d.get('disponible', True))
        except IntegrityError as e:
            return Response({'erreur': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(tech)
        return Response(serializer.data,
                        status=status.HTTP_201_CREATED)

class TechnicienDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Technicien.objects.all()
    serializer_class = TechnicienSerializer
    permission_classes = [EstResponsable]

# ════════════════════════════════
# ─── AGENTS ───
# Géré par le responsable
# ════════════════════════════════

class AgentListCreateView(generics.ListCreateAPIView):
    serializer_class = AgentSerializer
    permission_classes = [EstResponsable]

    def get_queryset(self):
        return Agent.objects.all()

class AgentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Agent.objects.all()
    serializer_class = AgentSerializer
    permission_classes = [EstResponsable]

# ════════════════════════════════
# ─── APPAREILS ───
# Agent seulement
# ════════════════════════════════

class AppareilListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/appareils/            → liste tous les appareils
    GET  /api/appareils/?client=1   → filtre par client
    GET  /api/appareils/?search=HP  → recherche par marque/modèle/série
    POST /api/appareils/            → créer un nouvel appareil
    """
    serializer_class   = AppareilSerializer
    permission_classes = [IsAuthenticated]
 
    def get_queryset(self):
        qs = Appareil.objects.select_related("client").all()
 
        # Filtre par client
        client_id = self.request.query_params.get("client")
        if client_id:
            qs = qs.filter(client__id=client_id)
 
        # Filtre par type
        type_appareil = self.request.query_params.get("type")
        if type_appareil:
            qs = qs.filter(type_appareil=type_appareil)
 
        # Filtre garantie
        garantie = self.request.query_params.get("garantie")
        if garantie == "true":
            qs = qs.filter(sous_garantie=True)
        elif garantie == "false":
            qs = qs.filter(sous_garantie=False)
 
        # Recherche texte
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                models.Q(marque__icontains=search)     |
                models.Q(modele__icontains=search)     |
                models.Q(numero_serie__icontains=search) |
                models.Q(client__nom__icontains=search)
            )
 
        return qs
 
 
class AppareilDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/appareils/<pk>/  → détail
    PUT    /api/appareils/<pk>/  → mettre à jour
    PATCH  /api/appareils/<pk>/  → mise à jour partielle
    DELETE /api/appareils/<pk>/  → supprimer
    """
    queryset           = Appareil.objects.select_related("client").all()
    serializer_class   = AppareilSerializer
    permission_classes = [IsAuthenticated]
 

# ════════════════════════════════
# ─── PIECES ───
# Agent gère le stock
# Responsable et Technicien : lecture seulement
# ════════════════════════════════

class PieceListCreateView(generics.ListCreateAPIView):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [EstAgent()]

class PieceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [EstAgent()]

# ════════════════════════════════
# ─── INTERVENTIONS ───
# ════════════════════════════════

def enregistrer_diagnostic_ia(intervention, diag):
    """Enregistre (ou met à jour) le diagnostic IA d'une intervention
    dans la table interventions_diagnosticia.

    `diag` est le dictionnaire produit par le predictor / renvoyé au
    frontend. On extrait les champs de façon défensive car la forme
    exacte peut varier (confiance = dict ou nombre, pièces = liste
    d'objets ou de chaînes, etc.)."""
    if not isinstance(diag, dict):
        return None

    # ── pièces suggérées → texte ──
    pieces = diag.get('pieces_suggerees') or []
    if isinstance(pieces, list):
        noms = []
        for p in pieces:
            if isinstance(p, dict):
                noms.append(str(p.get('nom') or p.get('piece') or p))
            else:
                noms.append(str(p))
        pieces_txt = ', '.join(n for n in noms if n)
    else:
        pieces_txt = str(pieces)

    # ── confiance → score global ──
    conf = diag.get('confiance')
    score = conf.get('globale') if isinstance(conf, dict) else conf
    try:
        score = round(float(score), 2) if score is not None else None
    except (TypeError, ValueError):
        score = None

    # ── durée estimée ──
    try:
        duree = diag.get('duree')
        duree = round(float(duree), 2) if duree is not None else None
    except (TypeError, ValueError):
        duree = None

    diagnostic, _ = DiagnosticIA.objects.update_or_create(
        intervention=intervention,
        defaults={
            'description_entree': intervention.description or '',
            'categorie_panne': (diag.get('categorie') or '')[:100],
            'causes_probables': diag.get('origine_probleme') or '',
            'pieces_suggerees': pieces_txt,
            'duree_estimee': duree,
            'score_confiance': score,
        })
    return diagnostic


class InterventionListCreateView(generics.ListCreateAPIView):

    def get_permissions(self):
        # L'agent est en LECTURE SEULE sur les interventions :
        # il peut les consulter (GET) mais pas en créer (POST réservé
        # au responsable / admin).
        if self.request.method == 'POST':
            return [EstResponsable()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return InterventionDetailSerializer
        return InterventionListSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Intervention.objects.all()

        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            try:
                technicien = Technicien.objects.get(user=user)
                queryset = queryset.filter(technicien=technicien)
            except Technicien.DoesNotExist:
                queryset = queryset.none()

        statut = self.request.query_params.get('statut')
        urgence = self.request.query_params.get('urgence')
        technicien_id = self.request.query_params.get('technicien_id')
        client_id = self.request.query_params.get('client_id')

        if statut:
            queryset = queryset.filter(statut=statut)
        if urgence:
            queryset = queryset.filter(urgence=urgence)
        if technicien_id:
            queryset = queryset.filter(technicien_id=technicien_id)
        if client_id:
            queryset = queryset.filter(client_id=client_id)

        return queryset

    def perform_create(self, serializer):
        intervention = serializer.save(created_by=self.request.user)
        # Si le frontend a joint le diagnostic IA (généré avant la création),
        # on le persiste dans interventions_diagnosticia, lié à l'intervention.
        diag = self.request.data.get('diagnostic')
        if diag:
            try:
                enregistrer_diagnostic_ia(intervention, diag)
            except Exception:
                # La création d'intervention ne doit jamais échouer à cause
                # d'un problème d'enregistrement du diagnostic.
                pass

class InterventionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Intervention.objects.all()
    serializer_class = InterventionDetailSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [EstResponsable()]
        return [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        user = request.user
        intervention = self.get_object()

        technicien_id = request.data.get('technicien_id')
        date_planifiee = request.data.get('date_planifiee')
        duree_estimee = request.data.get('duree_estimee')

        if technicien_id or date_planifiee or duree_estimee:
            from datetime import datetime, timedelta
            import pytz

            tech_id = technicien_id or (intervention.technicien_id if intervention.technicien else None)
            date_plan = date_planifiee or intervention.date_planifiee
            duree = float(duree_estimee or intervention.duree_estimee or 1)

            if tech_id and date_plan:
                try:
                    technicien = Technicien.objects.get(pk=tech_id)

                    if isinstance(date_plan, str):
                        date_debut = datetime.fromisoformat(date_plan.replace('Z', '+00:00'))
                    else:
                        date_debut = date_plan

                    date_fin = date_debut + timedelta(hours=duree)

                    conflits = Intervention.objects.filter(
                        technicien=technicien,
                        date_planifiee__isnull=False,
                        statut__in=['assigne', 'en_cours', 'attente_pieces']
                    ).exclude(pk=intervention.pk)

                    for autre in conflits:
                        duree_autre = float(autre.duree_estimee or 1)
                        fin_autre = autre.date_planifiee + timedelta(hours=duree_autre)

                        if date_debut < fin_autre and date_fin > autre.date_planifiee:
                            return Response({
                                'erreur': 'Conflit de planning',
                                'message': f'Le technicien est déjà occupé du {autre.date_planifiee.strftime("%d/%m/%Y %H:%M")} au {fin_autre.strftime("%H:%M")} pour l\'intervention {autre.numero}'
                            }, status=status.HTTP_400_BAD_REQUEST)
                except Technicien.DoesNotExist:
                    pass

        # Technicien : seulement notes + durée réelle
        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            champs_autorises = {'notes_technicien', 'duree_reelle'}
            champs_envoyes = set(request.data.keys())
            champs_interdits = champs_envoyes - champs_autorises

            if champs_interdits:
                return Response({
                    'erreur': 'Accès refusé',
                    'champs_interdits': list(champs_interdits),
                    'champs_autorises': list(champs_autorises)
                }, status=status.HTTP_403_FORBIDDEN)

        # Agent : ne peut pas modifier les interventions
        if (hasattr(user, 'profil') and user.profil.role == 'agent'):
            return Response({
                'erreur': 'L\'agent ne peut pas modifier une intervention'
            }, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

# ─── CHANGER STATUT ───
STATUTS_AUTORISES_TECHNICIEN = {'en_cours', 'attente_pieces', 'termine'}

class InterventionChangerStatutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        user = request.user
        role = user.profil.role if hasattr(user, 'profil') else 'responsable'

        if role == 'agent':
            return Response({
                'erreur': 'L\'agent ne peut pas changer le statut d\'une intervention'
            }, status=status.HTTP_403_FORBIDDEN)

        if role == 'technicien':
            try:
                tech = Technicien.objects.get(user=user)
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

        statuts_responsable = ['diagnostique', 'assigne', 'valide', 'facture', 'cloture']
        statuts_technicien = ['en_cours', 'attente_pieces', 'termine']

        if role == 'technicien' and nouveau_statut in statuts_responsable:
            return Response({
                'erreur': 'Réservé au responsable',
                'statut_refuse': nouveau_statut
            }, status=status.HTTP_403_FORBIDDEN)

        if role == 'responsable' and nouveau_statut in statuts_technicien:
            return Response({
                'erreur': 'Réservé au technicien',
                'statut_refuse': nouveau_statut
            }, status=status.HTTP_403_FORBIDDEN)

        if not transition_autorisee(intervention.statut, nouveau_statut):
            transitions = get_transitions_possibles(intervention.statut)
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
        }, status=status.HTTP_200_OK)

# ─── TRANSITIONS POSSIBLES ───
class InterventionTransitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        transitions = get_transitions_possibles(intervention.statut)

        user = request.user
        est_technicien = (
            hasattr(user, 'profil') and
            user.profil.role == 'technicien'
        )
        if est_technicien:
            transitions = [t for t in transitions if t in STATUTS_AUTORISES_TECHNICIEN]

        return Response({
            'statut_actuel': intervention.statut,
            'transitions_possibles': transitions,
            'role': user.profil.role if hasattr(user, 'profil') else 'responsable'
        })

# ─── VALIDER INTERVENTION ───
# Responsable seulement — après validation du rapport
class InterventionValiderView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        if intervention.statut != 'termine':
            return Response({
                'erreur': 'L\'intervention doit être terminée avant validation',
                'statut_actuel': intervention.statut
            }, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier que le rapport existe et est validé
        try:
            rapport = intervention.rapport
            if not rapport.valide:
                return Response({
                    'erreur': 'Le rapport du technicien doit être validé avant de valider l\'intervention',
                    'conseil': 'Validez d\'abord le rapport depuis la liste des rapports'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({
                'erreur': 'Aucun rapport trouvé pour cette intervention',
                'conseil': 'Le technicien doit d\'abord générer et enregistrer son rapport'
            }, status=status.HTTP_400_BAD_REQUEST)

        intervention.statut = 'valide'
        intervention.save()

        return Response({
            'message': 'Intervention validée avec succès !',
            'nouveau_statut': intervention.statut
        }, status=status.HTTP_200_OK)

# ════════════════════════════════════════════════════════════
# ─── VALIDER INTERVENTION ET GÉNÉRER FACTURE ───
# ════════════════════════════════════════════════════════════
def _generer_numero_facture_unique():
    from datetime import datetime
    annee = datetime.now().year
    prefix = f"FAC/{annee}/"

    with transaction.atomic():
        derniere = (
            Facture.objects
            .filter(numero__startswith=prefix)
            .order_by('-numero')
            .select_for_update()
            .first()
        )
        if derniere:
            try:
                dernier_num = int(derniere.numero.split('/')[-1])
            except (ValueError, IndexError):
                dernier_num = 0
            nouveau_num = dernier_num + 1
        else:
            nouveau_num = 1

        return f"{prefix}{nouveau_num:04d}"


class InterventionValiderGenererFactureView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        if intervention.statut != 'termine':
            return Response({
                'erreur': 'Intervention doit être terminée',
                'statut_actuel': intervention.statut
            }, status=status.HTTP_400_BAD_REQUEST)

        # Vérifier rapport validé
        try:
            rapport = intervention.rapport
            if not rapport.valide:
                return Response({
                    'erreur': 'Le rapport du technicien doit être validé avant de valider l\'intervention',
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({
                'erreur': 'Aucun rapport trouvé. Le technicien doit générer et enregistrer son rapport.',
            }, status=status.HTTP_400_BAD_REQUEST)

        from decimal import Decimal
        montant_pieces = sum(
            Decimal(str(p.quantite)) * p.prix_unitaire
            for p in intervention.pieces_utilisees.all()
        )

        duree = Decimal(str(intervention.duree_reelle or intervention.duree_estimee or 1))
        technicien = intervention.technicien
        tarif = Decimal(str(technicien.tarif_horaire if technicien else 150))
        montant_main_oeuvre = duree * tarif

        try:
            with transaction.atomic():
                facture_existante = (
                    Facture.objects
                    .select_for_update()
                    .filter(intervention=intervention)
                    .first()
                )

                if facture_existante:
                    facture_existante.montant_main_oeuvre = montant_main_oeuvre
                    facture_existante.montant_pieces = montant_pieces
                    facture_existante.save()
                    facture = facture_existante
                else:
                    numero = _generer_numero_facture_unique()
                    facture = Facture.objects.create(
                        intervention=intervention,
                        numero=numero,
                        montant_main_oeuvre=montant_main_oeuvre,
                        montant_pieces=montant_pieces,
                        montant_deplacement=0,
                        tva=20,
                        statut='brouillon'
                    )

                intervention.statut = 'valide'
                intervention.save()

        except IntegrityError:
            try:
                with transaction.atomic():
                    numero = _generer_numero_facture_unique()
                    facture = Facture.objects.create(
                        intervention=intervention,
                        numero=numero,
                        montant_main_oeuvre=montant_main_oeuvre,
                        montant_pieces=montant_pieces,
                        montant_deplacement=0,
                        tva=20,
                        statut='brouillon'
                    )
                    intervention.statut = 'valide'
                    intervention.save()
            except IntegrityError as e:
                return Response(
                    {'erreur': f'Impossible de générer un numéro de facture unique : {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        return Response({
            'message': 'Intervention validée et facture générée',
            'intervention_statut': intervention.statut,
            'facture': {
                'id': facture.id,
                'numero': facture.numero,
                'total_ht': float(facture.total_ht),
                'total_ttc': float(facture.total_ttc),
                'statut': facture.statut
            }
        }, status=status.HTTP_200_OK)

# ════════════════════════════════
# ─── RAPPORTS ───
# ════════════════════════════════

class RapportListCreateView(generics.ListCreateAPIView):
    serializer_class = RapportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Rapport.objects.all()

        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(user=user)
                queryset = queryset.filter(intervention__technicien=tech)
            except Technicien.DoesNotExist:
                queryset = queryset.none()

        return queryset

class RapportDetailView(generics.RetrieveUpdateAPIView):
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

        serializer = InterventionListSerializer(interventions, many=True)

        return Response({
            'technicien': tech.nom,
            'interventions': serializer.data
        })

# ─── PLANNING D'UN TECHNICIEN SPÉCIFIQUE ───
# Responsable peut voir le planning de n'importe quel technicien
class PlanningTechnicienView(APIView):
    permission_classes = [EstResponsable]

    def get(self, request, pk):
        try:
            tech = Technicien.objects.get(pk=pk)
        except Technicien.DoesNotExist:
            return Response(
                {'erreur': 'Technicien non trouvé'},
                status=status.HTTP_404_NOT_FOUND)

        interventions = Intervention.objects.filter(
            technicien=tech,
            date_planifiee__isnull=False
        ).order_by('date_planifiee')

        serializer = InterventionListSerializer(interventions, many=True)

        return Response({
            'technicien': tech.nom,
            'technicien_id': tech.id,
            'specialite': tech.specialite,
            'disponible': tech.disponible,
            'interventions': serializer.data
        })

# ─── VÉRIFIER DISPONIBILITÉ TECHNICIEN ───
class VerifierDisponibiliteView(APIView):
    permission_classes = [EstAgentOuResponsable]

    def post(self, request):
        technicien_id = request.data.get('technicien_id')
        date_planifiee = request.data.get('date_planifiee')
        duree_estimee = request.data.get('duree_estimee', 1)
        intervention_id = request.data.get('intervention_id')

        if not technicien_id or not date_planifiee:
            return Response({
                'erreur': 'technicien_id et date_planifiee obligatoires'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            technicien = Technicien.objects.get(pk=technicien_id)
        except Technicien.DoesNotExist:
            return Response(
                {'erreur': 'Technicien non trouvé'},
                status=status.HTTP_404_NOT_FOUND)

        from datetime import datetime, timedelta
        import pytz

        try:
            if isinstance(date_planifiee, str):
                date_debut = datetime.fromisoformat(date_planifiee.replace('Z', '+00:00'))
            else:
                date_debut = date_planifiee
        except Exception:
            return Response({
                'erreur': 'Format date invalide'
            }, status=status.HTTP_400_BAD_REQUEST)

        tz_maroc = pytz.timezone('Africa/Casablanca')
        date_locale = date_debut.astimezone(tz_maroc)
        jour_semaine = date_locale.weekday()
        heure = date_locale.hour
        minute = date_locale.minute
        heure_decimal = heure + minute / 60

        try:
            duree = float(duree_estimee)
            if duree <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            return Response({
                'disponible': False,
                'raison': 'duree_invalide',
                'message': 'La durée estimée doit être un nombre positif'
            }, status=status.HTTP_200_OK)

        date_fin = date_debut + timedelta(hours=duree)
        date_fin_locale = date_fin.astimezone(tz_maroc)
        heure_fin = date_fin_locale.hour + date_fin_locale.minute / 60

        if jour_semaine == 6:
            return Response({
                'disponible': False,
                'raison': 'dimanche',
                'message': 'Aucune intervention le dimanche.',
            }, status=status.HTTP_200_OK)

        matin_debut, matin_fin = 8.5, 13.0
        aprem_debut, aprem_fin = 15.0, 19.0

        dans_matin = matin_debut <= heure_decimal < matin_fin
        dans_aprem = (aprem_debut <= heure_decimal < aprem_fin and jour_semaine < 5)

        if not dans_matin and not dans_aprem:
            if jour_semaine == 5:
                msg = f'Le samedi, les interventions sont uniquement de 08h30 à 13h00. Heure demandée : {date_locale.strftime("%H:%M")}'
            else:
                msg = f'Heure {date_locale.strftime("%H:%M")} en dehors des horaires. Horaires : 8h30-13h00 et 15h00-19h00'
            return Response({
                'disponible': False,
                'raison': 'hors_horaires',
                'message': msg,
            }, status=status.HTTP_200_OK)

        if dans_matin and heure_fin > matin_fin:
            return Response({
                'disponible': False,
                'raison': 'depasse_horaires',
                'message': f'L\'intervention se termine à {date_fin_locale.strftime("%H:%M")} et dépasse 13h00.',
                'suggestion': 'Réduisez la durée ou planifiez après 15h00' if jour_semaine < 5 else 'Réduisez la durée estimée'
            }, status=status.HTTP_200_OK)

        if dans_aprem and heure_fin > aprem_fin:
            return Response({
                'disponible': False,
                'raison': 'depasse_horaires',
                'message': f'L\'intervention se termine à {date_fin_locale.strftime("%H:%M")} et dépasse 19h00.',
                'suggestion': 'Réduisez la durée ou planifiez le lendemain matin'
            }, status=status.HTTP_200_OK)

        qs = Intervention.objects.filter(
            technicien=technicien,
            date_planifiee__isnull=False,
            statut__in=['assigne', 'en_cours', 'attente_pieces']
        )
        if intervention_id:
            qs = qs.exclude(pk=intervention_id)

        conflits = []
        temps_total_chevauchant = 0

        for i in qs:
            duree_i = float(i.duree_estimee or 1)
            debut_i = i.date_planifiee
            fin_i = debut_i + timedelta(hours=duree_i)

            if date_debut < fin_i and date_fin > debut_i:
                debut_chevauch = max(date_debut, debut_i)
                fin_chevauch = min(date_fin, fin_i)
                duree_chevauch = (fin_chevauch - debut_chevauch).total_seconds() / 3600
                temps_total_chevauchant += duree_chevauch

                conflits.append({
                    'numero': i.numero,
                    'client': i.client.nom,
                    'debut': debut_i.strftime('%d/%m/%Y %H:%M'),
                    'fin': fin_i.strftime('%d/%m/%Y %H:%M'),
                    'duree': f'{duree_i}h',
                    'chevauchement': f'{duree_chevauch:.1f}h'
                })

        if conflits:
            return Response({
                'disponible': False,
                'raison': 'conflit',
                'message': f'Le technicien {technicien.nom} a {len(conflits)} intervention(s) en conflit.',
                'conflits': conflits,
                'suggestion': 'Choisissez une autre date ou horaire'
            }, status=status.HTTP_200_OK)

        return Response({
            'disponible': True,
            'message': f'{technicien.nom} est disponible du {date_locale.strftime("%d/%m/%Y à %H:%M")} au {date_fin_locale.strftime("%H:%M")}.',
            'technicien': technicien.nom,
            'date_debut': date_locale.strftime('%d/%m/%Y %H:%M'),
            'date_fin': date_fin_locale.strftime('%d/%m/%Y %H:%M'),
            'duree_estimee': f'{duree}h'
        }, status=status.HTTP_200_OK)

# ─── ASSIGNER TECHNICIEN AVEC VÉRIFICATION ───
class AssignerTechnicienView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )

        technicien_id = request.data.get('technicien_id')
        date_planifiee = request.data.get('date_planifiee')
        duree_estimee = request.data.get('duree_estimee', 1)

        if not technicien_id or not date_planifiee:
            return Response(
                {'erreur': 'technicien_id et date_planifiee obligatoires'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            technicien = Technicien.objects.get(pk=technicien_id)
        except Technicien.DoesNotExist:
            return Response(
                {'erreur': 'Technicien non trouvé'},
                status=status.HTTP_404_NOT_FOUND
            )

        from datetime import datetime, timedelta

        if isinstance(date_planifiee, str):
            date_debut = datetime.fromisoformat(date_planifiee.replace('Z', '+00:00'))
        else:
            date_debut = date_planifiee

        duree = float(duree_estimee)
        date_fin = date_debut + timedelta(hours=duree)

        conflits = Intervention.objects.filter(
            technicien=technicien,
            date_planifiee__isnull=False,
            statut__in=['assigne', 'en_cours', 'attente_pieces']
        ).exclude(pk=intervention.pk)

        for autre in conflits:
            duree_autre = float(autre.duree_estimee or 1)
            fin_autre = autre.date_planifiee + timedelta(hours=duree_autre)

            if date_debut < fin_autre and date_fin > autre.date_planifiee:
                return Response({
                    'erreur': 'Conflit de planning',
                    'message': f'Le technicien est déjà occupé du {autre.date_planifiee.strftime("%d/%m/%Y %H:%M")} au {fin_autre.strftime("%H:%M")} pour l\'intervention {autre.numero}',
                }, status=status.HTTP_400_BAD_REQUEST)

        intervention.technicien = technicien
        intervention.date_planifiee = date_debut
        intervention.duree_estimee = duree

        if intervention.statut == 'nouveau':
            intervention.statut = 'assigne'

        intervention.save()

        return Response({
            'message': 'Technicien assigné avec succès',
            'intervention': {
                'id': intervention.id,
                'numero': intervention.numero,
                'technicien': technicien.nom,
                'date_planifiee': intervention.date_planifiee,
                'duree_estimee': intervention.duree_estimee,
                'statut': intervention.statut
            }
        }, status=status.HTTP_200_OK)

# ════════════════════════════════
# ─── FACTURES ───
# Agent gère les factures
# ════════════════════════════════

class FactureListView(generics.ListAPIView):
    queryset = Facture.objects.all()
    serializer_class = FactureSerializer
    permission_classes = [EstAgent]

class FactureDetailView(generics.RetrieveUpdateAPIView):
    queryset = Facture.objects.all()
    serializer_class = FactureSerializer
    permission_classes = [EstAgent]

class FacturePDFView(APIView):
    permission_classes = [EstAgent]

    def get(self, request, pk):
        try:
            facture = Facture.objects.get(pk=pk)
        except Facture.DoesNotExist:
            return Response(
                {'erreur': 'Facture non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        buffer = generer_facture_pdf(facture)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="facture_{facture.numero}.pdf"'
        return response

# ════════════════════════════════
# ─── EMAILS ───
# ════════════════════════════════

class EnvoyerEmailTechnicienView(APIView):
    permission_classes = [EstAgentOuResponsable]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        if not intervention.technicien:
            return Response(
                {'erreur': 'Aucun technicien assigné'},
                status=status.HTTP_400_BAD_REQUEST)

        resultat = envoyer_notification_technicien(intervention)

        if resultat:
            return Response({
                'message': 'Email envoyé au technicien',
                'technicien': intervention.technicien.nom
            })
        return Response(
            {'erreur': 'Échec envoi email'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EnvoyerFactureEmailView(APIView):
    permission_classes = [EstAgent]

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
                'client': facture.intervention.client.nom,
                'email': facture.intervention.client.email
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
        nom = user.get_full_name() or user.username
        telephone = ''
        technicien_id = None
        agent_id = None

        if hasattr(user, 'profil'):
            role = user.profil.role

        if role == 'technicien':
            try:
                tech = Technicien.objects.get(user=user)
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

        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(user=user)
                interventions_qs = Intervention.objects.filter(technicien=tech)
            except Technicien.DoesNotExist:
                interventions_qs = Intervention.objects.none()
        else:
            interventions_qs = Intervention.objects.all()

        stats = {
            'interventions_aujourd_hui': interventions_qs.filter(date_creation__date=aujourd_hui).count(),
            'interventions_en_cours': interventions_qs.filter(statut='en_cours').count(),
            'interventions_en_retard': interventions_qs.filter(
                date_planifiee__lt=timezone.now(),
                statut__in=['nouveau', 'diagnostique', 'assigne', 'en_cours']
            ).count(),
            'interventions_terminees': interventions_qs.filter(statut='termine').count(),
            'total_interventions': interventions_qs.count(),
            'techniciens_disponibles': Technicien.objects.filter(disponible=True).count(),
            'pieces_en_rupture': Piece.objects.filter(quantite_stock__lte=F('seuil_minimum')).count(),
        }

        par_statut = interventions_qs.values('statut').annotate(count=Count('id'))
        par_type = interventions_qs.values('type_service').annotate(count=Count('id'))

        return Response({
            'stats': stats,
            'par_statut': list(par_statut),
            'par_type': list(par_type),
        })

# ════════════════════════════════
# ─── RAPPORT IA AVEC GROQ ───
# ════════════════════════════════

class GenererRapportIAView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(user=user)
                if intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN)
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN)

        if not intervention.notes_technicien:
            return Response({
                'erreur': 'Saisissez d\'abord vos notes techniques'
            }, status=status.HTTP_400_BAD_REQUEST)

        appareil_info = (
            f"{intervention.appareil.marque} "
            f"{intervention.appareil.modele} "
            f"({intervention.appareil.type_appareil})"
            if intervention.appareil else "Non spécifié"
        )

        pieces_info = ""
        pieces = intervention.pieces_utilisees.all()
        if pieces:
            pieces_info = "\nPIÈCES UTILISÉES :\n"
            for p in pieces:
                pieces_info += f"- {p.piece.nom} x{p.quantite} ({p.prix_unitaire} MAD/u)\n"

        try:
            from groq import Groq
            import os

            client = Groq(api_key=os.getenv('GROQ_API_KEY'))

            prompt = f"""Tu es un expert en maintenance informatique et rédige des rapports professionnels.

Génère un rapport d'intervention technique complet et professionnel basé sur les informations suivantes :

INFORMATIONS DE L'INTERVENTION :
- Numéro : {intervention.numero}
- Date : {intervention.date_creation.strftime('%d/%m/%Y')}
- Type de service : {intervention.type_service}
- Niveau d'urgence : {intervention.urgence}

CLIENT :
- Nom : {intervention.client.nom}
- Téléphone : {intervention.client.telephone}

APPAREIL :
{appareil_info}

DESCRIPTION DU PROBLÈME SIGNALÉ :
{intervention.description}

NOTES DU TECHNICIEN :
{intervention.notes_technicien}

DURÉE D'INTERVENTION :
{f"{intervention.duree_reelle}h (réelle)" if intervention.duree_reelle else f"{intervention.duree_estimee}h (estimée)" if intervention.duree_estimee else "Non renseignée"}
{pieces_info}

TECHNICIEN : {intervention.technicien.nom if intervention.technicien else "Non assigné"}

Le rapport doit être structuré exactement ainsi :

1. RÉSUMÉ DE L'INTERVENTION
   (résumé concis en 2-3 phrases)

2. DIAGNOSTIC ÉTABLI
   (description technique du problème identifié)

3. ACTIONS RÉALISÉES
   (liste détaillée des actions effectuées)

4. PIÈCES REMPLACÉES
   (si applicable, sinon indiquer "Aucune pièce remplacée")

5. RÉSULTAT OBTENU
   (état de l'équipement après intervention)

6. RECOMMANDATIONS
   (conseils pour éviter la récurrence du problème)

Rédige en français, de manière professionnelle et technique. Sois précis et concis."""

            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Tu es un expert en maintenance informatique "
                            "qui rédige des rapports techniques professionnels "
                            "pour une société de services informatiques au Maroc."
                        )
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.3,
                max_tokens=2048,
            )

            contenu_rapport = chat_completion.choices[0].message.content
            genere_par_ia = True

        except Exception as e:
            print(f"Erreur Groq : {e}")
            contenu_rapport = f"""RAPPORT D'INTERVENTION — {intervention.numero}

DATE : {intervention.date_creation.strftime('%d/%m/%Y')}
CLIENT : {intervention.client.nom}
TYPE : {intervention.type_service}
APPAREIL : {appareil_info}

1. RÉSUMÉ DE L'INTERVENTION
{intervention.description}

2. DIAGNOSTIC ET ACTIONS RÉALISÉES
{intervention.notes_technicien}

3. TECHNICIEN
{intervention.technicien.nom if intervention.technicien else 'Non assigné'}

— Rapport généré sans IA (clé API non configurée) —"""
            genere_par_ia = False

        rapport, created = Rapport.objects.get_or_create(
            intervention=intervention,
            defaults={
                'contenu': contenu_rapport,
                'genere_par_ia': genere_par_ia,
                'valide': False
            }
        )

        if not created:
            rapport.contenu = contenu_rapport
            rapport.genere_par_ia = genere_par_ia
            rapport.valide = False
            rapport.save()

        return Response({
            'message': 'Rapport généré avec succès',
            'rapport_id': rapport.id,
            'contenu': rapport.contenu,
            'genere_par_ia': rapport.genere_par_ia,
            'modele': 'llama-3.3-70b-versatile' if genere_par_ia else 'basique'
        }, status=status.HTTP_200_OK)

# ════════════════════════════════
# ─── VALIDER RAPPORT ───
# Responsable seulement
# ════════════════════════════════

class ValiderRapportView(APIView):
    permission_classes = [EstResponsable]

    def post(self, request, pk):
        try:
            rapport = Rapport.objects.get(pk=pk)
        except Rapport.DoesNotExist:
            return Response(
                {'erreur': 'Rapport non trouvé'},
                status=status.HTTP_404_NOT_FOUND)

        # Déjà validé
        if rapport.valide:
            return Response({
                'message': 'Rapport déjà validé',
                'rapport_id': rapport.id,
                'date_validation': rapport.date_validation
            }, status=status.HTTP_200_OK)

        rapport.valide = True
        rapport.date_validation = timezone.now()
        rapport.save()

        return Response({
            'message': 'Rapport validé avec succès !',
            'rapport_id': rapport.id,
            'intervention': rapport.intervention.numero,
            'technicien': rapport.intervention.technicien.nom
                if rapport.intervention.technicien else 'N/A',
            'valide': rapport.valide,
            'date_validation': rapport.date_validation
        }, status=status.HTTP_200_OK)

# ────────────────────────────────────────────────────────────
# ─── PIÈCES UTILISÉES ───
# ────────────────────────────────────────────────────────────

class AjouterPieceUtiliseeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(user=user)
                if intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN)
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN)

        piece_id = request.data.get('piece_id')
        quantite = request.data.get('quantite')

        if not piece_id or not quantite:
            return Response(
                {'erreur': 'piece_id et quantite sont obligatoires'},
                status=status.HTTP_400_BAD_REQUEST)

        try:
            piece = Piece.objects.get(pk=piece_id)
        except Piece.DoesNotExist:
            return Response(
                {'erreur': 'Pièce non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        quantite = int(quantite)
        if piece.quantite_stock < quantite:
            return Response({
                'erreur': 'Stock insuffisant',
                'stock_disponible': piece.quantite_stock,
                'quantite_demandee': quantite
            }, status=status.HTTP_400_BAD_REQUEST)

        piece_utilisee_existante = PieceUtilisee.objects.filter(
            intervention=intervention, piece=piece).first()

        if piece_utilisee_existante:
            ancienne_qte = piece_utilisee_existante.quantite
            difference = quantite - ancienne_qte

            if difference > 0 and piece.quantite_stock < difference:
                return Response({
                    'erreur': 'Stock insuffisant',
                    'stock_disponible': piece.quantite_stock,
                    'quantite_supplementaire': difference
                }, status=status.HTTP_400_BAD_REQUEST)

            piece_utilisee_existante.quantite = quantite
            piece_utilisee_existante.prix_unitaire = piece.prix_unitaire
            piece_utilisee_existante.save()

            piece.quantite_stock -= difference
            piece.save()

            return Response({
                'message': 'Quantité mise à jour',
                'piece': piece.nom,
                'quantite': quantite,
                'stock_restant': piece.quantite_stock,
                'prix_unitaire': str(piece.prix_unitaire),
                'sous_total': str(quantite * piece.prix_unitaire)
            }, status=status.HTTP_200_OK)

        PieceUtilisee.objects.create(
            intervention=intervention,
            piece=piece,
            quantite=quantite,
            prix_unitaire=piece.prix_unitaire
        )

        piece.quantite_stock -= quantite
        piece.save()

        return Response({
            'message': 'Pièce ajoutée avec succès',
            'piece': piece.nom,
            'reference': piece.reference,
            'quantite': quantite,
            'stock_restant': piece.quantite_stock,
            'prix_unitaire': str(piece.prix_unitaire),
            'sous_total': str(quantite * piece.prix_unitaire)
        }, status=status.HTTP_201_CREATED)


class SupprimerPieceUtiliseeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            piece_utilisee = PieceUtilisee.objects.get(pk=pk)
        except PieceUtilisee.DoesNotExist:
            return Response(
                {'erreur': 'Pièce utilisée non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if (hasattr(user, 'profil') and user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(user=user)
                if piece_utilisee.intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN)
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN)

        piece = piece_utilisee.piece
        piece.quantite_stock += piece_utilisee.quantite
        piece.save()
        piece_utilisee.delete()

        return Response({
            'message': 'Pièce retirée avec succès',
            'stock_restaure': piece.quantite_stock
        }, status=status.HTTP_200_OK)


class ListePiecesUtiliseesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND)

        pieces = intervention.pieces_utilisees.all()
        serializer = PieceUtiliseeSerializer(pieces, many=True)
        total = sum(p.quantite * p.prix_unitaire for p in pieces)

        return Response({
            'intervention': intervention.numero,
            'pieces': serializer.data,
            'total_pieces': str(total)
        })
    # ─── DIAGNOSTIC IA ───
class DiagnosticIAView(APIView):
    """
    POST /api/diagnostic/analyser/

    Analyse la description d'une panne
    et retourne :
    - categorie
    - type_service
    - urgence
    - origine_probleme
    - specialite_requise
    - solution proposée        ← NOUVEAU
    - duree estimée            ← NOUVEAU
    - prevention               ← NOUVEAU
    - pieces_suggerees
    - technicien_recommande    ← NOUVEAU
    - tous_techniciens classés ← NOUVEAU
    - confiance
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):

        description = request.data.get(
            'description', '').strip()
        # Optionnel : si fourni, le diagnostic sera enregistré
        # dans interventions_diagnosticia pour cette intervention.
        intervention_id = request.data.get('intervention_id')

        # ── Validation ──
        if not description:
            return Response({
                'erreur':
                    'La description est obligatoire'
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(description) < 5:
            return Response({
                'erreur':
                    'Description trop courte. '
                    'Minimum 5 caractères.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── Importer le predictor ──
        try:
            from .ml.predictor import (
                predire, MODELES_OK)
        except ImportError as e:
            return Response({
                'erreur':
                    f'Module NLP non disponible : '
                    f'{str(e)}'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not MODELES_OK:
            return Response({
                'erreur':
                    'Modèles IA non entraînés. '
                    'Contactez l\'administrateur.',
                'commande':
                    'python interventions/ml/'
                    'train_models.py'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # ── Récupérer tous les techniciens ──
        try:
            techniciens = Technicien.objects\
                .all()\
                .select_related('user')

            techniciens_info = []
            for t in techniciens:
                techniciens_info.append({
                    'id':           t.id,
                    'nom':          t.nom,
                    'specialite':   t.specialite,
                    'disponible':   t.disponible,
                    'tarif_horaire': float(
                        t.tarif_horaire or 0),
                    'telephone':
                        t.telephone or '',
                })
        except Exception as e:
            techniciens_info = []

        # ── Lancer la prédiction ──
        resultat = predire(
            description=description,
            techniciens_disponibles=techniciens_info
        )

        if not resultat.get('succes'):
            return Response({
                'erreur': resultat.get(
                    'erreur',
                    'Erreur interne NLP')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # ── Enrichir avec interventions en cours ──
        tous_techniciens_enrichis = []
        for tech in resultat.get(
                'tous_techniciens', []):
            try:
                nb_en_cours = \
                    Intervention.objects.filter(
                        technicien_id=tech['id'],
                        statut__in=[
                            'assigne',
                            'en_cours',
                            'attente_pieces'
                        ]
                    ).count()

                if nb_en_cours >= 4:
                    charge = 'Surchargé'
                    charge_color = '#f5222d'
                elif nb_en_cours >= 2:
                    charge = 'Chargé'
                    charge_color = '#fa8c16'
                else:
                    charge = 'Disponible'
                    charge_color = '#52c41a'

                tous_techniciens_enrichis.append({
                    **tech,
                    'interventions_en_cours':
                        nb_en_cours,
                    'charge':       charge,
                    'charge_color': charge_color,
                })
            except Exception:
                tous_techniciens_enrichis.append({
                    **tech,
                    'interventions_en_cours': 0,
                    'charge':       'Inconnu',
                    'charge_color': '#999',
                })

        # ── Construire la réponse ──
        diagnostic_data = {

            # Prédictions de base
            'categorie':
                resultat['categorie'],
            'type_service':
                resultat['type_service'],
            'urgence':
                resultat['urgence'],
            'origine_probleme':
                resultat['origine_probleme'],
            'specialite_requise':
                resultat['specialite_requise'],

            # Nouveaux champs
            'solution':
                resultat['solution'],
            'duree':
                resultat['duree'],
            'prevention':
                resultat['prevention'],
            'pieces_suggerees':
                resultat['pieces_suggerees'],

            # Technicien
            'technicien_recommande':
                resultat['technicien_recommande'],
            'tous_techniciens':
                tous_techniciens_enrichis,

            # Confiance
            'confiance':
                resultat['confiance'],
        }

        # ── Journaliser dans interventions_diagnosticia (si lié) ──
        enregistre = False
        if intervention_id:
            try:
                intervention = Intervention.objects.get(pk=intervention_id)
                enregistrer_diagnostic_ia(intervention, diagnostic_data)
                enregistre = True
            except Intervention.DoesNotExist:
                pass
            except Exception:
                pass

        return Response({
            'succes': True,
            'enregistre': enregistre,
            'diagnostic': diagnostic_data,
        }, status=status.HTTP_200_OK)
        
# ════════════════════════════════════════
# VUE 1 — Ajouter une image
# ════════════════════════════════════════
 
class AjouterImageView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [
        MultiPartParser,
        FormParser
    ]
 
    def post(self, request, pk):
 
        # ─── 1. Vérifier intervention ───
        try:
            intervention = \
                Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur':
                     'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )
 
        # ─── 2. Vérifier accès technicien ───
        user = request.user
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                if intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur':
                         'Profil introuvable'},
                    status=status.HTTP_403_FORBIDDEN
                )
 
        # ─── 3. Vérifier fichier ───
        if 'image' not in request.FILES:
            return Response({
                'erreur':
                    'Champ "image" manquant',
                'champs_recus':
                    list(request.FILES.keys())
            }, status=status.HTTP_400_BAD_REQUEST)
 
        fichier = request.FILES['image']
 
        # ─── 4. Vérifier type MIME ───
        ct = fichier.content_type.lower()
        if not any(t in ct for t in
                   ['jpeg', 'jpg',
                    'png', 'webp']):
            return Response({
                'erreur':
                    f'Format non autorisé : {ct}'
                    f'. Utilisez JPG, PNG ou WEBP'
            }, status=status.HTTP_400_BAD_REQUEST)
 
        # ─── 5. Vérifier taille (5 Mo) ───
        if fichier.size > 5 * 1024 * 1024:
            taille = round(
                fichier.size / 1024 / 1024, 2)
            return Response({
                'erreur':
                    f'Image trop grande '
                    f'({taille} Mo). Max : 5 Mo'
            }, status=status.HTTP_400_BAD_REQUEST)
 
        # ─── 6. Upload sur Cloudinary ───
        try:
            dossier = (
                f"techassist/interventions/"
                f"{intervention.id}"
            )
 
            upload_result = (
                cloudinary.uploader.upload(
                    fichier,
                    folder=dossier,
                    resource_type='image',
                )
            )
 
            public_id = upload_result['public_id']
 
        except Exception as e:
            print("Erreur Cloudinary :")
            print(traceback.format_exc())
            return Response({
                'erreur':
                    f'Erreur Cloudinary : '
                    f'{str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 
        # ─── 7. Sauvegarder en base ───
        try:
            from .models import ImageIntervention
            from .serializers import (
                ImageInterventionSerializer)
 
            image_obj = \
                ImageIntervention.objects.create(
                    intervention=intervention,
                    image=public_id,
                    type_image=request.data.get(
                        'type_image', 'autre'),
                    description=request.data.get(
                        'description', '')
                )
 
            return Response({
                'message': 'Image ajoutée !',
                'image':
                    ImageInterventionSerializer(
                        image_obj,
                        context={
                            'request': request
                        }
                    ).data
            }, status=status.HTTP_201_CREATED)
 
        except Exception as e:
            print("Erreur sauvegarde :")
            print(traceback.format_exc())
            return Response({
                'erreur':
                    f'Erreur sauvegarde : '
                    f'{str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 
 
# ════════════════════════════════════════
# VUE 2 — Lister les images
# ════════════════════════════════════════
 
class ListeImagesView(APIView):
    permission_classes = [IsAuthenticated]
 
    def get(self, request, pk):
 
        try:
            intervention = \
                Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur':
                     'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )
 
        # Vérifier accès technicien
        user = request.user
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                if intervention.technicien != tech:
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN
                )
 
        from .models import ImageIntervention
        from .serializers import (
            ImageInterventionSerializer)
 
        images = ImageIntervention.objects.filter(
            intervention=intervention
        ).order_by('type_image', 'date_ajout')
 
        return Response({
            'intervention':
                intervention.numero,
            'nb_images':
                images.count(),
            'images':
                ImageInterventionSerializer(
                    images,
                    many=True,
                    context={'request': request}
                ).data
        })
 
 
# ════════════════════════════════════════
# VUE 3 — Supprimer une image
# ════════════════════════════════════════
 
class SupprimerImageView(APIView):
    permission_classes = [IsAuthenticated]
 
    def delete(self, request, pk):
 
        from .models import ImageIntervention
 
        try:
            image = \
                ImageIntervention.objects.get(
                    pk=pk)
        except ImageIntervention.DoesNotExist:
            return Response(
                {'erreur': 'Image non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )
 
        # Vérifier accès technicien
        user = request.user
        if (hasattr(user, 'profil') and
                user.profil.role == 'technicien'):
            try:
                tech = Technicien.objects.get(
                    user=user)
                if (image.intervention.technicien
                        != tech):
                    return Response(
                        {'erreur': 'Accès refusé'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Technicien.DoesNotExist:
                return Response(
                    {'erreur': 'Accès refusé'},
                    status=status.HTTP_403_FORBIDDEN
                )
 
        # Supprimer sur Cloudinary
        try:
            if image.image:
                cloudinary.uploader.destroy(
                    str(image.image),
                    resource_type='image'
                )
        except Exception as e:
            print(f"Erreur Cloudinary destroy: {e}")
 
        # Supprimer en base
        image.delete()

        return Response({
            'message':
                'Image supprimée de Cloudinary'
        }, status=status.HTTP_200_OK)


# ════════════════════════════════════════════════════
# ─── ADMINISTRATION : GESTION DES UTILISATEURS ───
# Réservé au rôle 'admin'
# ════════════════════════════════════════════════════

def _serialiser_utilisateur(user):
    """Représentation unifiée d'un compte (User + profil + fiche liée)."""
    role = user.profil.role if hasattr(user, 'profil') else 'admin'
    nom = user.get_full_name() or user.username
    telephone = ''
    specialite = None
    fiche_id = None
    if role == 'technicien':
        tech = Technicien.objects.filter(user=user).first()
        if tech:
            nom, telephone, specialite, fiche_id = (
                tech.nom, tech.telephone, tech.specialite, tech.id)
    elif role == 'agent':
        agent = Agent.objects.filter(user=user).first()
        if agent:
            nom, telephone, fiche_id = agent.nom, agent.telephone, agent.id
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'nom': nom,
        'role': role,
        'telephone': telephone,
        'specialite': specialite,
        'fiche_id': fiche_id,
        'is_active': user.is_active,
        'date_joined': user.date_joined,
    }


class GestionUtilisateursView(APIView):
    """Liste / création de comptes utilisateurs (admin uniquement)."""
    permission_classes = [EstAdmin]

    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        return Response([_serialiser_utilisateur(u) for u in users])

    def post(self, request):
        d = request.data
        username = (d.get('username') or '').strip()
        password = d.get('password') or ''
        role = d.get('role')
        nom = (d.get('nom') or '').strip()

        if not username or not password or role not in (
                'admin', 'responsable', 'agent', 'technicien'):
            return Response(
                {'erreur': 'username, password et role valide requis'},
                status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'erreur': "Ce nom d'utilisateur existe déjà"},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                parts = nom.split(' ', 1) if nom else ['', '']
                user = User.objects.create_user(
                    username=username, password=password,
                    email=d.get('email', ''),
                    first_name=parts[0],
                    last_name=parts[1] if len(parts) > 1 else '')
                ProfilUtilisateur.objects.create(user=user, role=role)

                if role == 'technicien':
                    Technicien.objects.create(
                        user=user, nom=nom or username,
                        specialite=d.get('specialite', 'hardware'),
                        telephone=d.get('telephone', ''),
                        competences=d.get('competences', ''),
                        tarif_horaire=d.get('tarif_horaire') or 0)
                elif role == 'agent':
                    Agent.objects.create(
                        user=user, nom=nom or username,
                        telephone=d.get('telephone', ''))
        except IntegrityError as e:
            return Response({'erreur': str(e)},
                            status=status.HTTP_400_BAD_REQUEST)

        return Response(_serialiser_utilisateur(user),
                        status=status.HTTP_201_CREATED)


class GestionUtilisateurDetailView(APIView):
    """Détail / modification / suppression d'un compte (admin uniquement)."""
    permission_classes = [EstAdmin]

    def get(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(_serialiser_utilisateur(user))

    def put(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        d = request.data

        if 'is_active' in d:
            user.is_active = bool(d['is_active'])
        if d.get('email') is not None:
            user.email = d['email']
        if d.get('password'):
            user.set_password(d['password'])
        nom = d.get('nom')
        if nom:
            parts = nom.split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''
        user.save()

        # rôle + fiche liée
        role = d.get('role')
        if role and hasattr(user, 'profil'):
            user.profil.role = role
            user.profil.save()

        role = user.profil.role if hasattr(user, 'profil') else None
        if role == 'technicien':
            tech = Technicien.objects.filter(user=user).first()
            if not tech:
                tech = Technicien(user=user, tarif_horaire=0)
            if nom:
                tech.nom = nom
            if d.get('telephone') is not None:
                tech.telephone = d['telephone']
            if d.get('specialite'):
                tech.specialite = d['specialite']
            if d.get('tarif_horaire') is not None:
                tech.tarif_horaire = d['tarif_horaire']
            if not tech.nom:
                tech.nom = user.username
            tech.save()
        elif role == 'agent':
            agent = Agent.objects.filter(user=user).first()
            if not agent:
                agent = Agent(user=user, nom=nom or user.username)
            if nom:
                agent.nom = nom
            if d.get('telephone') is not None:
                agent.telephone = d['telephone']
            agent.save()

        return Response(_serialiser_utilisateur(user))

    def delete(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if user == request.user:
            return Response(
                {'erreur': 'Vous ne pouvez pas supprimer votre propre compte'},
                status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminStatsView(APIView):
    """Statistiques système pour le tableau de bord administrateur."""
    permission_classes = [EstAdmin]

    def get(self, request):
        roles = (ProfilUtilisateur.objects
                 .values('role').annotate(count=Count('id')))
        interventions = Intervention.objects.all()
        ca = Facture.objects.aggregate(total=Sum('total_ttc'))['total'] or 0

        return Response({
            'utilisateurs': {
                'total': User.objects.count(),
                'actifs': User.objects.filter(is_active=True).count(),
                'par_role': {r['role']: r['count'] for r in roles},
            },
            'interventions': {
                'total': interventions.count(),
                'en_cours': interventions.filter(statut='en_cours').count(),
                'terminees': interventions.filter(statut='termine').count(),
                'par_statut': list(
                    interventions.values('statut').annotate(count=Count('id'))),
            },
            'ressources': {
                'techniciens': Technicien.objects.count(),
                'techniciens_disponibles':
                    Technicien.objects.filter(disponible=True).count(),
                'clients': Client.objects.count(),
                'pieces_rupture': Piece.objects.filter(
                    quantite_stock__lte=F('seuil_minimum')).count(),
            },
            'chiffre_affaires': float(ca),
        })