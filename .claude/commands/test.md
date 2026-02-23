---
description: Genere des suites de tests completes
---

$ARGUMENTS contient le fichier ou la fonction cible a tester.

Etapes :
1. Lis le code cible et comprends son comportement
2. Identifie le framework de test utilise (verifie package.json)
3. Ecris des tests couvrant :
   - Cas nominal (utilisation normale)
   - Cas limites (entrees vides, bornes, nulls)
   - Scenarios d'erreur (entrees invalides, echecs reseau)
4. Suis les patterns de test existants dans le projet
5. Lance les tests pour verifier qu'ils passent

Utilise des noms de tests descriptifs qui expliquent CE QUI est teste et le COMPORTEMENT attendu.
