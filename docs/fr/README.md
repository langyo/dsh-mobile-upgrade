# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | [Español](../es/README.md) | Français | [Deutsch](../de/README.md) | [Русский](../ru/README.md)

Améliorations mobiles pour le profil web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), livrées sous forme d'un plugin unique. Presque tout est rendu via les slots et signaux d'état de l'hôte lui-même — ni takeover de la mise en page, ni interrogation du DOM de la conversation. Quelques overlays sont volontairement en DOM pur à position fixe — la puce/carte de connexion en bas à gauche, la bannière d'auto-mise à jour, le toast partagé : ils doivent rester vivants précisément quand l'arbre React de l'hôte est gelé.

## Ce que vous obtenez

- **Ligne de redémarrage** — une entrée « Redémarrer le service » dans Paramètres → Général. Demande d'abord confirmation, redémarre le processus `dsh`, puis recharge la page automatiquement dès que le service répond à nouveau.
- **Carte de question défilable** — en dessous de 1024px, une question en attente ne peut plus enterrer ses propres choix : la question est plafonnée en hauteur dans sa propre zone de défilement, de sorte qu'une question longue défile sur place tandis que la liste d'options en dessous conserve la place qui reste et que les options, la rangée d'envoi et les boutons de réduction et de fermeture restent à l'écran et accessibles. Une question courte reste intacte, et la carte épouse toujours son contenu.
- **Réactivité à l'épreuve des rafales** — l'observateur de tout le document de la carte de question et le sondeur des paramètres réagissent à une rafale de messages en streaming à un débit plafonné et passent en repli tant que l'hôte est injoignable : de nombreuses sessions en streaming simultané ne figent plus la saisie ni n'alentissent la page, et la barre latérale reste l'affaire du propre agencement étroit de l'hôte.
- **Garde du catalogue de sous-agents** — l'hôte sert le catalogue de sous-agents en énumérant tout le corpus de sessions à chaque requête (~1s sur un long historique), et son client demande à chaque sélection, survol de pastille et événement d'appartenance. Le plugin enveloppe ce rafraîchissement : un parent sans enfants dans la liste de sessions vivante n'est jamais interrogé, un parent est réinterrogé au plus une fois toutes les 2,5s, et les départs de rafraîchissement sont espacés — une distribution en sous-agents n'affame plus l'hôte avec des balayages complets du corpus.
- **Pastilles de lignée ouvrables au clic** — sur ordinateur, les pastilles de sous-agents (« N subagents » et le sélecteur de titre de sous-agents) ne s'ouvrent au survol que dans l'hôte actuel ; un clic ne fait rien. Le plugin traduit un clic sur une pastille en la paire d'événements de survol que l'hôte comprend déjà, de sorte que cliquer ouvre et ferme l'arbre (les fils d'Ariane des ancêtres gardent leur navigation au clic).
- **Collecteur d'en-tête sur écran étroit** — en dessous de 1024px, les pastilles de l'en-tête de session (lignée, tâches, préréglage) sont plus larges que le téléphone et uniquement au survol. Elles se replient en une seule pilule (`≡ titre · N agents · M jobs`) ; la toucher ouvre une feuille pleine largeur avec la lignée de la session (chaque ancêtre touchable, chacun avec son nombre de descendants), l'arbre de sous-agents enraciné à la racine de la famille — les lignes sont rendues depuis la liste de sessions vivante, les branches récupèrent leur catalogue à la demande via le rafraîchissement gardé — et les tâches en arrière-plan de cette session. Sur ordinateur, rien ne change.
- **Auto-mise à jour** — le bundle client est servi immuable par révision, donc un onglet de téléphone peut tourner des jours sur une build plus ancienne. La page compare la révision avec laquelle elle a démarré à celle que le serveur publie maintenant et se recharge elle-même une fois la page inactive (jamais pendant la saisie d'un brouillon), ou propose une bannière tactile.
- **Lissage du rendu de la liste des sessions** — l'hôte pousse un frame à valeur complète pour chaque changement de projection de chaque session attachée, et la vue de minutage d'un sous-agent en cours change à chaque événement validé : une flotte occupée en arrière-plan diffuse donc 50-150 frames/s dans la page. Chaque frame redessinait toute la liste des sessions (chaque reconstruction parcourt tous les résumés plus un balayage de cache en O(n²) — mesuré comme la majorité du temps du thread principal, gelant la page jusqu'au rechargement). Le plugin regroupe ces redessins sur un intervalle final adaptatif tandis que les valeurs continuent d'alimenter les stores par session sans changement — le streaming en arrière-plan ne gèle plus la page, sur n'importe quelle session, neuve ou ancienne.
- **Carte de connexion** — le contrôle de connexion en bas à gauche de l'hôte ne montre aucune réaction au clic : la reconnexion demandée replonge dans le même transport engorgé, l'avis de rétablissement est un div non cliquable qui disparaît au bout d'un compte à rebours, et la barre latérale étroite (rail/tiroir) ne le rend même pas. Ce plugin ancre l'état avec une puce en DOM pur dans ce coin (vivante même quand l'arbre React de l'hôte est gelé) et fait surgir au-dessus une carte semi-persistante : elle reste tant que le pointeur est à l'intérieur, s'escamote sinon, et porte les deux actions qui marchent vraiment — une reconnexion immédiate via le service de connexion et un rafraîchissement manuel complet de la page. Les requêtes `/api/` bloquées ou en échec apparaissent au même endroit : un badge avec compteur sur la puce, et dans la carte une liste de requêtes plus une sonde de vivacité — aussi nombreuses soient les requêtes qui pendent ou échouent, plus aucun avertissement ne s'affiche à côté des contrôles du composer.
- **Commutateurs par fonction** — le plugin installe une section `dsh-mobile-upgrade` dans Paramètres → Plugins avec un interrupteur par fonction.

## Captures d'écran

Les onglets de paramètres sur écran étroit et le collecteur d'en-tête (annotés) :

| | |
|---|---|
| ![Onglets de paramètres](../../res/shot-settings-tabs.png) | ![Collecteur d'en-tête](../../res/shot-header-collector.png) |

## Installation

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Redémarrez `dsh web`, puis ouvrez le profil web sur votre téléphone : la ligne de redémarrage se trouve dans Paramètres → Général et les interrupteurs dans Paramètres → Plugins → dsh-mobile-upgrade. Les pièces jointes viennent du système d'attachement natif du composer de l'hôte.

Nécessite `dsh` 0.2.0-rc.2 ou plus récent (le système d'attachement intégré de l'hôte remplace la fonction d'envoi de ce plugin). L'hôte fournit désormais lui-même le volet écran étroit — un tiroir dont les boutons d'ouverture occupent les deux coins supérieurs du chrome de fenêtre —, si bien que ce plugin ne touche plus à la barre latérale : sa propre prise en contrôle du tiroir et son bouton flottant ont été retirés plutôt que de continuer à se battre avec l'implémentation native ; restent les améliorations ci-dessous.

## Configuration

La carte de paramètres du plugin liste un interrupteur par fonction (voir « Commutateurs par fonction ») ; `restartEnabled` contrôle aussi la route de redémarrage :

| Clé | Par défaut | Signification |
|---|---|---|
| `restartEnabled` | `true` | Proposer la ligne de redémarrage et sa route |

## Commutateurs par fonction

Chaque fonction ci-dessus peut être activée ou désactivée dans Paramètres → Plugins → dsh-mobile-upgrade (effectif au prochain chargement de la page), ou remplacée par appareil avec une clé `localStorage` — `mfx-restart`, `mfx-net`, `mfx-questions`, `mfx-selfupdate`, `mfx-agents`, `mfx-header`, `mfx-listthrottle`, `mfx-conn` — dont la valeur `"0"` désactive la fonction. La clé `mfx-drawer` du tiroir retiré et sa position de glissement mémorisée par appareil (`mfx-chip-side` / `mfx-chip-top`) ne sont plus lues ; les supprimer reste facultatif.

## Limitations connues

- Le client s'accroche à l'interface de l'hôte via des contrats `data-*` publiés — le `data-question-key` de la carte de question et le siège `data-slot` du collecteur d'en-tête — et, là où l'hôte ne publie pas d'attribut, via la partie locale d'un nom de classe de module CSS (`_crumbs`, `_tabs`, `_headingBlock`). Les points d'accroche orientés barre latérale qu'utilisait le tiroir retiré (`data-sidebar-*`, `data-rightbar-col`, `data-shortcut-modal`, `_sidebarCol`) ont disparu avec lui. Tous survivent à une reconstruction : le hachage devant le nom local est la seule chose qu'une reconstruction change. Si une build de l'hôte renomme les contrats restants, les fonctions concernées se dégradent jusqu'à ce que ce plugin suive ; tout le reste continue de fonctionner.
- Le collecteur d'en-tête et le shim de clic de lignée s'appuient sur les données propres de l'hôte (la liste de sessions vivante et ses catalogues de sous-agents) ; ils n'ajoutent aucune requête au-delà des récupérations de branches gardées, et un appui sur une ligne dont le mode est encore en chargement se complète de lui-même dès que ce catalogue arrive.
- Les commutateurs de modalité d'entrée ne peuvent modifier que les routes de fournisseurs que vous avez personnalisées ; les routes de catalogue seul sont en lecture seule par conception, car fabriquer une section de catalogue fait s'effondrer le répertoire de modèles.

## Notes de sécurité

Les routes HTTP du plugin (redémarrage, édition des paramètres) n'effectuent aucune authentification propre — elles font confiance à la surface web de `dsh` dans laquelle elles sont chargées. Avant toute exposition au-delà de localhost, placez le déploiement derrière la même barrière que le reste de l'interface (authentification par proxy inverse, écoute en loopback).

## Liens communautaires

- [Linux.Do](https://linux.do) — Une communauté pour partager et discuter de technologie.

## Licence

Distribué sous la [Synthetic Source License (SySL), version 1.0](LICENSE).

> AVIS : Ce logiciel comprend du code généré par une intelligence artificielle. Consultez le fichier LICENSE pour les termes de la Synthetic Source License, y compris les exigences de divulgation des modèles.
