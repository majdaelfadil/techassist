from django.urls import path
from . import views

urlpatterns = [
    # ── Clients ──
    path('clients/', views.ClientListCreateView.as_view(),
         name='client-list'),
    path('clients/<int:pk>/', views.ClientDetailView.as_view(),
         name='client-detail'),

    # ── Techniciens ──
    path('techniciens/', views.TechnicienListView.as_view(),
         name='technicien-list'),
    path('techniciens/<int:pk>/', views.TechnicienDetailView.as_view(),
         name='technicien-detail'),

    # ── Appareils ──
    path('appareils/', views.AppareilListCreateView.as_view(),
         name='appareil-list'),
    path('appareils/<int:pk>/', views.AppareilDetailView.as_view(),
         name='appareil-detail'),

    # ── Pièces ──
    path('pieces/', views.PieceListCreateView.as_view(),
         name='piece-list'),
    path('pieces/<int:pk>/', views.PieceDetailView.as_view(),
         name='piece-detail'),

    # ── Interventions ──
    path('interventions/', views.InterventionListCreateView.as_view(),
         name='intervention-list'),
    path('interventions/<int:pk>/',
         views.InterventionDetailView.as_view(),
         name='intervention-detail'),

    # ── Rapports ──
    path('rapports/', views.RapportListCreateView.as_view(),
         name='rapport-list'),
    path('rapports/<int:pk>/', views.RapportDetailView.as_view(),
         name='rapport-detail'),

    # ── Factures ──
    path('factures/', views.FactureListView.as_view(),
         name='facture-list'),
    path('factures/<int:pk>/', views.FactureDetailView.as_view(),
         name='facture-detail'),

    # ── Dashboard ──
    path('dashboard/stats/', views.DashboardStatsView.as_view(),
         name='dashboard-stats'),
     # ── Workflow ──
     path('interventions/<int:pk>/changer-statut/',
          views.InterventionChangerStatutView.as_view(),
          name='intervention-changer-statut'),

     path('interventions/<int:pk>/transitions/',
          views.InterventionTransitionsView.as_view(),
          name='intervention-transitions'),
          # ── Validation et Facturation ──
     path('interventions/<int:pk>/valider/',
          views.InterventionValiderView.as_view(),
          name='intervention-valider'),
          
     path('factures/<int:pk>/pdf/',
     views.FacturePDFView.as_view(),
     name='facture-pdf'),
]