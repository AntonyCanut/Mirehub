# CTO Mode

## Vue d'ensemble

Le CTO Mode est un type special de ticket Kanban qui transforme Claude en CTO faisant de l'amelioration continue. Quand un ticket CTO est envoye a Claude, il analyse le projet, identifie les axes d'amelioration, cree des sous-tickets via MCP, implemente les ameliorations et commite apres chaque feature.

## Utilisation

1. Cliquer sur le bouton **CTO Mode** dans le header du Kanban (a cote de "+ Nouvelle tache")
2. Un ticket CTO est automatiquement cree avec le label `cto` et la priorite `high`
3. Le ticket est envoye a Claude automatiquement s'il n'y a pas de ticket WORKING
4. Un seul ticket CTO actif (WORKING ou TODO) est autorise a la fois

## Identification visuelle

### Carte Kanban
- **Effet shimmer** : gradient anime avec des couleurs mauve/rose/bleu/teal
- **En mode WORKING** : halo mauve pulsant en plus du shimmer
- **Label `cto`** : chip rose/mauve distinctif

### Sidebar
- Le tag dans la sidebar affiche **CTO MODE** au lieu de **WORKING**
- Style gradient mauve-rose distinctif

## Arret du CTO Mode

Le CTO Mode suit le workflow standard des tickets :
- Claude change le status a `DONE` quand il a termine
- Status `PENDING` si Claude a besoin de precisions
- Status `FAILED` si Claude ne peut pas realiser la tache
- La sidebar revient a l'etat idle quand le ticket est termine

## Ce que fait Claude en CTO

1. Scanner les projets du workspace avec `project_scan_info`
2. Lire les fichiers importants (README, package.json, CLAUDE.md)
3. Identifier 3-5 axes d'amelioration
4. Creer un sous-ticket pour chaque axe via `kanban_create`
5. Implementer les ameliorations une par une
6. Commiter apres chaque amelioration
7. Marquer le ticket comme DONE avec un resume

## Tickets desactives

Les tickets peuvent etre desactives via le menu contextuel (clic droit > Desactiver).

Un ticket desactive :
- Apparait en grise (opacity 45%, grayscale 40%)
- Ne peut pas etre drag-and-drop
- N'est pas selectionne par l'auto-scheduling (`pickNextTask`)
- N'est pas envoye a Claude (`sendToClaude` guard)

Pour reactiver : clic droit > Reactiver.

## Endpoints MCP

### Outils utilises par le CTO Mode
- `kanban_create` : Creer des sous-tickets
- `kanban_list` : Lister les tickets existants
- `kanban_update` : Mettre a jour le status des tickets
- `project_list` : Lister les projets du workspace
- `project_scan_info` : Scanner un projet pour ses infos
- `workspace_info` : Obtenir les infos du workspace
- `project_setup_claude_rules` : Configurer CLAUDE.md et .claude/settings.json

## Label CTO

Le label `cto` est protege :
- Il n'apparait pas dans les formulaires de creation/edition
- Il ne peut pas etre ajoute/retire manuellement depuis le detail panel
- Il est automatiquement assigne lors de la creation d'un ticket CTO
- Il reste visible sur les cartes et dans les filtres
