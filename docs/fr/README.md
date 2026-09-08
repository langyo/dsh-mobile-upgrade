# dsh-mobile-upgrade

[English](../../README.md) | [简体中文](../zh-Hans/README.md) | [繁體中文](../zh-Hant/README.md) | [日本語](../ja/README.md) | [한국어](../ko/README.md) | [Español](../es/README.md) | Français | [Deutsch](../de/README.md) | [Русский](../ru/README.md)

Améliorations mobiles pour le profil web de [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), livrées sous forme d'un plugin unique. Tout est rendu via les slots et signaux d'état de l'hôte lui-même — ni takeover de la mise en page, ni widgets flottants, ni interrogation du DOM de la conversation.

## Ce que vous obtenez

- **Envoi de pièces jointes dans le composer** — un bouton trombone à côté de la rangée d'outils du composer. Les images passent par le chemin natif de pièce jointe collée de l'éditeur ; tout autre fichier est envoyé au serveur et son chemin absolu est collé dans le brouillon pour que l'agent puisse le lire avec ses outils de fichiers.
- **Ligne de redémarrage** — une entrée « Redémarrer le service » dans Paramètres → Général. Demande d'abord confirmation, redémarre le processus `dsh`, puis recharge la page automatiquement dès que le service répond à nouveau.
- **Commutateurs de modalité d'entrée** — cases à cocher text/image/video sur chaque ligne de modèle de l'éditeur de fournisseur natif, écrivant le tableau `input` du modèle dans `settings.yaml` (avec sauvegarde à côté du fichier). Les modèles de catalogue sans route personnalisée affichent les commutateurs en lecture seule.
- **Tiroir pour écrans étroits** — en dessous de 1024px, la barre latérale se réduit en une petite pastille d'angle qui conserve le bouton de l'hôte ; dépliée, la barre complète flotte en tiroir au-dessus du contenu pleine largeur, et choisir une session la referme.
- **Onglets de paramètres sur écran étroit** — en dessous de 700px, la navigation latérale du dialogue de paramètres devient une rangée d'onglets à défilement horizontal.
- **Menu de modèles pleine largeur** — en dessous de 700px, le menu de modèles du composer se ré-ancre exactement à la largeur du téléphone (marges de 12px) au lieu de sortir de l'écran ; le placement vertical au-dessus du déclencheur reste géré par l'hôte.
- **Contournement du panneau de détails** — le panneau d'outils plein écran dont le bouton de fermeture est inerte dans l'hôte actuel n'est pas rendu sur les écrans étroits, il ne peut donc pas bloquer la conversation.
- **Commutateurs par fonction** — le plugin installe une section `mobile-ui-fix` dans Paramètres → Plugins avec un interrupteur par fonction.

## Installation

```sh
dsh plugin --profile web add dsh-mobile-upgrade
```

Redémarrez `dsh web`, puis ouvrez le profil web sur votre téléphone : le trombone se trouve dans le composer, la ligne de redémarrage dans Paramètres → Général, et les interrupteurs dans Paramètres → Plugins → mobile-ui-fix.

Nécessite `dsh` 0.1.2-rc.1 ou plus récent.

## Configuration

La carte de paramètres du plugin accepte :

| Clé | Par défaut | Signification |
|---|---|---|
| `uploadDir` | `<dsh home>/mobile-uploads` | Où sont stockés les envois autres que des images |
| `restartEnabled` | `true` | Proposer la ligne de redémarrage et sa route |

## Commutateurs par fonction

Chaque fonction ci-dessus peut être activée ou désactivée dans Paramètres → Plugins → mobile-ui-fix (effectif au prochain chargement de la page), ou remplacée par appareil avec une clé `localStorage` — `mfx-attach`, `mfx-restart`, `mfx-settle`, `mfx-drawer`, `mfx-settings`, `mfx-modality`, `mfx-menus` — dont la valeur `"0"` désactive la fonction.

## Limitations connues

- Le client s'accroche à des éléments précis de l'interface de l'hôte via leurs noms de classes CSS hachées (menu, bouton du tiroir, éditeur de fournisseur). Si une build de l'hôte les renomme, les fonctions concernées se dégradent jusqu'à ce que ce plugin suive ; tout le reste continue de fonctionner.
- Les commutateurs de modalité d'entrée ne peuvent modifier que les routes de fournisseurs que vous avez personnalisées ; les routes de catalogue seul sont en lecture seule par conception, car fabriquer une section de catalogue fait s'effondrer le répertoire de modèles.

## Notes de sécurité

Les routes HTTP du plugin (envoi, redémarrage, édition des paramètres) n'effectuent aucune authentification propre — elles font confiance à la surface web de `dsh` dans laquelle elles sont chargées. Avant toute exposition au-delà de localhost, placez le déploiement derrière la même barrière que le reste de l'interface (authentification par proxy inverse, écoute en loopback).

## Licence

Distribué sous la [Synthetic Source License (SySL), version 1.0](LICENSE).

> AVIS : Ce logiciel comprend du code généré par une intelligence artificielle. Consultez le fichier LICENSE pour les termes de la Synthetic Source License, y compris les exigences de divulgation des modèles.
