from django.db import models, transaction
from django.contrib.auth.models import User
from cloudinary.models import CloudinaryField


def chemin_image_intervention(instance, filename):
    return f"interventions/{filename}"

# ─── CLIENT ───
class Client(models.Model):
    nom = models.CharField(max_length=100)
    telephone = models.CharField(
        max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True)
    adresse = models.TextField(blank=True, null=True)
    date_creation = models.DateTimeField(
        auto_now_add=True)

    def __str__(self):
        return f"{self.nom} - {self.telephone}"

    class Meta:
        verbose_name = "Client"
        ordering = ['-date_creation']

# ─── TECHNICIEN ───
class Technicien(models.Model):
    SPECIALITE_CHOICES = [
        ('hardware', 'Hardware'),
        ('software', 'Software'),
        ('reseau', 'Réseau'),
        ('maintenance', 'Maintenance'),
    ]
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL,
        null=True, blank=True)
    nom = models.CharField(max_length=100)
    specialite = models.CharField(
        max_length=50, choices=SPECIALITE_CHOICES)
    competences = models.TextField(
        blank=True, null=True)
    telephone = models.CharField(
        max_length=20, blank=True)
    tarif_horaire = models.DecimalField(
        max_digits=10, decimal_places=2)
    disponible = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nom} - {self.specialite}"

    class Meta:
        verbose_name = "Technicien"

# ─── AGENT D'ACCUEIL ───
class Agent(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='agent')
    nom = models.CharField(max_length=100)
    telephone = models.CharField(
        max_length=20, blank=True)
    date_creation = models.DateTimeField(
        auto_now_add=True)

    def __str__(self):
        return f"{self.nom} — Agent"

    class Meta:
        verbose_name = "Agent d'accueil"

# ─── PROFIL UTILISATEUR ───
class ProfilUtilisateur(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Administrateur'),
        ('responsable', 'Responsable'),
        ('agent', 'Agent d\'accueil'),
        ('technicien', 'Technicien'),
    ]
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='profil')
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='agent')

    def __str__(self):
        return f"{self.user.username} — {self.role}"

    class Meta:
        verbose_name = "Profil utilisateur"

# ─── APPAREIL ───
class Appareil(models.Model):
 
    TYPE_CHOICES = [
        ("ordinateur", "Ordinateur"),
        ("imprimante",  "Imprimante"),
        ("serveur",     "Serveur"),
        ("reseau",      "Réseau"),
        ("autre",       "Autre"),
    ]
 
    client            = models.ForeignKey(
        "Client",
        on_delete=models.CASCADE,
        related_name="appareils",
    )
    marque            = models.CharField(max_length=100)
    modele            = models.CharField(max_length=100)
    type_appareil     = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="ordinateur",
    )
    numero_serie = models.CharField(max_length=100, blank=True, null=True, default="")
    sous_garantie     = models.BooleanField(default=False)
    date_fin_garantie = models.DateField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True, null=True, blank=True)
 
    class Meta:
        verbose_name = "Appareil"
        ordering     = ["-cree_le"]
 
    def __str__(self):
        return f"{self.marque} {self.modele} — {self.client.nom}"

# ─── PIECE ───
class Piece(models.Model):
    nom = models.CharField(max_length=150)
    reference = models.CharField(
        max_length=100, unique=True)
    quantite_stock = models.IntegerField(default=0)
    seuil_minimum = models.IntegerField(default=5)
    prix_unitaire = models.DecimalField(
        max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.nom} - {self.reference}"

    class Meta:
        verbose_name = "Pièce"

