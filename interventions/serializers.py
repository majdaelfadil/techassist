from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (Client, Technicien, Agent,
                     ProfilUtilisateur, Appareil,
                     Piece, Intervention, PieceUtilisee,
                     DiagnosticIA, Rapport, Facture)

# ─── USER ───
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email',
                  'first_name', 'last_name']

# ─── CLIENT ───
class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'

# ─── TECHNICIEN ───
class TechnicienSerializer(
        serializers.ModelSerializer):
    class Meta:
        model = Technicien
        fields = '__all__'

# ─── AGENT ───
class AgentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        source='user.username', read_only=True)
    email = serializers.CharField(
        source='user.email', read_only=True)

    class Meta:
        model = Agent
        fields = '__all__'

# ─── PROFIL UTILISATEUR ───
class ProfilUtilisateurSerializer(
        serializers.ModelSerializer):
    username = serializers.CharField(
        source='user.username', read_only=True)
    email = serializers.CharField(
        source='user.email', read_only=True)
    nom = serializers.SerializerMethodField()

    class Meta:
        model = ProfilUtilisateur
        fields = '__all__'

    def get_nom(self, obj):
        if obj.role == 'technicien':
            try:
                tech = Technicien.objects.get(
                    user=obj.user)
                return tech.nom
            except Technicien.DoesNotExist:
                pass
        elif obj.role == 'agent':
            try:
                agent = Agent.objects.get(
                    user=obj.user)
                return agent.nom
            except Agent.DoesNotExist:
                pass
        return (obj.user.get_full_name() or
                obj.user.username)

# ─── APPAREIL ───
class AppareilSerializer(
        serializers.ModelSerializer):
    client_nom = serializers.CharField(
        source='client.nom', read_only=True)

    class Meta:
        model = Appareil
        fields = '__all__'

# ─── PIECE ───
class PieceSerializer(serializers.ModelSerializer):
    en_rupture = serializers.SerializerMethodField()

    class Meta:
        model = Piece
        fields = '__all__'

    def get_en_rupture(self, obj):
        return obj.quantite_stock <= obj.seuil_minimum

# ─── PIECE UTILISEE ───
class PieceUtiliseeSerializer(
        serializers.ModelSerializer):
    piece_nom = serializers.CharField(
        source='piece.nom', read_only=True)
    sous_total = serializers.SerializerMethodField()

    class Meta:
        model = PieceUtilisee
        fields = '__all__'

    def get_sous_total(self, obj):
        return obj.quantite * obj.prix_unitaire

# ─── DIAGNOSTIC IA ───
class DiagnosticIASerializer(
        serializers.ModelSerializer):
    class Meta:
        model = DiagnosticIA
        fields = '__all__'

# ─── RAPPORT ───
class RapportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rapport
        fields = '__all__'

# ─── FACTURE ───
class FactureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Facture
        fields = '__all__'

# ─── INTERVENTION LISTE ───
class InterventionListSerializer(
        serializers.ModelSerializer):
    client_nom = serializers.CharField(
        source='client.nom', read_only=True)
    technicien_nom = serializers.CharField(
        source='technicien.nom', read_only=True)
    appareil_info = serializers.SerializerMethodField()

    class Meta:
        model = Intervention
        fields = ['id', 'numero', 'client_nom',
                  'technicien_nom', 'appareil_info',
                  'type_service', 'statut', 'urgence',
                  'canal_entree', 'date_creation',
                  'date_planifiee', 'duree_estimee']

    def get_appareil_info(self, obj):
        if obj.appareil:
            return (f"{obj.appareil.marque} "
                    f"{obj.appareil.modele}")
        return None

# ─── INTERVENTION DETAIL ───
class InterventionDetailSerializer(
        serializers.ModelSerializer):
    client = ClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(),
        source='client', write_only=True)
    technicien = TechnicienSerializer(read_only=True)
    technicien_id = serializers.PrimaryKeyRelatedField(
        queryset=Technicien.objects.all(),
        source='technicien', write_only=True,
        required=False, allow_null=True)
    appareil = AppareilSerializer(read_only=True)
    appareil_id = serializers.PrimaryKeyRelatedField(
        queryset=Appareil.objects.all(),
        source='appareil', write_only=True,
        required=False, allow_null=True)
    pieces_utilisees = PieceUtiliseeSerializer(
        many=True, read_only=True)
    diagnostic = DiagnosticIASerializer(
        read_only=True)
    rapport = RapportSerializer(read_only=True)
    facture = FactureSerializer(read_only=True)

    class Meta:
        model = Intervention
        fields = '__all__'