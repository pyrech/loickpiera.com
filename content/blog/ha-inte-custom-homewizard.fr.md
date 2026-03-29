---
title: "Intégrer les données d'une application Android dans Home Assistant"
description: "Dans cet article, je retrace les différentes étapes qui m’ont permis de créer mon intégration Home Assistant homewizard_cloud_watermeter"
locale: fr
slug: integrer-les-donnees-d-une-application-android-dans-home-assistant
date: 2026-03-29T20:00:00+02:00
draft: false
disable_share: false
tags: [ "retro-ingénierie", "home-assistant", "domotique" ]
featured_image: /images/blog/ha-custom-inte/cover.png
images:
    - /images/blog/ha-custom-inte/cover.png
---

Dans cet article, je retrace les différentes étapes qui m’ont permis de créer
mon intégration Home Assistant [homewizard_cloud_watermeter](https://github.com/pyrech/homewizard_cloud_watermeter).

## Introduction

J’ai acheté il y a plusieurs mois un [Watermeter de HomeWizard](https://www.homewizard.com/fr-be/compteur-deau-wi-fi/).
Ce dispositif WiFi permet de reporter la consommation d’eau pour l’intégrer dans
ma domotique Home-Assistant. Ce produit est intéressant pour plusieurs raisons :

- il est compatible avec la plupart des compteurs d’eau que l’on trouve dans nos 
contrées européennes ;
- il peut être alimenté au choix via des piles ou par USB ;
- les données sont stockées au choix sur le cloud de l’entreprise HomeWizard ou
disponibles via une API locale.

Je tiens à souligner la mentalité géniale de la société : déjà, proposer une API
locale sur ses appareils, c’est peu courant. Mais en plus de ça, c’est un
développeur de l'entreprise qui maintient l’intégration officielle et native
dans Home Assistant pour connecter tous ses appareils HomeWizard dans son HA.

Mais il y a évidemment un hic, sinon, je ne ferai pas cet article 😇.

## Les limites du Watermeter

En effet, dans mon cas, mon compteur d’eau est situé dans les parties communes 
et je n’ai pas de prise disponible à proximité de mon compteur. Quand il est 
alimenté avec des piles (2x CR123A), HomeWizard indique que le capteur peut 
tenir environ un an.
J’ai fait quelques calculs rapides et j’ai donc mis en place une batterie de 
10 Ah pour alimenter le capteur en espérant être tranquille pour un bon moment.

Verdict : la batterie a tenu TROIS jours 🥹.

La raison ? L’appareil possède en fait deux modes de fonctionnement. Quand il
est alimenté via l’USB, le Watermeter expose la consommation d’eau en temps réel
via l’API locale. Cela implique donc d’avoir un serveur HTTP actif et d’être
connecté en WiFi en permanence, ce qui vide la batterie à vitesse grand V.

En revanche, quand il est alimenté via des piles, le Watermeter ne propose pas
d’API locale et ne reporte la consommation d’eau que 4 fois par jour au cloud
de HomeWizard.
Même s’il suit la consommation en temps réel, il ne la remonte donc pas en temps
réel sur le cloud. Ce n’est pas parfait, mais ça a le mérite de diminuer
drastiquement la consommation de l’appareil.

Mais qui dit pas d’API locale, dit que l’intégration officielle pour Home
Assistant ne peut pas se connecter au capteur. De plus, HomeWizard ne propose
malheureusement pas d’API publique pour son cloud, il va donc falloir bidouiller
autrement !
Et on va commencer par jeter un œil à l’application Android de HomeWizard.

## Analyser le trafic réseau de l’application

Si l’application est capable de récupérer les données depuis le cloud et 
d’afficher la consommation, alors on doit pouvoir faire de même, n’est-ce pas ?
Essayons d’espionner l’application pour découvrir comment elle fonctionne, et
surtout, observer les requêtes HTTP qu’elle fait.

{{< figure src="/images/blog/ha-custom-inte/apercu-application-android.png" title="Configuration du proxy dans l’émulateur" alt="Configuration du proxy dans l’émulateur">}}

Mais comme nous allons le voir, le chemin pour y arriver est loin d’être trivial,
car Android et les applications modernes mettent en place plusieurs couches de
protection contre l’interception TLS.

### Mise en place d’un proxy HTTP

Ma première tentative a été un peu naïve. J’ai voulu mettre en place un proxy
“[Man In The Middle](https://fr.wikipedia.org/wiki/Attaque_de_l%27homme_du_milieu)"
en m’inspirant de [cet article de présentation de mitmproxy](https://jolicode.com/blog/arretez-de-deviner-interceptez-vos-flux-http-s-avec-mitmproxy)
écrit par mon collègue Grégoire Pineau.

Comme son nom l’indique, un proxy MITM se place sur le réseau entre le client et
un serveur/internet et a donc accès à tout le trafic réseau qui passe par lui :

```
Android App
↓
Proxy HTTP configuré dans Android
↓
mitmproxy
↓
Internet
```

Pour cela, je démarre une instance de `mitmweb` sur mon ordinateur
(`mitmweb --web-port 9999 --listen-port 8888 --set web_host=0.0.0.0`) et je 
rajoute un proxy dans la configuration réseau de mon téléphone Android qui 
pointe sur l’IP de mon ordinateur et le port 8888. Et à partir de là, je peux 
observer le trafic réseau du téléphone dans l’interface web de `mitmproxy`, à 
l’adresse `http://127.0.0.1:9999/#/flows`. Sauf… que non.

De nos jours, tous les échanges HTTP se font (ou en tout cas, devraient se faire)
en HTTPS. Le trafic est donc la plupart du temps chiffré et il n’est pas
possible en l’état d’observer les requêtes et réponses HTTP. 
Pour citer mon collègue :

> `mitmproxy` n’est pas un simple passe-plat. Pour pouvoir nous montrer le
> contenu chiffré, il doit le déchiffrer. Pour ce faire, il « termine » la
> connexion SSL en se faisant passer pour le serveur final, puis initie une
> nouvelle requête vers le vrai serveur.

C'est donc normal que cela échoue : tout le principe de la sécurité de HTTPS,
c'est justement que le client HTTP puisse vérifier que le certificat TLS qu'il
reçoit par le "serveur" — auquel il se connecte — est légitime. Si le client
détecte un souci, il refusera la connexion et n'enverra pas la moindre donnée.
Et c'est ce qui se passe ici. Dans les logs de `mitmproxy`, on voit plein
d'occurrences de ce genre :

```
[14:18:44.616][192.168.0.23:60816] client connect
[14:18:44.616][192.168.0.23:60816] server connect 142.250.75.234:443
[14:18:44.662][192.168.0.23:60816] Client TLS handshake failed. The client does
not trust the proxy's certificate for firebaseinstallations.googleapis.com
(OpenSSL Error([('SSL routines', '', 'ssl/tls alert certificate unknown')]))
[14:18:44.665][192.168.0.23:60816] client disconnect
[14:18:44.666][192.168.0.23:60816] server disconnect 142.250.75.234:443
```

Il nous faut donc trouver un moyen de faire croire à notre application qu’elle
peut faire confiance à notre proxy et ses faux certificats.

### Mise en place d’un émulateur Android

Comme je vais avoir besoin de bricoler l’application et/ou d’installer
manuellement des certificats dans le système, j’ai choisi d'installer
[Android Studio](https://developer.android.com/studio) afin de pouvoir faire mes
manipulations directement dans un émulateur Android plutôt que sur mon téléphone.

On va également avoir besoin d'`adb` pour faire des manipulations en ligne de 
commande dans l'appareil virtuel. Donc j'ajoute les tools fournis par le SDK 
dans mon `PATH`:

```shell
export PATH=${PATH}:$HOME/Android/Sdk/platform-tools/
``` 

Sans trop me poser de questions, j'ai ensuite sélectionné une version d'Android 
récente pour avoir un environnement identique à celle de mon téléphone et j'ai 
configuré le proxy de mon host dans la configuration de l'émulateur.

{{< figure src="/images/blog/ha-custom-inte/emulateur-android-proxy.png" title="Configuration du proxy dans l’émulateur" alt="Configuration du proxy dans l’émulateur">}}

Ici, on a juste changé d’environnement, mais on se retrouve dans le même cas de
figure que précédemment : le proxy pourrait intercepter le trafic, mais les
clients HTTP des applications Android refusent toujours de s’y connecter.

### Tentatives d’installation du certificat système

Pour citer encore une fois Grégoire :

> Pour que votre système accepte `mitmproxy` comme une autorité légitime, nous
> devons ajouter son certificat racine (CA) à votre magasin de certificats local.
> Au premier lancement, `mitmproxy` a généré ses certificats dans `~/.mitmproxy/`.

Pour installer les certificats de l’[Autorité de Certification (CA ou AC)](https://fr.wikipedia.org/wiki/Autorit%C3%A9_de_certification) 
de `mitmproxy` dans l’émulateur, j’ai tenté la procédure standard :

```shell
$ adb root
$ adb remount
$ adb push ~/.mitmproxy/mitmproxy.crt /system/etc/security/cacerts/
```

Mais j’avais plein d’erreurs de permission de ce genre :

```
Device must be bootloader unlocked
Read-only file system
Error writing to partition vbmeta
```

Après quelques investigations, il semblerait que les versions récentes d’Android
protègent la partition système. Résultat : même avec adb root, la partition 
`/system` reste read only. Comme le développement mobile n’est pas mon domaine
d’expertise, je me suis beaucoup aidé de Gemini et ChatGPT pour essayer de 
résoudre ce problème. Apparemment, une image en x86_64 avec l’API Android en 
version inférieure à 34 aurait pu aider. J’ai donc testé Android 13 (API 33) — 
qui est la version minimale acceptée par l’application de HomeWizard — mais
j’avais toujours des soucis.

J’ai fini par trouver une solution alternative. Plutôt que d’ajouter une CA 
système, il est possible dans Android, d’ajouter un certificat utilisateur 
directement depuis les paramètres. Dans un premier temps, je _drag & drop_ le 
certificat CA de `mitmproxy` pour qu’il soit disponible dans le dossier
`Downloads` de l’appareil. Ensuite, direction les paramètres Android :

Settings > Security > More security settings > Encryption & credentials > Install a certificate > CA certificate

Et là, je peux sélectionner le certificat de `mitmproxy` dans le dossier `Downloads`.

Voilà, le certificat est installé sur l'appareil. À partir de maintenant, je
commence à voir du trafic HTTPS apparaître dans `mitmproxy`.

{{< figure src="/images/blog/ha-custom-inte/mitmproxy.png" title="Le trafic apparaît dans mitmproxy" alt="Le trafic apparaît dans mitmproxy">}}

On est sorti d’affaire ? Non, pas encore. Quand j’ouvre l’application de 
HomeWizard et que j’essaie de me connecter, j’obtiens cette nouvelle erreur qui
apparaît directement dans l’interface :

{{< figure src="/images/blog/ha-custom-inte/application-certificate-not-trusted.png" title="L’application refuse toujours le certificate custom" alt="L’application refuse toujours le certificate custom">}}

```
java.security.cert.CertPathValidatorException: Trust anchor for certification path not found
```

Cette fois, le problème ne vient plus du système Android, mais de l’application 
elle-même, c'est déjà un progrès, non ? 🥹 Mais que se passe-t-il exactement ?

### Le certificate pinning

Ajouter le certificat du CA dans le système n’est visiblement pas suffisant. En
effet, de nombreuses applications modernes implémentent leur propre logique TLS
et ignorent le “trust store système”. Elles ont plusieurs techniques pour 
réaliser cela :

- bundle de CA hardcodé dans l’app
- `TrustManager` custom embarqué dans l’app
- certificate pinning

Le cas le plus fréquent est le certificate pinning. Il consiste à stocker
l’empreinte du certificat serveur dans l’application, puis vérifier que le
certificat reçu correspond exactement à cette empreinte.
Ainsi, même si le certificat est valide et que la CA est reconnue, la connexion 
va échouer si l’empreinte ne correspond pas. C’est une protection anti-MITM, 
précisément ce qu’on essaie de faire ici.

À ce stade, il reste deux approches : modifier l’application pour faire sauter 
le certificate pinning mais cela nécessite évidemment d’avoir le code source de 
l’application, ce qui n’est pas le cas quand on télécharge une application 
depuis le Play Store.

Deuxième option : injecter du code dans l’application au runtime.

### Injection de code avec Frida

Avant qu’un collègue ne m’en parle, je ne savais pas qu’il existait des softs
prêt à l’emploi pour faire cela. J’ai donc découvert Frida qui permet de
modifier le comportement de l'application en mémoire, sans jamais avoir à 
toucher au fichier .apk en lui-même. C’est à priori la solution la plus utilisée
pour instrumenter une application et bypasser la vérification TLS.

On commence par installer Frida :

```shell
pip install frida-tools
```

Puis, rendez-vous sur les [releases de Frida](https://github.com/frida/frida/releases)
pour télécharger le binaire `frida-server` qui tournera sur notre appareil. Il 
faut donc prendre la bonne version du binaire `frida-server` correspondant à 
notre plateforme (x86_64 dans le cas de l’émulateur qui tourne sur mon
ordinateur) :

```shell
curl -Lso frida-server.xz \
  https://github.com/frida/frida/releases/download/X.Y.Z/frida-server-X.Y.Z-android-x86_64.xz \
  && xz -d frida-server.xz
```

Nous pouvons maintenant exécuter les commandes pour lancer le binaire 
`frida-server` sur l'appareil Android :

```shell
# Envoi du binaire frida-server sur l'appareil
$ adb push frida-server /data/local/tmp/
frida-server: 1 file pushed, 0 skipped. 135.9 MB/s (110754760 bytes in 0.777s)
$ adb shell "chmod 755 /data/local/tmp/frida-server"
# Ouvre un shell sur l'appareil
$ adb shell
# Changement de user pour devenir root
emu64x:/ $ su
# Lancement du frida-server (en arrière plan grâce au &)
emu64x:/ # /data/local/tmp/frida-server &
[1] 8364
```

Maintenant, on ouvre l’application HomeWizard pour qu’elle soit en cours 
d'exécution. Puis, on lance cette commande sur notre ordinateur :

```shell
$ frida-ps -Ua
 PID  Name         Identifier                             
----  -----------  ---------------------------------------
5695  Chrome       com.android.chrome
5106  Files        com.google.android.documentsui
7614  HomeWizard   nl.homewizard.android.energy
…
```

On voit la liste des processus qui tourne — dont celui de notre application —
donc ça y est, le lien avec `frida-server` est établi.

La dernière étape est proche. On va pouvoir demander à Frida d'injecter certains
bouts de code qui vont permettre de faire sauter le certificate-pining. Pour 
cela, Frida bénéficie d'une pléthore de scripts communautaires prêts à l'emploi.
J’ai donc lancé la commande suivante :

```shell
frida --codeshare pcipolloni/universal-android-ssl-pinning-bypass-with-frida \
 --codeshare Q0120S/bypass-ssl-pinning -U -f nl.homewizard.android.energy
```

Le trafic de l’application apparaît désormais dans mitmproxy. Succès !

{{< figure src="/images/blog/ha-custom-inte/mitmproxy-application-trafic.png" title="Le trafic de l’application apparaît dans mitmproxy" alt="Le trafic de l’application apparaît dans mitmproxy">}}

Après plusieurs essais, j’ai choisi deux “codeshare” différents, car 
l’application semble avoir deux stacks HTTP différents et chacune nécessite une
injection différente :

- un client HTTP Java, utilisé notamment pour requêter l’API GraphQL. Pour ça, 
j’utilise le script communautaire `pcipolloni/universal-android-ssl-pinning-bypass-with-frida`
pour neutraliser les bibliothèques Java standard (OkHttp, TrustManager) ;
- une WebView avec du JS qui est utilisée pour afficher le graphique de
consommation. Pour ce cas-là, le script `Q0120S/bypass-ssl-pinning` a suffi 
pour faire marcher le graphique.

> Note : un collègue m’a récemment suggéré de jeter un œil à [HTTP Toolkit](https://httptoolkit.com/)
> qui semble offrir une mise en place bien plus simplifiée que Frida pour faire
> du MITM sur les applications Android. Je n’ai pas encore testé, mais ça
> parais être une bonne alternative à Frida pour les personnes qui ne sont pas à
> l’aise avec la ligne de commande.

À partir de là, il ne nous reste plus qu'à analyser les différents appels
réseaux et comprendre comment récupérer les infos qui nous intéressent. Cela
n’a pas été évident, car l’API GraphQL de HomeWizard est bien configurée et
toutes les options de debug de GraphQL semblent désactivées (donc pas possible
de lister tous les modèles et leurs propriétés). Mais j'ai fini par obtenir tout
ce dont j’ai besoin. 🎉

Maintenant que nous savons comment récupérer les données depuis le cloud
HomeWizard, il est temps de passer à l’étape d’après, qui consiste à injecter
ces données dans Home Assistant.

## Création de l’intégration custom Home Assistant

Pour brancher une source de données dans Home Assistant, le plus simple est de
créer une intégration custom en python. Home Assistant est un projet open source
très mature, avec une architecture solide et des bonnes pratiques bien établies. 
Il existe d’ailleurs une documentation très complète pour aider les développeurs
à créer leurs propres intégrations : https://developers.home-assistant.io/docs/creating_integration_file_structure.

### Structure de l'intégration

Avec l'aide de LLMs et de la documentation officielle, j'ai pu créer ma propre
intégration. Je ne vais pas détailler le code dans cet article, mais le projet
est open source et [disponible sur GitHub](https://github.com/pyrech/homewizard_cloud_watermeter)
si vous souhaitez y jeter un œil.
N’hésitez pas à me faire un retour si vous avez des idées d’amélioration ou si vous souhaitez contribuer !

Voici à quoi ressemble la structure du projet :

```
custom_components/homewizard_cloud_watermeter/
├── __init__.py      # Initialisation de l'intégration
├── api.py           # Classe gérant la communication avec l'api de HomeWizard
├── config_flow.py   # Interface pour la saisie de l'email/mdp et la sélection de la maison à intégrer dans HA
├── const.py         # Constantes (URL, domaines, etc.)
├── coordinator.py   # Gestion de la mise à jour des données et de la synchronisation avec HA
├── sensor.py        # Définition des entités (Consommation d'eau, puissance du signal Wifi du device, niveau de batterie, etc.)
└── manifest.json    # Infos sur l'intégration (lien vers la documentation, type d'intégration, dépendances, etc.)
```

Après pas mal d'essais et de tests, j'ai réussi à faire fonctionner
l'intégration en local sur mon instance de Home Assistant. J'ai pu récupérer
les données de consommation d'eau depuis le cloud de HomeWizard et les injecter
dans HA.

Quand l'intégration est installée, il est possible de créer une nouvelle
configuration en se connectant avec les informations de son compte HomeWizard,
puis en sélectionnant la "maison" enregistrée dans le compte.

{{< figure src="/images/blog/ha-custom-inte/inte-ha-login.png" title="La connexion au compte HomeWizard" alt="La connexion au compte HomeWizard">}}

{{< figure src="/images/blog/ha-custom-inte/inte-ha-details.png" title="La page de détails d'un device" alt="La page de détails d'un device">}}

### Injection dans l'historique et le Dashboard Énergie

Une des complexités de ce projet a été de faire en sorte que les données soient
injectées dans les statistiques à long terme (LTS) de Home Assistant pour
alimenter le Dashboard Énergie. C’est une fonctionnalité très intéressante, car
elle permet d’avoir une vision globale de sa consommation d’eau sur le long
terme, et de faire des analyses plus poussées.

En temps normal, l'historique des entités dans Home Assistant est géré par les
systèmes internes de Home Assistant. Il sait gérer, par exemple, un total de
consommation d'eau qui augmente au fil du temps.

Mais dans notre cas, on ne veut pas incrémenter "bêtement" une valeur de
consommation totale à chaque relevé depuis l'API. Car, rappelez-vous, le
Watermeter ne remonte la consommation d'eau que 4 fois par jour, ce qui ferait
que l'historique côté Home Assistant serait très saccadé.

À la place, on veut injecter la vraie évolution de la consommation d'eau au fil
de la journée. Après quelques tatonnements, j'ai réussi à faire en sorte de 
remonter la consommation directement dans la partie Statistiques à long terme.
Il a été nécessaire de faire quelques ajustements dans le code pour que Home
Assistant puisse reconnaître les données comme une consommation d'eau, de gérer
la récupération des données autour de la fin de journée (pour éviter les 
problèmes de reset à zéro à minuit), etc.

Mais le résultat est là : les données de consommation d'eau sont désormais
disponibles dans l'historique de Home Assistant et peuvent être utilisées 
pour alimenter le Dashboard Énergie :

{{< figure src="/images/blog/ha-custom-inte/dashboard-energie.png" title="La conso d'eau dans le dashboard Énergie de Home Assistant" alt="La conso d'eau dans le dashboard Énergie de Home Assistant">}}

### HACS

Pour installer une intégration qui n'est pas native dans Home Assistant, il
y a généralement deux options :

- installer l'intégration manuellement en copiant les fichiers dans le dossier
`custom_components` de Home Assistant ;
- utiliser [HACS](https://hacs.xyz/) (Home Assistant Community Store) qui est un
store communautaire qui facilite l'installation et la mise à jour d'intégrations
custom dans Home Assistant.

HACS est la solution recommandée pour simplifier la vie des utilisateurs qui
souhaitent installer une intégration custom. J'ai donc [fait ce qu'il fallait](https://hacs.xyz/docs/publish/integration/)
pour que mon intégration soit disponible directement dans HACS.

Avec HACS installé sur votre instance de Home Assistant, vous pouvez facilement
rechercher et installer mon intégration `HomeWizard Cloud Watermeter` 
directement depuis l'interface de HACS.

## Conclusion

Ce projet a été une super expérience de bout en bout, du reverse-engineering de
l'application Android pour comprendre comment récupérer les données, à la 
création d'une intégration custom pour Home Assistant. J'ai appris énormément de
choses sur l'analyse du trafic réseau dans les applications mobiles, les
techniques de bypass de sécurité, et le fonctionnement interne de Home Assistant.

Je suis très content du résultat et j'ai déjà eu des retours d'utilisateurs qui
ont pu utiliser l'intégration et enfin connecter leur Watermeter à Home
Assistant, ce qui n'était pas possible auparavant pour les gens ne pouvant
utiliser l'appareil avec une alimentation USB.

N'hésitez pas à me faire un retour si vous avez des idées d'amélioration de
l'intégration ou si vous souhaitez contribuer au projet !
