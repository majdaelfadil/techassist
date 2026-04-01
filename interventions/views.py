from django.http import HttpResponse
from .pdf_generator import generer_facture_pdf
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, F
from django.utils import timezone
from .models import (Client, Technicien, Appareil, Piece,
                     Intervention, PieceUtilisee,
                     DiagnosticIA, Rapport, Facture)
from .serializers import (ClientSerializer, TechnicienSerializer,
                           AppareilSerializer, PieceSerializer,
                           PieceUtiliseeSerializer,
                           InterventionListSerializer,
                           InterventionDetailSerializer,
                           RapportSerializer, FactureSerializer,
                           DiagnosticIASerializer)
from .workflow import transition_autorisee, get_transitions_possibles

# ─── CLIENTS ───
class ClientListCreateView(generics.ListCreateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Client.objects.all()
        search = self.request.query_params.get('search')
        telephone = self.request.query_params.get('telephone')
        if search:
            queryset = queryset.filter(nom__icontains=search)
        if telephone:
            queryset = queryset.filter(
                telephone__icontains=telephone)
        return queryset

class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

# ─── TECHNICIENS ───
class TechnicienListView(generics.ListCreateAPIView):
    queryset = Technicien.objects.all()
    serializer_class = TechnicienSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Technicien.objects.all()
        disponible = self.request.query_params.get('disponible')
        if disponible:
            queryset = queryset.filter(disponible=True)
        return queryset

class TechnicienDetailView(generics.RetrieveUpdateAPIView):
    queryset = Technicien.objects.all()
    serializer_class = TechnicienSerializer
    permission_classes = [IsAuthenticated]

# ─── APPAREILS ───
class AppareilListCreateView(generics.ListCreateAPIView):
    queryset = Appareil.objects.all()
    serializer_class = AppareilSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Appareil.objects.all()
        client_id = self.request.query_params.get('client_id')
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

class AppareilDetailView(generics.RetrieveUpdateAPIView):
    queryset = Appareil.objects.all()
    serializer_class = AppareilSerializer
    permission_classes = [IsAuthenticated]

# ─── PIECES ───
class PieceListCreateView(generics.ListCreateAPIView):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer
    permission_classes = [IsAuthenticated]

class PieceDetailView(generics.RetrieveUpdateAPIView):
    queryset = Piece.objects.all()
    serializer_class = PieceSerializer
    permission_classes = [IsAuthenticated]

# ─── INTERVENTIONS ───
class InterventionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return InterventionDetailSerializer
        return InterventionListSerializer

    def get_queryset(self):
        queryset = Intervention.objects.all()
        statut = self.request.query_params.get('statut')
        urgence = self.request.query_params.get('urgence')
        technicien_id = self.request.query_params.get(
            'technicien_id')
        client_id = self.request.query_params.get('client_id')
        if statut:
            queryset = queryset.filter(statut=statut)
        if urgence:
            queryset = queryset.filter(urgence=urgence)
        if technicien_id:
            queryset = queryset.filter(
                technicien_id=technicien_id)
        if client_id:
            queryset = queryset.filter(client_id=client_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class InterventionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Intervention.objects.all()
    serializer_class = InterventionDetailSerializer
    permission_classes = [IsAuthenticated]

# ─── CHANGER STATUT INTERVENTION ───
class InterventionChangerStatutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )

        nouveau_statut = request.data.get('statut')

        if not nouveau_statut:
            return Response(
                {'erreur': 'Statut manquant'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not transition_autorisee(intervention.statut,
                                    nouveau_statut):
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
            'transitions_possibles': get_transitions_possibles(
                nouveau_statut)
        }, status=status.HTTP_200_OK)

# ─── OBTENIR TRANSITIONS POSSIBLES ───
class InterventionTransitionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )

        transitions = get_transitions_possibles(
            intervention.statut)

        return Response({
            'statut_actuel': intervention.statut,
            'transitions_possibles': transitions
        })

# ─── RAPPORTS ───
class RapportListCreateView(generics.ListCreateAPIView):
    queryset = Rapport.objects.all()
    serializer_class = RapportSerializer
    permission_classes = [IsAuthenticated]

