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

## Cycle de vie du CTO Mode

Le CTO Mode a un cycle de vie different des tickets standard — il est **continu** :
- **INTERDIT** : Claude ne peut PAS passer un ticket CTO en `DONE` (bloque par le MCP)
- Claude remet le status a `TODO` en fin de session pour permettre la prochaine iteration
- Claude met a jour `result` avec un bilan de session pour la continuite entre sessions
- Status `PENDING` si Claude a besoin de precisions de l'utilisateur
- Status `FAILED` seulement en cas d'erreur bloquante
- Pour arreter le CTO Mode : l'utilisateur desactive ou supprime le ticket manuellement

## Liaison de tickets

Les sous-tickets crees par le CTO sont lies au ticket CTO parent :
- `kanban_create` accepte un parametre `parentTicketId` pour la liaison
- Le ticket parent stocke la liste de ses enfants dans `childTicketIds`
- Les sous-tickets stockent l'ID du parent dans `parentTicketId`
- A chaque nouvelle session CTO, Claude consulte les sous-tickets existants via `kanban_list`

## Ce que fait Claude en CTO

1. Consulter les sous-tickets existants via `kanban_list` (continuite entre sessions)
2. Scanner les projets du workspace avec `project_scan_info`
3. Lire les fichiers importants (README, package.json, CLAUDE.md)
4. Identifier 3-5 axes d'amelioration (en tenant compte de ce qui a deja ete traite)
5. Creer des sous-tickets lies via `kanban_create` avec `parentTicketId`
6. Implementer les ameliorations rapides si possible
7. Commiter apres chaque amelioration
8. Remettre le ticket CTO en `TODO` avec un bilan dans `result`

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

**Kanban** :
- `kanban_create` : Creer des sous-tickets (avec `parentTicketId` pour la liaison)
- `kanban_list` : Lister les tickets existants (inclut `parentTicketId`, `childTicketIds`, `isCtoTicket`)
- `kanban_get` : Obtenir le detail d'un ticket
- `kanban_update` : Mettre a jour un ticket (DONE interdit pour tickets CTO)

**Projets** :
- `project_list` : Lister les projets du workspace
- `project_scan_info` : Scanner un projet pour ses infos
- `workspace_info` : Obtenir les infos du workspace
- `project_setup_claude_rules` : Configurer CLAUDE.md et .claude/settings.json

**Analyse** :
- `analysis_detect_tools` : Detecter les outils d'analyse installes
- `analysis_run` : Lancer une analyse de code
- `analysis_list_reports` : Lister les rapports existants
- `analysis_create_tickets` : Creer des tickets depuis les resultats d'analyse

## Label CTO

Le label `cto` est protege :
- Il n'apparait pas dans les formulaires de creation/edition
- Il ne peut pas etre ajoute/retire manuellement depuis le detail panel
- Il est automatiquement assigne lors de la creation d'un ticket CTO
- Il reste visible sur les cartes et dans les filtres
