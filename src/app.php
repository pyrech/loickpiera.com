<?php

use Silex\Application;
use Silex\Provider\SwiftmailerServiceProvider;
use Silex\Provider\TwigServiceProvider;
use Silex\Provider\UrlGeneratorServiceProvider;

$app = new Application();

$app->register(new UrlGeneratorServiceProvider());
$app->register(new TwigServiceProvider());
$app->register(new SwiftmailerServiceProvider());

$app['twig'] = $app->share($app->extend('twig', function($twig, $app) {
    $twig->addGlobal('ga_account', $app['ga_account']);
    $twig->addGlobal('age', floor((time()-674085600)/(3600*24*365.25)));
    $twig->addGlobal('copyright', '2013'.(date('Y') > 2013 ? ' - '.date('Y') : ''));

    return $twig;
}));

return $app;