# ─── INTERVENTION ───
class Intervention(models.Model):
    STATUT_CHOICES = [
        ('nouveau', 'Nouveau'),
        ('diagnostique', 'Diagnostiqué'),
        ('assigne', 'Assigné'),
        ('en_cours', 'En cours'),
        ('attente_pieces', 'En attente pièces'),
        ('termine', 'Terminé'),
        ('valide', 'Validé'),
        ('facture', 'Facturé'),
        ('cloture', 'Clôturé'),
    ]
    TYPE_SERVICE_CHOICES = [
        ('reparation', 'Réparation matériel'),
        ('installation', 'Installation logiciel'),
        ('configuration', 'Configuration réseau'),
        ('maintenance', 'Maintenance préventive'),
        ('depannage', 'Dépannage à distance'),
    ]
    CANAL_CHOICES = [
        ('telephone', 'Téléphone'),
        ('boutique', 'Boutique'),
        ('email', 'Email'),
    ]
    URGENCE_CHOICES = [
        ('faible', 'Faible'),
        ('normale', 'Normale'),
        ('haute', 'Haute'),
        ('critique', 'Critique'),
    ]

    numero = models.CharField(
        max_length=20, unique=True, blank=True)
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT,
        related_name='interventions')
    appareil = models.ForeignKey(
        Appareil, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interventions')
    technicien = models.ForeignKey(
        Technicien, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='interventions')
    description = models.TextField()
    type_service = models.CharField(
        max_length=50,
        choices=TYPE_SERVICE_CHOICES)
    canal_entree = models.CharField(
        max_length=20, choices=CANAL_CHOICES)
    urgence = models.CharField(
        max_length=20, choices=URGENCE_CHOICES,
        default='normale')
    statut = models.CharField(
        max_length=30, choices=STATUT_CHOICES,
        default='nouveau')
    date_creation = models.DateTimeField(
        auto_now_add=True)
    date_planifiee = models.DateTimeField(
        blank=True, null=True)
    date_cloture = models.DateTimeField(
        blank=True, null=True)
    duree_estimee = models.DecimalField(
        max_digits=5, decimal_places=2,
        blank=True, null=True)
    duree_reelle = models.DecimalField(
        max_digits=5, decimal_places=2,
        blank=True, null=True)
    diagnostic_ia = models.TextField(
        blank=True, null=True)
    notes_technicien = models.TextField(
        blank=True, null=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone
            year = timezone.now().year
            # Utilise select_for_update pour éviter les doublons
            with transaction.atomic():
                derniere = (
                    Intervention.objects
                    .filter(numero__startswith=f"INT/{year}/")
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
                self.numero = f"INT/{year}/{nouveau_num:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} - {self.client.nom}"

    class Meta:
        verbose_name = "Intervention"
        ordering = ['-date_creation']

# ─── PIECE UTILISEE ───
class PieceUtilisee(models.Model):
    intervention = models.ForeignKey(
        Intervention, on_delete=models.CASCADE,
        related_name='pieces_utilisees')
    piece = models.ForeignKey(
        Piece, on_delete=models.PROTECT)
    quantite = models.IntegerField()
    prix_unitaire = models.DecimalField(
        max_digits=10, decimal_places=2)

    def sous_total(self):
        return self.quantite * self.prix_unitaire

    def __str__(self):
        return f"{self.piece.nom} x{self.quantite}"

# ─── DIAGNOSTIC IA ───
class DiagnosticIA(models.Model):
    COMPLEXITE_CHOICES = [
        ('faible', 'Faible'),
        ('moyenne', 'Moyenne'),
        ('elevee', 'Élevée'),
    ]
    intervention = models.OneToOneField(
        Intervention, on_delete=models.CASCADE,
        related_name='diagnostic')
    description_entree = models.TextField()
    categorie_panne = models.CharField(
        max_length=100, blank=True)
    causes_probables = models.TextField(blank=True)
    pieces_suggerees = models.TextField(blank=True)
    complexite = models.CharField(
        max_length=20,
        choices=COMPLEXITE_CHOICES, blank=True)
    duree_estimee = models.DecimalField(
        max_digits=5, decimal_places=2,
        blank=True, null=True)
    score_confiance = models.DecimalField(
        max_digits=5, decimal_places=2,
        blank=True, null=True)
    date_analyse = models.DateTimeField(
        auto_now_add=True)

    def __str__(self):
        return (f"Diagnostic - "
                f"{self.intervention.numero}")

# ─── RAPPORT ───
class Rapport(models.Model):
    intervention = models.OneToOneField(
        Intervention, on_delete=models.CASCADE,
        related_name='rapport')
    contenu = models.TextField()
    genere_par_ia = models.BooleanField(default=False)
    date_generation = models.DateTimeField(
        auto_now_add=True)
    valide = models.BooleanField(default=False)
    date_validation = models.DateTimeField(
        blank=True, null=True)

    def __str__(self):
        return f"Rapport - {self.intervention.numero}"

class ImageIntervention(models.Model):
 
    TYPE_CHOICES = [
        ('avant',    'Avant intervention'),
        ('apres',    'Après intervention'),
        ('panne',    'Photo de la panne'),
        ('piece',    'Photo de la pièce'),
        ('document', 'Document'),
        ('autre',    'Autre'),
    ]
 
    intervention = models.ForeignKey(
        'Intervention',
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name='Intervention'
    )
 
    # ✅ CloudinaryField — stockage sur Cloudinary
    image = CloudinaryField(
        'image',
        folder='techassist/interventions',
        resource_type='image',
        blank=True,
        null=True,
    )
 
    type_image = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default='autre',
        verbose_name='Type'
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name='Description'
    )
    date_ajout = models.DateTimeField(
        auto_now_add=True
    )
 
    class Meta:
        verbose_name = "Image d'intervention"
        verbose_name_plural = "Images"
        ordering = ['date_ajout']
 
    def __str__(self):
        return (
            f"{self.get_type_image_display()}"
            f" — {self.intervention.numero}"
        )

# ─── FACTURE ───
class Facture(models.Model):
    STATUT_CHOICES = [
        ('brouillon', 'Brouillon'),
        ('envoyee', 'Envoyée'),
        ('payee', 'Payée'),
        ('annulee', 'Annulée'),
    ]
    intervention = models.OneToOneField(
        Intervention, on_delete=models.PROTECT,
        related_name='facture')
    numero = models.CharField(
        max_length=20, unique=True, blank=True)
    montant_main_oeuvre = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    montant_pieces = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    montant_deplacement = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    tva = models.DecimalField(
        max_digits=5, decimal_places=2, default=20.00)
    total_ht = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    total_ttc = models.DecimalField(
        max_digits=10, decimal_places=2, default=0)
    statut = models.CharField(
        max_length=20, choices=STATUT_CHOICES,
        default='brouillon')
    date_emission = models.DateTimeField(
        auto_now_add=True)
    date_paiement = models.DateTimeField(
        blank=True, null=True)

    def save(self, *args, **kwargs):
        # ── Génération du numéro unique et atomique ──
        # On ne génère un numéro QUE si le champ est vide.
        # Si views.py en passe déjà un (via _generer_numero_facture_unique),
        # on le respecte sans le recalculer — ce qui évite le doublon.
        if not self.numero:
            from django.utils import timezone
            year = timezone.now().year
            with transaction.atomic():
                derniere = (
                    Facture.objects
                    .filter(numero__startswith=f"FAC/{year}/")
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
                self.numero = f"FAC/{year}/{nouveau_num:04d}"

        # ── Calcul des totaux (toujours recalculé) ──
        # On convertit tout en Decimal pour éviter le TypeError float + Decimal
        from decimal import Decimal
        self.total_ht = (
            Decimal(str(self.montant_main_oeuvre)) +
            Decimal(str(self.montant_pieces)) +
            Decimal(str(self.montant_deplacement))
        )
        self.total_ttc = (
            self.total_ht * (1 + Decimal(str(self.tva)) / Decimal('100'))
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return (f"{self.numero} - "
                f"{self.intervention.numero}")

    class Meta:
        verbose_name = "Facture"
        ordering = ['-date_emission']