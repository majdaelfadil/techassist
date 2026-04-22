from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import (
    IsAuthenticated, BasePermission)
from django.db.models import Count, F
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

# ════════════════════════════════
# ─── PERMISSIONS ───
# ════════════════════════════════

class EstResponsable(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role == 'responsable'

class EstAgent(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        # ✅ Agent seulement
        # Le responsable a son propre accès
        return request.user.profil.role == 'agent'

class EstAgentOuResponsable(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not hasattr(request.user, 'profil'):
            return True
        return request.user.profil.role in ['agent', 'responsable']

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
    serializer_class = AppareilSerializer
    permission_classes = [EstAgent]

    def get_queryset(self):
        queryset = Appareil.objects.all()
        client_id = self.request.query_params.get('client_id')
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

class AppareilDetailView(generics.RetrieveUpdateAPIView):
    queryset = Appareil.objects.all()
    serializer_class = AppareilSerializer
    permission_classes = [EstAgent]

# ════════════════════════════════
# ─── PIECES ───
# Agent gère le stock (POST, PUT, DELETE)
# Responsable et Technicien : lecture seulement (GET)
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
# Agent : lecture seulement + créer
# Responsable : gestion complète
# Technicien : voir ses interventions + modifier notes/durée
# ════════════════════════════════

class InterventionListCreateView(generics.ListCreateAPIView):

    def get_permissions(self):
        if self.request.method == 'POST':
            return [EstAgent()]  # Agent crée
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return InterventionDetailSerializer
        return InterventionListSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Intervention.objects.all()

        # Technicien voit seulement ses interventions
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
        serializer.save(created_by=self.request.user)

class InterventionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Intervention.objects.all()
    serializer_class = InterventionDetailSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [EstResponsable()]  # Supprimer : responsable seulement
        return [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        user = request.user
        intervention = self.get_object()
        
        # Vérifier la disponibilité si on modifie le technicien ou la date
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
        
        # Technicien peut seulement modifier notes_technicien et duree_reelle
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
        
        # Agent : peut seulement créer, pas modifier les interventions
        if (hasattr(user, 'profil') and user.profil.role == 'agent'):
            return Response({
                'erreur': 'L\'agent ne peut pas modifier une intervention'
            }, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

# ─── CHANGER STATUT ───

# Statuts que le technicien est autorisé à définir
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
        role = (user.profil.role
                if hasattr(user, 'profil')
                else 'responsable')

        # Agent ne peut pas changer le statut
        if role == 'agent':
            return Response({
                'erreur': 'L\'agent ne peut pas changer le statut d\'une intervention'
            }, status=status.HTTP_403_FORBIDDEN)

        # Technicien : seulement ses interventions
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

        # Statuts réservés responsable
        statuts_responsable = [
            'diagnostique', 'assigne',
            'valide', 'facture', 'cloture'
        ]

        # Statuts réservés technicien
        statuts_technicien = [
            'en_cours', 'attente_pieces', 'termine'
        ]

        if (role == 'technicien' and
                nouveau_statut in statuts_responsable):
            return Response({
                'erreur': 'Réservé au responsable',
                'statut_refuse': nouveau_statut
            }, status=status.HTTP_403_FORBIDDEN)

        if (role == 'responsable' and
                nouveau_statut in statuts_technicien):
            return Response({
                'erreur': 'Réservé au technicien',
                'statut_refuse': nouveau_statut
            }, status=status.HTTP_403_FORBIDDEN)

        # Vérification de la transition dans le workflow général
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

        # Le technicien ne voit que les transitions qu'il est autorisé à faire
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
# Responsable seulement
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

        # ✅ Vérifier que le rapport est validé
        if not hasattr(intervention, 'rapport') or \
                not intervention.rapport or \
                not intervention.rapport.valide:
            return Response({
                'erreur': 'Le rapport du technicien doit être validé avant de valider l\'intervention',
            }, status=status.HTTP_400_BAD_REQUEST)

        intervention.statut = 'valide'
        intervention.save()

        return Response({
            'message': 'Intervention validée !',
            'nouveau_statut': intervention.statut
        }, status=status.HTTP_200_OK)


# ════════════════════════════════════════════════════════════
# ─── VALIDER INTERVENTION ET GÉNÉRER FACTURE ───
# ════════════════════════════════════════════════════════════
def _generer_numero_facture_unique():
    """
    Génère un numéro de facture unique de manière atomique.
    Évite les doublons dus à une séquence désynchronisée en base.
    """
    from datetime import datetime
    annee = datetime.now().year
    prefix = f"FAC/{annee}/"

    with transaction.atomic():
        # Verrouille les lignes pour éviter les race conditions
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
                # Si une facture existe déjà pour cette intervention, on la met à jour
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
                    # Générer un numéro unique à l'intérieur d'une transaction atomique
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
            # Dernier recours : en cas de collision extrêmement rare,
            # on réessaie une fois avec un nouveau numéro
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
                message = f'Le samedi, les interventions sont uniquement de 08h30 à 13h00. Heure demandée : {date_locale.strftime("%H:%M")}'
            else:
                message = f'Heure {date_locale.strftime("%H:%M")} en dehors des horaires de travail. Horaires : 8h30-13h00 et 15h00-19h00'
            return Response({
                'disponible': False,
                'raison': 'hors_horaires',
                'message': message,
            }, status=status.HTTP_200_OK)

        if dans_matin and heure_fin > matin_fin:
            return Response({
                'disponible': False,
                'raison': 'depasse_horaires',
                'message': f'L\'intervention se termine à {date_fin_locale.strftime("%H:%M")} et dépasse la fin de matinée (13h00).',
                'suggestion': 'Réduisez la durée ou planifiez après 15h00' if jour_semaine < 5 else 'Réduisez la durée estimée'
            }, status=status.HTTP_200_OK)

        if dans_aprem and heure_fin > aprem_fin:
            return Response({
                'disponible': False,
                'raison': 'depasse_horaires',
                'message': f'L\'intervention se termine à {date_fin_locale.strftime("%H:%M")} et dépasse la fin de journée (19h00).',
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
                    'chevauchenent': f'{duree_chevauch:.1f}h'
                })

        if conflits:
            return Response({
                'disponible': False,
                'raison': 'conflit',
                'message': f'Le technicien {technicien.nom} a déjà {len(conflits)} intervention(s) qui chevauchent cette période (total chevauchement: {temps_total_chevauchant:.1f}h).',
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
        import pytz

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
                    'conflit': {
                        'intervention': autre.numero,
                        'client': autre.client.nom,
                        'debut': autre.date_planifiee.strftime('%d/%m/%Y %H:%M'),
                        'fin': fin_autre.strftime('%d/%m/%Y %H:%M')
                    }
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
        nom = (user.get_full_name() or user.username)
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

# ─── GÉNÉRER RAPPORT IA ───
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
                'erreur': 'Saisissez d\'abord vos notes'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            import google.generativeai as genai
            import os

            genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
            model = genai.GenerativeModel('gemini-pro')

            prompt = f"""
Tu es un expert en maintenance informatique.
Génère un rapport professionnel structuré
basé sur ces informations :

INTERVENTION : {intervention.numero}
CLIENT : {intervention.client.nom}
TYPE : {intervention.type_service}
APPAREIL : {f"{intervention.appareil.marque} {intervention.appareil.modele}" if intervention.appareil else "Non spécifié"}
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
            contenu_rapport = f"""
RAPPORT D'INTERVENTION — {intervention.numero}

CLIENT : {intervention.client.nom}
DATE : {intervention.date_creation.strftime('%d/%m/%Y')}
TYPE : {intervention.type_service}

DESCRIPTION DU PROBLÈME :
{intervention.description}

DIAGNOSTIC ET ACTIONS RÉALISÉES :
{intervention.notes_technicien}

TECHNICIEN : {intervention.technicien.nom if intervention.technicien else 'Non assigné'}
            """

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
    permission_classes = [EstResponsable]

    def post(self, request, pk):
        try:
            rapport = Rapport.objects.get(pk=pk)
        except Rapport.DoesNotExist:
            return Response(
                {'erreur': 'Rapport non trouvé'},
                status=status.HTTP_404_NOT_FOUND)

        rapport.valide = True
        rapport.date_validation = timezone.now()
        rapport.save()

        return Response({
            'message': 'Rapport validé avec succès',
            'rapport_id': rapport.id,
            'valide': rapport.valide,
            'date_validation': rapport.date_validation
        }, status=status.HTTP_200_OK)

# ─── AJOUTER PIECE UTILISEE ───
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

        piece_utilisee = PieceUtilisee.objects.create(
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

# ─── SUPPRIMER PIECE UTILISEE ───
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

# ─── LISTE PIECES UTILISEES PAR INTERVENTION ───
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