from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # ── Admin Django ──
    path('admin/', admin.site.urls),

    # ── Authentification JWT ──
    path('api/auth/login/', TokenObtainPairView.as_view(),
         name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(),
         name='token_refresh'),

    # ── APIs du projet ──
    path('api/', include('interventions.urls')),
]