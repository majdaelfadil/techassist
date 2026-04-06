from django.core.mail import EmailMessage

# ─── EMAIL NOTIFICATION TECHNICIEN ───
def envoyer_notification_technicien(intervention):
    if not intervention.technicien:
        return False
    if not intervention.technicien.user:
        return False
    if not intervention.technicien.user.email:
        return False

    try:
        sujet = (f"Nouvelle intervention assignée "
                 f"— {intervention.numero}")

        contenu = f"""
Bonjour {intervention.technicien.nom},

Une nouvelle intervention vous a été assignée.

DÉTAILS DE L'INTERVENTION :
Numéro       : {intervention.numero}
Client       : {intervention.client.nom}
Téléphone    : {intervention.client.telephone}
Type         : {intervention.type_service}
Urgence      : {intervention.urgence.upper()}
Description  : {intervention.description}
Date planifiée : {
    intervention.date_planifiee.strftime(
        '%d/%m/%Y %H:%M')
    if intervention.date_planifiee
    else 'Non planifiée'
}

Merci de prendre en charge cette intervention.

Cordialement,
Media Telecom
        """

        email = EmailMessage(
            subject=sujet,
            body=contenu,
            to=[intervention.technicien.user.email]
        )
        email.send()
        return True

    except Exception as e:
        print(f"Erreur envoi email technicien : {e}")
        return False


# ─── EMAIL FACTURE CLIENT ───
def envoyer_facture_client(facture):
    if not facture.intervention.client.email:
        return False

    try:
        from .pdf_generator import generer_facture_pdf

        sujet = (f"Votre facture — {facture.numero}"
                 f" — Media Telecom")

        contenu = f"""
Bonjour {facture.intervention.client.nom},

Veuillez trouver ci-joint votre facture.

RÉCAPITULATIF :
Numéro facture  : {facture.numero}
Intervention    : {facture.intervention.numero}
Total HT        : {float(facture.total_ht):.2f} MAD
TVA (20%)       : {float(facture.total_ttc - facture.total_ht):.2f} MAD
Total TTC       : {float(facture.total_ttc):.2f} MAD

Merci de votre confiance.

Cordialement,
Media Telecom
+212 528 320110
contact.mediatelecom@gmail.com
        """

        pdf_buffer = generer_facture_pdf(facture)

        email = EmailMessage(
            subject=sujet,
            body=contenu,
            to=[facture.intervention.client.email]
        )

        email.attach(
            f"facture_{facture.numero}.pdf",
            pdf_buffer.read(),
            'application/pdf'
        )

        email.send()

        facture.statut = 'envoyee'
        facture.save()

        return True

    except Exception as e:
        print(f"Erreur envoi email client : {e}")
        return False