---
title: "Symfony, reverse proxies and IP protection"
date: 2023-04-12T16:05:00+02:00
draft: false
disable_share: true
tags: ["🇬🇧 english", "jolicode", "tech"]
---

Following an issue encountered on one of my projects, I had to dive into how IP protection works in Symfony applications when at least one reverse proxy is in front of them. After some research, trial and error, I thought it was the perfect opportunity to go back to the basics, then explain how to find the origin of the problem and solve it.

This blog post allows me to explain how client IP forwarding works with reverse proxies, how to use `Forwarded` header (and differences with headers `X-Forwarded-*`).

[Read the article](https://jolicode.com/blog/symfony-reverse-proxies-and-ip-protection) on JoliCode's blog.
