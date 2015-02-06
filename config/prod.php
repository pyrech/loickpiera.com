<?php

// configure your app for the production environment

$app['contact.from'] = 'email@domain.com';
$app['contact.to'] = 'email@domain.com';
$app['twig.path'] = array(__DIR__.'/../templates');
$app['twig.options'] = array('cache' => __DIR__.'/../var/cache/twig');
$app['asset_version'] = 2;
