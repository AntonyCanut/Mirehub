---
description: Realise une evaluation de vulnerabilites de securite
---

Scanne le projet pour les problemes de securite :

1. **Dependances** : Verifie les vulnerabilites connues (`npm audit` ou equivalent)
2. **Secrets** : Recherche les cles API, mots de passe, tokens codes en dur
3. **Injection** : Verifie les risques d'injection SQL, XSS, injection de commandes
4. **Authentification** : Verifie la logique d'auth et la gestion des sessions
5. **Configuration** : Verifie les parametres par defaut insecures (CORS, CSP, etc.)

Produis un rapport de securite avec niveaux de severite (CRITIQUE/HAUTE/MOYENNE/BASSE) et etapes de remediation.
