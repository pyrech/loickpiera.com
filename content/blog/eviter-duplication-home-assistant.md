---
title: "Éviter la duplication dans Home Assistant"
date: 2024-05-06T23:00:00+02:00
draft: false
disable_share: false
tags: ["🇫🇷 français", "home-assistant", "domotique"]
featured_image: /images/cover-home-assistant.png
images:
- /images/cover-home-assistant.png
---

Depuis plusieurs années, j'utilise [Home Assistant](https://www.home-assistant.io/)
(HA) pour gérer la domotique et les différents appareils connectés chez moi. Ce
logiciel, open source et qui tourne en local, permet d'automatiser énormément de
choses. Je me suis dit qu'il était temps de partager quelques astuces et
configurations que j'ai pu mettre en place au fur et à mesure.

Dans ce premier article, je vous montre comment j'évite de dupliquer certains
comportements dans mes automatisations.

## Envoyer une notification sur mon téléphone

L'une des toutes premières automatisations que j'ai pu faire dans HA a été la
création d'une "alarme" qui me notifie lorsque l'une de mes portes ou fenêtres
était ouverte alors que je ne suis pas chez moi.

Voici ce que ça donne en YAML une version simplifiée :

```yaml
alias: Trigger alarm when intrusion detected
description: ""
mode: single
trigger:
  - entity_id: binary_sensor.entree_porte_contact
    from: "off"
    platform: state
    to: "on"
  - entity_id: binary_sensor.salon_fenetre_contact
    from: "off"
    platform: state
    to: "on"
  # ...
condition:
  - condition: state
    entity_id: input_boolean.alarm_armed
    state: "on"
action:
  # ...
  - service: notify.mobile_app_{identifiant_de_mon_super_telephone}
    data:
      message: L'une des portes a été ouverte !
      title: Intrusion détectée !
      data:
        ttl: 0
        priority: high
  # ...
```

Pour expliquer rapidement ce bout de code, si l'un des triggers est positif
(c'est-à-dire si une des portes est ouverte), et si la condition est positive
(c'est-à-dire que l'alarme est activée), alors qu'on exécute les actions
définies.

Ici, l'action montrée permet [d'envoyer une notification à mon smartphone](https://www.home-assistant.io/integrations/notify/#companion-app-notifications)
qui possède l'application mobile de HA. Le service appelé est donc `notify.mobile_app_{identifiant_de_super_telephone}`.
En plus de cela, j'ai pris l'habitude de marquer la notification comme étant
importante (`priority: high`) et avec une durée de vie infinie (`ttl: 0`) pour
être certain qu'elle soit délivrée instantanément.

Cette action s'est ensuite retrouvée dupliquée dans plusieurs de mes
automatisations.

Sauf que cela me pose problèmes pour deux raisons :
- Si je change de téléphone, je dois repasser sur toutes mes automatisations
pour mettre à jour l'identifiant du service de notification ;
- Je dois aussi penser à passer les paramètres `ttl` et `priority`.

Mes réflexes de développeur m'ont donc poussé à vouloir factoriser cette
logique pour éviter la duplication. Et pour cela, rien de mieux que de mettre
en place un [script](https://www.home-assistant.io/integrations/script/).

## Créer un script pour éviter la duplication

Dans HA, un script est un ensemble de séquences que l'on va ensuite pouvoir
appeler dans des automations ou encore d'autres scripts. Un script peut
recevoir des paramètres, mais également renvoyer un résultat.

```yaml
alias: Notifier Loïck
sequence:
  - service: notify.mobile_app_{identifiant_de_mon_super_telephone}
    data:
      message: "{{ message }}"
      title: "{{ title }}"
      data:
        ttl: 0
        priority: high
        
mode: parallel
icon: mdi:message-badge

fields:
  
  titre:
    selector:
      text:
        multiline: false
        multiple: false
    name: Titre
    required: false
    description: Le titre de la notification
    default: HA

  message:
    selector:
      text:
        multiple: false
        multiline: true
    name: Message
    required: true
    description: Le message de la notification
```

Ici, mon script déclare deux champs : `titre` et `message`. Le premier est
optionnel, avec une valeur par défaut à `HA`, le second est obligatoire.
En configurant le `selector` et la `description`, cela permet à HA d'afficher
les widgets qui vont bien dans l'interface graphique.

Exemple quand on appelle le script depuis les outils de développement :

{{< figure src="/images/blog/home-assistant-duplication/ha-outil-developpement-script.jpg" title="Le rendu de notre script dans les outils de dev de Home Assistant" alt="Le rendu de notre script dans les outils de dev de Home Assistant">}}

Si je reprends mon exemple d'automation précédent, voici ce qu'elle devient :

```yaml
alias: Trigger alarm when intrusion detected
# ...
# Seules les actions ont changé
action:
  # ...
  - service: script.notifier_loick
    data:
      message: L'une des portes a été ouverte !
      title: Intrusion détectée !
  # ...
```

Dès maintenant, si je change de téléphone, si je veux changer la destination ou
encore si je veux modifier le type de notification, je n'aurais plus qu'à
modifier uniquement le script et toutes les automatisations continueront de
fonctionner.

## TextToSpeech sur une enceinte

Deuxième exemple pour lequel j'ai utilisé un script au lieu de dupliquer des
actions dans plusieurs automatisations : la lecture d'un message sur mon
enceinte. Un exemple d'action dans une automation :

```yaml
action:
  - service: tts.speak
    data:
      cache: false
      media_player_entity_id: media_player.enceinte
      message: "{{ message }}"
      language: fr
    target:
      entity_id: tts.elevenlabs_tts
```

Pour le moment, j'utilise [ElevenLabs](https://elevenlabs.io/) pour le
TextToSpeech (TTS) au lieu du traditionnel TTS de Google, car je n'en peux plus
de cette voie robotisée qu'on entend partout. Celles de ElevenLabs sont bien
plus naturelles et agréables à écouter.

De plus, le plan gratuit d'ElevenLabs autorise 10,000 caractères par mois, ce
qui est largement suffisant, sachant qu'en plus, il est possible de conserver
en cache les messages audio dans le cas où les messages à prononcer sont
récurrents (`cache: true`).

Bref, tout ça pour dire que j'ai créé un script pour factoriser cette action :

```yaml
alias: TTS
sequence:
  - data:
      cache: false
      media_player_entity_id: media_player.enceinte
      message: "{{ message }}"
      language: fr
    service: tts.speak
    target:
      entity_id: tts.elevenlabs_tts
mode: queued
icon: mdi:message-badge
fields:
  message:
    selector:
      text:
        multiple: false
        multiline: true
    name: Message
    required: true
    description: Le message de la notification
max: 10
```

Ici, qu'un seul champ en entrée, le `message` à prononcer. Et voici comment
s'utilise le script dans une automation :

```yaml
action:
  - service: script.tts
    data:
      message: "Ceci est un message prononcé par une machine"
```

Pour aller plus loin, on pourrait ajouter plus de "fields", pour permettre de
changer, s'il y a besoin, l'enceinte sur laquelle lire le message, ou encore la
langue, etc.

Mais surtout, le jour où je me motive à faire tourner un service TTS en local
plutôt que de dépendre d'un service externe, vous connaissez la musique : je
n'aurai plus qu'à modifier que le script pour que toutes les automatisations
en bénéficient.

## Conclusion

En résumé, si vous vous retrouvez à dupliquer des actions dans plusieurs
automatisations, pensez à créer un script. Cela vous permettra de factoriser
votre code, de le rendre plus lisible et plus facile à tester.