class RapportDetailView(generics.RetrieveUpdateAPIView):
    queryset = Rapport.objects.all()
    serializer_class = RapportSerializer
    permission_classes = [IsAuthenticated]

# ─── FACTURES ───
class FactureListView(generics.ListAPIView):
    queryset = Facture.objects.all()
    serializer_class = FactureSerializer
    permission_classes = [IsAuthenticated]

class FactureDetailView(generics.RetrieveUpdateAPIView):
    queryset = Facture.objects.all()
    serializer_class = FactureSerializer
    permission_classes = [IsAuthenticated]

# ─── DASHBOARD ───
class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        aujourd_hui = timezone.now().date()

        stats = {
            'interventions_aujourd_hui': Intervention.objects.filter(
                date_creation__date=aujourd_hui).count(),
            'interventions_en_cours': Intervention.objects.filter(
                statut='en_cours').count(),
            'interventions_en_retard': Intervention.objects.filter(
                date_planifiee__lt=timezone.now(),
                statut__in=['nouveau', 'diagnostique',
                            'assigne', 'en_cours']).count(),
            'interventions_terminees': Intervention.objects.filter(
                statut='termine').count(),
            'total_interventions': Intervention.objects.count(),
            'techniciens_disponibles': Technicien.objects.filter(
                disponible=True).count(),
            'pieces_en_rupture': Piece.objects.filter(
                quantite_stock__lte=F('seuil_minimum')).count(),
        }

        interventions_par_statut = Intervention.objects.values(
            'statut').annotate(count=Count('id'))

        interventions_par_type = Intervention.objects.values(
            'type_service').annotate(count=Count('id'))

        return Response({
            'stats': stats,
            'par_statut': list(interventions_par_statut),
            'par_type': list(interventions_par_type),
        })
    # ─── FACTURATION AUTOMATIQUE ───
class InterventionValiderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            intervention = Intervention.objects.get(pk=pk)
        except Intervention.DoesNotExist:
            return Response(
                {'erreur': 'Intervention non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Vérifier que l'intervention est terminée
        if intervention.statut != 'termine':
            return Response({
                'erreur': 'Intervention doit être terminée',
                'statut_actuel': intervention.statut
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculer montant des pièces utilisées
        montant_pieces = sum(
            p.quantite * p.prix_unitaire
            for p in intervention.pieces_utilisees.all()
        )

        # Calculer montant main d'oeuvre
        duree = intervention.duree_reelle or intervention.duree_estimee or 1
        technicien = intervention.technicien
        tarif = technicien.tarif_horaire if technicien else 150
        montant_main_oeuvre = float(duree) * float(tarif)

        # Créer la facture automatiquement
        facture, created = Facture.objects.get_or_create(
            intervention=intervention,
            defaults={
                'montant_main_oeuvre': montant_main_oeuvre,
                'montant_pieces': montant_pieces,
                'montant_deplacement': 0,
                'tva': 20,
                'statut': 'brouillon'
            }
        )

        # Changer le statut de l'intervention
        intervention.statut = 'valide'
        intervention.save()

        return Response({
            'message': 'Intervention validée et facture générée',
            'intervention_statut': intervention.statut,
            'facture': {
                'numero': facture.numero,
                'montant_main_oeuvre': facture.montant_main_oeuvre,
                'montant_pieces': facture.montant_pieces,
                'total_ht': facture.total_ht,
                'total_ttc': facture.total_ttc,
                'statut': facture.statut
            }
        }, status=status.HTTP_200_OK)
    # ─── TÉLÉCHARGER FACTURE PDF ───
class FacturePDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            facture = Facture.objects.get(pk=pk)
        except Facture.DoesNotExist:
            return Response(
                {'erreur': 'Facture non trouvée'},
                status=status.HTTP_404_NOT_FOUND
            )

        buffer = generer_facture_pdf(facture)

        response = HttpResponse(
            buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="facture_{facture.numero}.pdf"')
        return response
