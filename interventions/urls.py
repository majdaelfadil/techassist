from django.urls import path
from . import views

urlpatterns = [
    # ── Clients ──
    path('clients/',
         views.ClientListCreateView.as_view()),
    path('clients/<int:pk>/',
         views.ClientDetailView.as_view()),

    # ── Techniciens ──
    path('techniciens/',
         views.TechnicienListView.as_view()),
    path('techniciens/<int:pk>/',
         views.TechnicienDetailView.as_view()),

    # ── Agents ──
    path('agents/',
         views.AgentListCreateView.as_view()),
    path('agents/<int:pk>/',
         views.AgentDetailView.as_view()),

    # ── Appareils ──
    path('appareils/',
         views.AppareilListCreateView.as_view()),
    path('appareils/<int:pk>/',
         views.AppareilDetailView.as_view()),

    # ── Pièces ──
    path('pieces/',
         views.PieceListCreateView.as_view()),
    path('pieces/<int:pk>/',
         views.PieceDetailView.as_view()),

    # ── Interventions ──
    path('interventions/',
         views.InterventionListCreateView.as_view()),
    path('interventions/<int:pk>/',
         views.InterventionDetailView.as_view()),
    path('interventions/<int:pk>/changer-statut/',
         views.InterventionChangerStatutView.as_view()),
    path('interventions/<int:pk>/transitions/',
         views.InterventionTransitionsView.as_view()),
    path('interventions/<int:pk>/valider/',
         views.InterventionValiderView.as_view()),
    path('interventions/<int:pk>/envoyer-email-technicien/',
         views.EnvoyerEmailTechnicienView.as_view()),

    # ── Rapports ──
    path('rapports/',
         views.RapportListCreateView.as_view()),
    path('rapports/<int:pk>/',
         views.RapportDetailView.as_view()),

    # ── Factures ──
    path('factures/',
         views.FactureListView.as_view()),
    path('factures/<int:pk>/',
         views.FactureDetailView.as_view()),
    path('factures/<int:pk>/pdf/',
         views.FacturePDFView.as_view()),
    path('factures/<int:pk>/envoyer-email/',
         views.EnvoyerFactureEmailView.as_view()),

    # ── Dashboard ──
    path('dashboard/stats/',
         views.DashboardStatsView.as_view()),

    # ── Profil ──
    path('auth/profil/',
         views.MonProfilView.as_view()),

    # ── Planning Technicien ──
    path('technicien/planning/',
         views.MonPlanningView.as_view()),
]