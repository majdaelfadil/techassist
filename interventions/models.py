from django.db import models
from django.contrib.auth.models import User

# ─── CLIENT ───
class Client(models.Model):
    nom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True)
    adresse = models.TextField(blank=True, null=True)
    date_creation = models.DateTimeField(auto_now_add=True)

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
    user = models.OneToOneField(User, on_delete=models.SET_NULL, 
                                null=True, blank=True)
    nom = models.CharField(max_length=100)
    specialite = models.CharField(max_length=50, 
                                  choices=SPECIALITE_CHOICES)
    competences = models.TextField(blank=True, null=True)
    telephone = models.CharField(max_length=20, blank=True)
    tarif_horaire = models.DecimalField(max_digits=10, decimal_places=2)
    disponible = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nom} - {self.specialite}"

    class Meta:
        verbose_name = "Technicien"

# ─── APPAREIL ───
class Appareil(models.Model):
    TYPE_CHOICES = [
        ('PC', 'PC'),
        ('Laptop', 'Laptop'),
        ('Imprimante', 'Imprimante'),
        ('Serveur', 'Serveur'),
        ('Autre', 'Autre'),
    ]
    client = models.ForeignKey(Client, on_delete=models.CASCADE,
                               related_name='appareils')
    type_appareil = models.CharField(max_length=50, 
                                     choices=TYPE_CHOICES)
    marque = models.CharField(max_length=50)
    modele = models.CharField(max_length=100)
    numero_serie = models.CharField(max_length=100, 
                                    unique=True, blank=True, null=True)
    date_achat = models.DateField(blank=True, null=True)
    sous_garantie = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.marque} {self.modele} - {self.client.nom}"

    class Meta:
        verbose_name = "Appareil"

# ─── PIECE ───
class Piece(models.Model):
    nom = models.CharField(max_length=150)
    reference = models.CharField(max_length=100, unique=True)
    quantite_stock = models.IntegerField(default=0)
    seuil_minimum = models.IntegerField(default=5)
    prix_unitaire = models.DecimalField(max_digits=10, decimal_places=2)

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

    numero = models.CharField(max_length=20, unique=True, blank=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT,
                               related_name='interventions')
    appareil = models.ForeignKey(Appareil, on_delete=models.SET_NULL,
                                 null=True, blank=True,
                                 related_name='interventions')
    technicien = models.ForeignKey(Technicien, on_delete=models.SET_NULL,
                                   null=True, blank=True,
                                   related_name='interventions')
    description = models.TextField()
    type_service = models.CharField(max_length=50, 
                                    choices=TYPE_SERVICE_CHOICES)
    canal_entree = models.CharField(max_length=20, choices=CANAL_CHOICES)
    urgence = models.CharField(max_length=20, choices=URGENCE_CHOICES,
                               default='normale')
    statut = models.CharField(max_length=30, choices=STATUT_CHOICES,
                              default='nouveau')
    date_creation = models.DateTimeField(auto_now_add=True)
    date_planifiee = models.DateTimeField(blank=True, null=True)
    date_cloture = models.DateTimeField(blank=True, null=True)
    duree_estimee = models.DecimalField(max_digits=5, decimal_places=2,
                                        blank=True, null=True)
    duree_reelle = models.DecimalField(max_digits=5, decimal_places=2,
                                       blank=True, null=True)
    diagnostic_ia = models.TextField(blank=True, null=True)
    notes_technicien = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL,
                                   null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone
            year = timezone.now().year
            count = Intervention.objects.filter(
                date_creation__year=year).count() + 1
            self.numero = f"INT/{year}/{count:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} - {self.client.nom}"

    class Meta:
        verbose_name = "Intervention"
        ordering = ['-date_creation']

# ─── PIECE UTILISEE ───
class PieceUtilisee(models.Model):
    intervention = models.ForeignKey(Intervention, 
                                     on_delete=models.CASCADE,
                                     related_name='pieces_utilisees')
    piece = models.ForeignKey(Piece, on_delete=models.PROTECT)
    quantite = models.IntegerField()
    prix_unitaire = models.DecimalField(max_digits=10, decimal_places=2)

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
    intervention = models.OneToOneField(Intervention, 
                                        on_delete=models.CASCADE,
                                        related_name='diagnostic')
    description_entree = models.TextField()
    categorie_panne = models.CharField(max_length=100, blank=True)
    causes_probables = models.TextField(blank=True)
    pieces_suggerees = models.TextField(blank=True)
    complexite = models.CharField(max_length=20, 
                                  choices=COMPLEXITE_CHOICES,
                                  blank=True)
    duree_estimee = models.DecimalField(max_digits=5, decimal_places=2,
                                        blank=True, null=True)
    score_confiance = models.DecimalField(max_digits=5, decimal_places=2,
                                          blank=True, null=True)
    date_analyse = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Diagnostic - {self.intervention.numero}"

# ─── RAPPORT ───
class Rapport(models.Model):
    intervention = models.OneToOneField(Intervention,
                                        on_delete=models.CASCADE,
                                        related_name='rapport')
    contenu = models.TextField()
    genere_par_ia = models.BooleanField(default=False)
    date_generation = models.DateTimeField(auto_now_add=True)
    valide = models.BooleanField(default=False)
    date_validation = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Rapport - {self.intervention.numero}"

# ─── FACTURE ───
class Facture(models.Model):
    STATUT_CHOICES = [
        ('brouillon', 'Brouillon'),
        ('envoyee', 'Envoyée'),
        ('payee', 'Payée'),
        ('annulee', 'Annulée'),
    ]
    intervention = models.OneToOneField(Intervention,
                                        on_delete=models.PROTECT,
                                        related_name='facture')
    numero = models.CharField(max_length=20, unique=True, blank=True)
    montant_main_oeuvre = models.DecimalField(max_digits=10, 
                                              decimal_places=2, 
                                              default=0)
    montant_pieces = models.DecimalField(max_digits=10, 
                                         decimal_places=2, default=0)
    montant_deplacement = models.DecimalField(max_digits=10, 
                                              decimal_places=2, 
                                              default=0)
    tva = models.DecimalField(max_digits=5, decimal_places=2, 
                              default=20.00)
    total_ht = models.DecimalField(max_digits=10, decimal_places=2,
                                   default=0)
    total_ttc = models.DecimalField(max_digits=10, decimal_places=2,
                                    default=0)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES,
                              default='brouillon')
    date_emission = models.DateTimeField(auto_now_add=True)
    date_paiement = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.numero:
            from django.utils import timezone
            year = timezone.now().year
            count = Facture.objects.filter(
                date_emission__year=year).count() + 1
            self.numero = f"FAC/{year}/{count:04d}"
        self.total_ht = (self.montant_main_oeuvre + 
                        self.montant_pieces + 
                        self.montant_deplacement)
        self.total_ttc = self.total_ht * (1 + self.tva / 100)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} - {self.intervention.numero}"

    class Meta:
        verbose_name = "Facture"
        ordering = ['-date_emission']