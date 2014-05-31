<?php

// configure your app for the production environment

$app['ga_account'] = 'UA-36557620-2';
$app['contact.from'] = 'email@domain.com';
$app['contact.to'] = 'email@domain.com';
$app['twig.path'] = array(__DIR__.'/../templates');
$app['twig.options'] = array('cache' => __DIR__.'/../var/cache/twig');