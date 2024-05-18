---
title: "Symfony, reverse proxies et protection par IP"
locale: fr
slug: symfony-reverse-proxies-et-protection-par-ip
date: 2023-04-07T10:42:00+02:00
draft: false
disable_share: true
tags: ["jolicode", "tech"]
---

Suite à un souci rencontré sur un de mes projets, j’ai dû me plonger dans le fonctionnement de la protection par IP dans nos applicatifs Symfony lorsque des reverse proxies se trouvent devant. Après quelques recherches et tâtonnements, je me suis dit que c’était l’occasion parfaite pour reprendre les bases, puis expliquer comment trouver l’origine du problème et le résoudre.

Cet article est donc l'occasion d'expliquer la transmission de l'IP originale de l'utilisateur dans une stack web ainsi que de présenter le fonctionnement du header `Forwarded` (et les différences avec les headers `X-Forwarded-*`).

[Lire l'article complet](https://jolicode.com/blog/symfony-reverse-proxies-et-protection-par-ip) sur le blog de JoliCode.
