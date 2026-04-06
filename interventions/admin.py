from django.contrib import admin
from .models import (Client, Technicien, Agent,
                     ProfilUtilisateur, Appareil,
                     Piece, Intervention, PieceUtilisee,
                     DiagnosticIA, Rapport, Facture)

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['nom', 'telephone',
                    'email', 'date_creation']
    search_fields = ['nom', 'telephone', 'email']

@admin.register(Technicien)
class TechnicienAdmin(admin.ModelAdmin):
    list_display = ['nom', 'specialite',
                    'tarif_horaire', 'disponible', 'user']
    list_filter = ['specialite', 'disponible']
    search_fields = ['nom', 'telephone']

@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ['nom', 'telephone',
                    'user', 'date_creation']
    search_fields = ['nom', 'telephone']

@admin.register(ProfilUtilisateur)
class ProfilUtilisateurAdmin(admin.ModelAdmin):
    list_display = ['user', 'role']
    list_filter = ['role']

@admin.register(Appareil)
class AppareilAdmin(admin.ModelAdmin):
    list_display = ['marque', 'modele',
                    'type_appareil', 'client',
                    'sous_garantie']
    list_filter = ['type_appareil', 'sous_garantie']
    search_fields = ['marque', 'modele', 'numero_serie']

@admin.register(Piece)
class PieceAdmin(admin.ModelAdmin):
    list_display = ['nom', 'reference',
                    'quantite_stock', 'seuil_minimum',
                    'prix_unitaire']
    search_fields = ['nom', 'reference']

@admin.register(Intervention)
class InterventionAdmin(admin.ModelAdmin):
    list_display = ['numero', 'client', 'type_service',
                    'statut', 'urgence', 'technicien',
                    'date_creation']
    list_filter = ['statut', 'urgence',
                   'type_service', 'canal_entree']
    search_fields = ['numero', 'client__nom',
                     'description']

@admin.register(Facture)
class FactureAdmin(admin.ModelAdmin):
    list_display = ['numero', 'intervention',
                    'total_ttc', 'statut',
                    'date_emission']
    list_filter = ['statut']

@admin.register(Rapport)
class RapportAdmin(admin.ModelAdmin):
    list_display = ['intervention', 'genere_par_ia',
                    'valide', 'date_generation']
    list_filter = ['genere_par_ia', 'valide']

@admin.register(DiagnosticIA)
class DiagnosticIAAdmin(admin.ModelAdmin):
    list_display = ['intervention', 'categorie_panne',
                    'complexite', 'duree_estimee']