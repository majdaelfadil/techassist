# ─── TRANSITIONS AUTORISÉES ───
TRANSITIONS = {
    'nouveau': ['diagnostique'],
    'diagnostique': ['assigne'],
    'assigne': ['en_cours'],
    'en_cours': ['attente_pieces', 'termine'],
    'attente_pieces': ['en_cours', 'termine'],
    'termine': ['valide'],
    'valide': ['facture'],
    'facture': ['cloture'],
    'cloture': [],
}

# ─── VÉRIFIER SI LA TRANSITION EST AUTORISÉE ───
def transition_autorisee(statut_actuel, nouveau_statut):
    transitions_possibles = TRANSITIONS.get(statut_actuel, [])
    return nouveau_statut in transitions_possibles

# ─── OBTENIR LES TRANSITIONS POSSIBLES ───
def get_transitions_possibles(statut_actuel):
    return TRANSITIONS.get(statut_actuel, [])

# ─── MESSAGES D'ERREUR ───
MESSAGES_ERREUR = {
    'nouveau': 'Cette intervention doit être diagnostiquée',
    'diagnostique': 'Cette intervention doit être assignée',
    'assigne': 'Cette intervention doit être en cours',
    'en_cours': 'Cette intervention doit être terminée',
    'attente_pieces': 'En attente des pièces nécessaires',
    'termine': 'Cette intervention doit être validée',
    'valide': 'Cette intervention doit être facturée',
    'facture': 'Cette intervention doit être clôturée',
    'cloture': 'Cette intervention est déjà clôturée',
}