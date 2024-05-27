---
title: "Automatiser Home Assistant avec des calendriers"
locale: fr
date: 2024-05-26T19:00:00+02:00
draft: false
disable_share: false
tags: [ "home-assistant", "domotique" ]
featured_image: /images/cover-home-assistant-1.png
images:
    - /images/cover-home-assistant-1.png
---

J’ai récemment mis mon appartement sur Airbnb pour le louer pendant les
périodes où je ne suis pas chez moi. Assez rapidement, ça m’a donné quelques
idées pour adapter le fonctionnement de ma domotique quand le logement est en
mode location, mais également quand il est vacant durant mes congés. Et ce, sans
avoir rien d'autre à faire que tenir mon calendrier à jour comme je le fais déjà.

## Le calendrier local

Dans Home Assistant, il est possible d’utiliser
un [calendrier local](https://www.home-assistant.io/integrations/local_calendar).
C'est très pratique dans mon cas pour, par exemple, désactiver des automations
quand la maison est vide. J'ai donc commencé par créer un calendrier local
nommé "Vacances" dans lequel je saisis un événement chaque fois que je
m'absente de chez moi, pour un weekend ou pour des vacances plus longues.

{{< figure src="/images/blog/calendrier-home-assistant/calendrier-local-ha.png" title="Le calendrier local de Home Assistant" alt="Le calendrier local de Home Assistant">}}

Dans Home Assistant, chaque calendrier est relié à une entité dont l’état est
actif lorsqu'un événement est en cours, et inactif dans le cas contraire. On
aura, dans les attributs de l'entité, plusieurs informations comme le nom, les
dates de début et fin de l'événement (actuel, ou le prochain à venir), etc.

Dans une automation HA, il est possible de
définir [des conditions](https://www.home-assistant.io/docs/automation/condition/),
qui doivent toutes être valides pour que l’automation soit exécutée. Il est donc
facile d’utiliser les calendriers pour "désactiver" une automation en ajoutant
une condition sur l'entité liée au calendrier.

Voici un exemple d'automatisation que j'ai créé et qui me permet d'ouvrir
automatiquement le volet roulant de mon salon à 10h du matin quand je ne suis
pas chez moi, afin que les plantes puissent profiter de la lumière du soleil :

```
alias: "Ouverture volet salon 10h"
description: ""
mode: single
trigger:
  # tous les jours à 10h
  - platform: time
    at: "10:00:00"
condition:
  # seulement si je suis en vacances
  - condition: state
    entity_id: calendar.vacances
    state: "on"
action:
  - service: cover.open_cover
    data: {}
    target:
      device_id: xxxxx
```

Bien sûr, les conditions peuvent être bien plus complexes, imbriquer des `ou`,
etc. Par exemple, pour certaines automations, je combine par exemple les
conditions sur le calendrier vacances, mais aussi sur le calendrier lié aux
réservations Airbnb, pour par exemple désactiver le passage de l’aspirateur
robot pendant mes vacances, mais également si une location est en cours.

En revanche, si vous souhaitez déclencher des automations en fonction
d’événement (pas juste évaluer une condition), il est plutôt conseillé
d’utiliser
les [triggers spécifiques aux calendriers](https://www.home-assistant.io/integrations/calendar#automation),
qui sont bien plus puissants et plus adaptés que l’entité, car cette dernière ne
peut représenter finalement qu’un seul événement à la fois.

## Limites du calendrier local

Le calendrier local est une bonne solution pour commencer à jouer avec des
évènements. Mais même si j’aime bien l’idée d’avoir des données qui restent chez
moi (c'est tout l’intérêt de Home Assistant après tout), je dois reconnaître que
ce calendrier n'est pas très pratique au quotidien. Non seulement parce que j’ai
l’habitude d’utiliser le calendrier Google sur mon téléphone, que mon entreprise
utilise la suite Google, mais aussi puisque pour partager des évènements avec
d’autres personnes, notamment avec ma copine, il est bien plus simple d’utiliser
Google calendar pour cela.

Et comme dupliquer à la main des évènements du calendrier Google dans le
calendrier local de HA, ce n’est pas très marrant, je me suis intéressé à la
possibilité de brancher mes calendriers Google directement dans mon Home
Assistant.

Et bien souvent, quand on cherche à intégrer un service externe dans sa
domotique, Home Assistant a la solution.

## Synchroniser son calendrier Google

La [documentation officielle](https://www.home-assistant.io/integrations/google/)
nous invite à ajouter l’intégration Google Calendar. Celle-ci permet de
synchroniser les différents calendriers rattachés à un compte Google.

La partie la plus compliquée ici est de générer les identifiants sur la Google
Developers Console pour permettre à l’intégration d’interagir avec les APIs de
Google. Heureusement, la documentation de HA est plutôt complète et à jour, et
vous explique toutes les étapes de la procédure.

Astuce : si à un moment, vous ne saisissez pas les bons credentials Google, HA
risque de les garder en mémoire et systématiquement vous rediriger vers Google
avec les mauvais identifiants, sans vous permettre de les corriger. Pour
corriger cela, vous pouvez éditer le
fichier `config/.storage/application_credentials` (par exemple avec une
connexion SSH ou via l’addon Terminal) et supprimer l’entrée dans "data > items"
correspondant à l’item erroné.

Une fois l'intégration fonctionnelle, Home Assistant va synchroniser tous les
calendriers du compte Google à intervalles réguliers (toutes les 15 minutes en
principe). On peut donc maintenant supprimer notre calendrier local dans HA.

## Récupérer uniquement certains évènements

Plusieurs calendriers sont créés par défaut sur Google Calendar (et donc
automatiquement importés) : `Anniversaires`, `Jours fériés et autres fêtes en
France`, `Numéros de semaines` ou évidemment le calendrier par défaut nommé avec
l'adresse email du compte Google en question `xxxx@gmail.com`.

{{< figure src="/images/blog/calendrier-home-assistant/liste-calendriers-google.png" title="Tous les calendriers remontés par l'intégration Google Calendar" alt="Tous les calendriers remontés par l'intégration Google Calendar">}}

N’hésitez pas à désactiver les calendriers inutiles en désactivant les entités
en question pour ne pas charger votre calendrier Home Assistant avec des
événements inutiles.

Enfin, je souhaite ne récupérer que les événements liés à mes vacances, et pas
les autres événements du quotidien qui n’ont rien à voir avec ma domotique. Et
pour faire ça, j’ai choisi de créer un autre calendrier dans mon compte Google,
et toutes mes vacances seront inscrites dans ce calendrier, et pas dans celui
par défaut. Pour cela, il faut aller dans les [paramètres de Google Calendar](https://calendar.google.com/calendar/u/0/r/settings/createcalendar?pli=1),
"Ajouter un agenda" puis "Créer un agenda" (note : je n'ai pas trouvé comment le
faire depuis l'application mobile).

{{< figure src="/images/blog/calendrier-home-assistant/creation-calendrier-google.png" title="Création d'un calendrier Google" alt="Création d'un calendrier Google">}}

Si le calendrier n'apparait pas immédiatement dans Home Assistant, n'hésitez pas
à recharger l'intégration Google Calendar pour forcer la mise à jour.

Tout est désormais bien configuré. Quand vous créerez un événement dans ce 
nouveau calendrier dédié, il sera pris en compte dans votre domotique et vous
permettra d'adapter son fonctionnement pendant les événements où vous serez
absents de chez vous.

Il est maintenant temps de vous montrer comment faire de même avec le calendrier
de location fourni par Airbnb.

## Synchroniser les réservations Airbnb

Premièrement, il faut récupérer les évènements du calendrier de réservation
Airbnb. Pour cela, [Airbnb fournit un lien](https://www.airbnb.fr/help/article/99#section-heading-1-0)
vers un flux `.ics` que l'on peut, ensuite, intégrer facilement à notre compte
Google. Sur Google Calendar, "Autres agendas", puis "+", et enfin "À partir de
l'URL".

Si votre intégration Google Calendar est fonctionnelle, vous n'avez probablement
rien de plus à faire (là encore, vous pouvez recharger l’intégration pour forcer
la mise à jour de tous les calendriers).

Il faut savoir que dans le calendrier fournit par Airbnb, on retrouve (bien
évidemment) les périodes de location par les clients, mais pas seulement. En
effet, Airbnb va également rajouter les périodes où la location n’est pas
possible. Ça peut être les périodes que vous réservez pour vous-même, ou alors
les périodes que vous louez en dehors d'Airbnb (si le bien est disponible sur
plusieurs plateformes de location par exemple). La suite dépend donc de comment
vous gérez votre bien. Pour simplifier, j'imagine deux cas de figure.

Dans le premier cas, j’imagine une résidence secondaire qui serait en location
toute l'année. Dans ce cas, tous les évènements (location airbnb et période
réservée) correspondent à des moments où des convives seront dans la maison.
Cela ne devrait donc pas vraiment changer la logique de vos automations. Vous
pouvez alors utiliser directement le calendrier et l'entité associée dans votre
logique.

Dans le deuxième cas, c'est un peu plus complexe. Je pense notamment à une
résidence principale, comme dans mon cas, dans laquelle vous vivez régulièrement
et qui est parfois louée. Un évènement "location interdite" (nommé `Airbnb (Not available)`
par Airbnb) est donc bien différent d’un événement lié à une réservation Airbnb
(nommé `Reserved`). On va ainsi devoir rajouter une petite surcouche pour
différencier ces 2 types d’événements.

J’ai donc créé, dans Home Assistant, une entrée de type template, dont l'état
dépend du nom de l’événement en cours. Dans Paramètres > Appareils et services >
Entrées > Créer une entrée > Template > Modéliser un capteur binaire, on va
définir le state de cette entrée avec le template suivant :

```
{{ states.calendar.airbnb.attributes.message == 'Reserved' }}
```

Ainsi, on aura notre entité qui sera active quand une location Airbnb est en
cours, et inactive dans le cas contraire. Il ne nous reste plus qu'à utiliser
cette entité à la place de l'entité du calendrier.

## Pour aller plus loin

Parfois, vous pouvez avoir besoin de déclencher de la logique en avance d'une
location. Par exemple, vous pourriez vouloir allumer le chauffage 24h avant
l'arrivée d'un locataire dans votre maison.

Comme je l’ai dis précédemment, dans la partie trigger d’une automation, il vaut
mieux utiliser les déclencheurs dédiés aux calendriers. En l’occurrence, ceux-ci
supportent la notion d’`offset`, justement pour décaler la logique dans le temps.
Voici un exemple correspondant :

```
description: "Démarrer le chauffage avant la location"
mode: single
trigger:
  - platform: calendar
    event: start
    offset: "-24:0:0"
    entity_id: calendar.airbnb
condition: []
action:
  # …
```

## Pour conclure

Dans cet article, je vous ai montré quelques exemples de comment utiliser les
calendriers de Home Assistant au sein de vos automations. Que ce soit via le
calendrier local, ou via Google Calendar, j'espère que cela vous aura donné des
idées pour automatiser encore un peu plus votre logement. N'hésitez d'ailleurs
pas à commenter si c'est le cas 🤗.
