from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Paragraph,
                                 Spacer, Table, TableStyle, Image)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from io import BytesIO
import os

# ─── COULEURS MEDIA TELECOM ───
ORANGE = colors.HexColor('#FF8C00')
NOIR = colors.HexColor('#1A1A1A')
GRIS = colors.HexColor('#666666')
GRIS_CLAIR = colors.HexColor('#F5F5F5')
BLANC = colors.white

# ─── CHEMIN DU LOGO ───
LOGO_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    'static', 'logo.png'
)

def generer_facture_pdf(facture):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=1.5*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    elements = []

    # ─── STYLES ───
    style_titre = ParagraphStyle(
        'titre',
        parent=styles['Normal'],
        fontSize=22,
        fontName='Helvetica-Bold',
        textColor=ORANGE,
        alignment=TA_LEFT,
        spaceAfter=2
    )

    style_sous_titre = ParagraphStyle(
        'sous_titre',
        parent=styles['Normal'],
        fontSize=9,
        textColor=GRIS,
        alignment=TA_LEFT,
        spaceAfter=2,
        spaceBefore=6
    )

    style_normal = ParagraphStyle(
        'normal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=NOIR,
        spaceAfter=4
    )

    style_bold = ParagraphStyle(
        'bold',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica-Bold',
        textColor=NOIR,
        spaceAfter=6
    )

    style_section = ParagraphStyle(
        'section',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica-Bold',
        textColor=BLANC,
        spaceAfter=6
    )

    style_total = ParagraphStyle(
        'total',
        parent=styles['Normal'],
        fontSize=12,
        fontName='Helvetica-Bold',
        textColor=BLANC,
        alignment=TA_RIGHT
    )

    # ─── HEADER ───
    # Logo + Infos entreprise côte à côte
    header_data = [[]]

    # Logo
    if os.path.exists(LOGO_PATH):
        logo = Image(LOGO_PATH, width=5*cm, height=2.5*cm)
        header_left = logo
    else:
        header_left = Paragraph(
            "<b>Media Telecom</b>", style_titre)

    # Infos entreprise à droite
    infos_entreprise = [
        Paragraph("<b>Media Telecom</b>", style_titre),
        Paragraph(
            "Votre partenaire des nouvelles technologies",
            style_sous_titre),
        Paragraph("📍 N° 02 rue ennakhil dakhla, Agadir 80060", style_sous_titre),
        Paragraph("📞 +212 528 320110", style_sous_titre),
        Paragraph("✉ contact.mediatelecom@gmail.com",
                  style_sous_titre),
    ]

    header_table = Table(
        [[header_left, infos_entreprise]],
        colWidths=[6*cm, 11*cm]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.3*cm))

    # ─── BANDE ORANGE ───
    bande = Table(
        [[Paragraph(
            f"  FACTURE N° {facture.numero}",
            style_section)]],
        colWidths=[17*cm],
        rowHeights=[1*cm]
    )
    bande.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ORANGE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    elements.append(bande)
    elements.append(Spacer(1, 0.5*cm))

    # ─── INFOS FACTURE + CLIENT ───
    date_emission = facture.date_emission.strftime('%d/%m/%Y')
    client = facture.intervention.client

    infos_facture = [
        [Paragraph('<b>Date d\'émission</b>', style_bold),
         Paragraph(date_emission, style_normal)],
        [Paragraph('<b>Statut</b>', style_bold),
         Paragraph(facture.statut.upper(), style_normal)],
        [Paragraph('<b>N° Intervention</b>', style_bold),
         Paragraph(facture.intervention.numero, style_normal)],
    ]

    infos_client = [
        [Paragraph('<b>Client</b>', style_bold),
         Paragraph(client.nom, style_normal)],
        [Paragraph('<b>Téléphone</b>', style_bold),
         Paragraph(client.telephone, style_normal)],
        [Paragraph('<b>Email</b>', style_bold),
         Paragraph(client.email or 'N/A', style_normal)],
        [Paragraph('<b>Adresse</b>', style_bold),
         Paragraph(client.adresse or 'N/A', style_normal)],
    ]

    table_facture = Table(infos_facture,
                          colWidths=[4*cm, 4.5*cm])
    table_facture.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), GRIS_CLAIR),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#DDDDDD')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))

    table_client = Table(infos_client,
                         colWidths=[3.5*cm, 4.5*cm])
    table_client.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), GRIS_CLAIR),
        ('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#DDDDDD')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))

    deux_colonnes = Table(
        [[table_facture, Spacer(1, 0.5*cm), table_client]],
        colWidths=[8.5*cm, 0.5*cm, 8*cm]
    )
    elements.append(deux_colonnes)
    elements.append(Spacer(1, 0.5*cm))

    # ─── DÉTAILS INTERVENTION ───
    bande_intervention = Table(
        [[Paragraph("  DÉTAILS INTERVENTION", style_section)]],
        colWidths=[17*cm],
        rowHeights=[0.8*cm]
    )
    bande_intervention.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ORANGE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    elements.append(bande_intervention)
    elements.append(Spacer(1, 0.3*cm))

    intervention = facture.intervention
    intervention_data = [
        [Paragraph('<b>Type de service</b>', style_bold),
         Paragraph(intervention.type_service, style_normal)],
        [Paragraph('<b>Description</b>', style_bold),
         Paragraph(intervention.description[:150],
                   style_normal)],
        [Paragraph('<b>Technicien</b>', style_bold),
         Paragraph(
             intervention.technicien.nom
             if intervention.technicien else 'N/A',
             style_normal)],
        [Paragraph('<b>Canal</b>', style_bold),
         Paragraph(intervention.canal_entree, style_normal)],
    ]

    table_intervention = Table(intervention_data,
                                colWidths=[4*cm, 13*cm])
    table_intervention.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.3,
         colors.HexColor('#DDDDDD')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,0), (-1,-1),
         [BLANC, GRIS_CLAIR]),
    ]))
    elements.append(table_intervention)
    elements.append(Spacer(1, 0.5*cm))

    # ─── PIÈCES UTILISÉES ───
    pieces = intervention.pieces_utilisees.all()
    if pieces:
        bande_pieces = Table(
            [[Paragraph("  PIÈCES UTILISÉES", style_section)]],
            colWidths=[17*cm],
            rowHeights=[0.8*cm]
        )
        bande_pieces.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), ORANGE),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(bande_pieces)
        elements.append(Spacer(1, 0.3*cm))

        pieces_data = [['Pièce', 'Référence', 'Qté',
                         'Prix unitaire', 'Sous-total']]
        for p in pieces:
            pieces_data.append([
                p.piece.nom,
                p.piece.reference,
                str(p.quantite),
                f"{float(p.prix_unitaire):.2f} MAD",
                f"{float(p.quantite * p.prix_unitaire):.2f} MAD"
            ])

        table_pieces = Table(
            pieces_data,
            colWidths=[5*cm, 3*cm, 2*cm, 3.5*cm, 3.5*cm]
        )
        table_pieces.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), NOIR),
            ('TEXTCOLOR', (0,0), (-1,0), BLANC),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('GRID', (0,0), (-1,-1), 0.3,
             colors.HexColor('#DDDDDD')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1),
             [BLANC, GRIS_CLAIR]),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ]))
        elements.append(table_pieces)
        elements.append(Spacer(1, 0.5*cm))

    # ─── TABLEAU MONTANTS ───
    bande_montants = Table(
        [[Paragraph("  RÉCAPITULATIF FINANCIER",
                    style_section)]],
        colWidths=[17*cm],
        rowHeights=[0.8*cm]
    )
    bande_montants.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ORANGE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    elements.append(bande_montants)
    elements.append(Spacer(1, 0.3*cm))

    tva_montant = float(facture.total_ttc) - float(facture.total_ht)
    montants_data = [
        ['Main d\'oeuvre',
         f"{float(facture.montant_main_oeuvre):.2f} MAD"],
        ['Pièces de rechange',
         f"{float(facture.montant_pieces):.2f} MAD"],
        ['Déplacement',
         f"{float(facture.montant_deplacement):.2f} MAD"],
        ['Total HT',
         f"{float(facture.total_ht):.2f} MAD"],
        [f'TVA ({facture.tva}%)',
         f"{tva_montant:.2f} MAD"],
    ]

    table_montants = Table(montants_data,
                           colWidths=[13*cm, 4*cm])
    table_montants.setStyle(TableStyle([
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('GRID', (0,0), (-1,-1), 0.3,
         colors.HexColor('#DDDDDD')),
        ('ROWBACKGROUNDS', (0,0), (-1,-1),
         [BLANC, GRIS_CLAIR]),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(table_montants)

    # ─── TOTAL TTC ───
    total_table = Table(
        [[Paragraph(
            f"TOTAL TTC : {float(facture.total_ttc):.2f} MAD",
            style_total)]],
        colWidths=[17*cm],
        rowHeights=[1.2*cm]
    )
    total_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ORANGE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('RIGHTPADDING', (0,0), (-1,-1), 15),
    ]))
    elements.append(total_table)
    elements.append(Spacer(1, 1*cm))

    # ─── SIGNATURE ET CACHET ───
    signature_data = [
        [Paragraph('<b>Signature Client</b>', style_bold),
         Paragraph('<b>Cachet & Signature</b>', style_bold)],
        [Paragraph('', style_normal),
         Paragraph('Media Telecom', style_normal)],
        [Spacer(1, 2*cm), Spacer(1, 2*cm)],
        [Paragraph('____________________', style_normal),
         Paragraph('____________________', style_normal)],
    ]

    table_signature = Table(signature_data,
                            colWidths=[8.5*cm, 8.5*cm])
    table_signature.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (0,-1), 0.5,
         colors.HexColor('#DDDDDD')),
        ('BOX', (1,0), (1,-1), 0.5,
         colors.HexColor('#DDDDDD')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(table_signature)
    elements.append(Spacer(1, 0.5*cm))

    # ─── PIED DE PAGE ───
    pied = Table(
        [[Paragraph(
            "Media Telecom — Votre partenaire des nouvelles technologies — Agadir, Maroc",
            ParagraphStyle('pied', parent=styles['Normal'],
                          fontSize=8, textColor=GRIS,
                          alignment=TA_CENTER)
        )]],
        colWidths=[17*cm]
    )
    pied.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1, ORANGE),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(pied)

    # ─── GÉNÉRER PDF ───
    doc.build(elements)
    buffer.seek(0)
    return buffer