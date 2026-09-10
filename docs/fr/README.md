# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | [Español](../es/README.md) | Français | [Deutsch](../de/README.md) | [Русский](../ru/README.md)

Améliorations mobiles pour le profil web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), livrées sous forme d'un plugin unique. Tout est rendu via les slots et signaux d'état de l'hôte lui-même — ni takeover de la mise en page, ni widgets flottants, ni interrogation du DOM de la conversation.

## Ce que vous obtenez

- **Envoi de pièces jointes dans le composer** — un bouton trombone à côté de la rangée d'outils du composer. Les images passent par le chemin natif de pièce jointe collée de l'éditeur ; tout autre fichier est envoyé au serveur et son chemin absolu est collé dans le brouillon pour que l'agent puisse le lire avec ses outils de fichiers.
- **Ligne de redémarrage** — une entrée « Redémarrer le service » dans Paramètres → Général. Demande d'abord confirmation, redémarre le processus `dsh`, puis recharge la page automatiquement dès que le service répond à nouveau.
- **Commutateurs de modalité d'entrée** — cases à cocher text/image/video sur chaque ligne de modèle de l'éditeur de fournisseur natif, écrivant le tableau `input` du modèle dans `settings.yaml` (avec sauvegarde à côté du fichier). Les modèles de catalogue sans route personnalisée affichent les commutateurs en lecture seule.
- **Tiroir pour écrans étroits** — en dessous de 1024px, la barre latérale se réduit en une petite pastille d'angle qui conserve le bouton de l'hôte ; dépliée, la barre complète flotte en tiroir au-dessus du contenu pleine largeur, et choisir une session la referme. La pastille et le tiroir permutent de façon atomique (aucune animation de géométrie susceptible de se figer lorsque le thread principal est occupé), et un appui qui ferme le tiroir le replie dans cette même frame au lieu d'attendre le nouveau rendu de l'hôte — de sorte qu'un téléphone faisant tourner de nombreuses sessions ne peut pas laisser le tiroir coincé à moitié déplié, et la pastille fermée ne reste jamais blanche au-dessus d'un rail que l'hôte a déjà vidé.
- **Onglets de paramètres sur écran étroit** — en dessous de 700px, la navigation latérale du dialogue de paramètres devient une rangée d'onglets à défilement horizontal.
- **Menu de modèles pleine largeur** — en dessous de 700px, le menu de modèles du composer se ré-ancre exactement à la largeur du téléphone (marges de 12px) au lieu de sortir de l'écran ; le placement vertical au-dessus du déclencheur reste géré par l'hôte.
- **Carte de question défilable** — en dessous de 1024px, une question en attente ne peut plus enterrer ses propres choix : la question est plafonnée en hauteur dans sa propre zone de défilement, de sorte qu'une question longue défile sur place tandis que la liste d'options en dessous conserve la place qui reste et que les options, la rangée d'envoi et les boutons de réduction et de fermeture restent à l'écran et accessibles. Une question courte reste intacte, et la carte épouse toujours son contenu.
- **Contournement du panneau de détails** — le panneau d'outils plein écran dont le bouton de fermeture est inerte dans l'hôte actuel n'est pas rendu sur les écrans étroits, il ne peut donc pas bloquer la conversation.
- **Commutateurs par fonction** — le plugin installe une section `dsh-mobile-upgrade` dans Paramètres → Plugins avec un interrupteur par fonction.

## Captures d'écran

La pastille flottante, le tiroir de sessions, les onglets de paramètres sur écran étroit et le bouton de pièces jointes du composer (annotés) :

| | |
|---|---|
| ![Pastille flottante](../../res/shot-floating-chip.png) | ![Tiroir de sessions](../../res/shot-drawer.png) |
| ![Onglets de paramètres](../../res/shot-settings-tabs.png) | ![Pièces jointes](../../res/shot-composer-attach.png) |

## Installation

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Redémarrez `dsh web`, puis ouvrez le profil web sur votre téléphone : le trombone se trouve dans le composer, la ligne de redémarrage dans Paramètres → Général, et les interrupteurs dans Paramètres → Plugins → dsh-mobile-upgrade.

Nécessite `dsh` 0.1.2-rc.1 ou plus récent.

## Configuration

La carte de paramètres du plugin accepte :

| Clé | Par défaut | Signification |
|---|---|---|
| `uploadDir` | `<dsh home>/mobile-uploads` | Où sont stockés les envois autres que des images |
| `restartEnabled` | `true` | Proposer la ligne de redémarrage et sa route |

## Commutateurs par fonction

Chaque fonction ci-dessus peut être activée ou désactivée dans Paramètres → Plugins → dsh-mobile-upgrade (effectif au prochain chargement de la page), ou remplacée par appareil avec une clé `localStorage` — `mfx-attach`, `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus`, `mfx-questions` — dont la valeur `"0"` désactive la fonction.

## Limitations connues

- Le client s'accroche à des éléments précis de l'interface de l'hôte via leurs noms de classes CSS hachées (menu, bouton du tiroir, éditeur de fournisseur). Si une build de l'hôte les renomme, les fonctions concernées se dégradent jusqu'à ce que ce plugin suive ; tout le reste continue de fonctionner. La région de la carte de question est en revanche repérée via le point d'accroche `data-question-key` propre à la carte, de sorte qu'une build de l'hôte qui se contente de recalculer le hachage de ses modules CSS la maintient fonctionnelle.
- Les commutateurs de modalité d'entrée ne peuvent modifier que les routes de fournisseurs que vous avez personnalisées ; les routes de catalogue seul sont en lecture seule par conception, car fabriquer une section de catalogue fait s'effondrer le répertoire de modèles.

## Notes de sécurité

Les routes HTTP du plugin (envoi, redémarrage, édition des paramètres) n'effectuent aucune authentification propre — elles font confiance à la surface web de `dsh` dans laquelle elles sont chargées. Avant toute exposition au-delà de localhost, placez le déploiement derrière la même barrière que le reste de l'interface (authentification par proxy inverse, écoute en loopback).

## Liens communautaires

- [Linux.Do](https://linux.do) — Une communauté pour partager et discuter de technologie.

## Licence

Distribué sous la [Synthetic Source License (SySL), version 1.0](LICENSE).

> AVIS : Ce logiciel comprend du code généré par une intelligence artificielle. Consultez le fichier LICENSE pour les termes de la Synthetic Source License, y compris les exigences de divulgation des modèles.
