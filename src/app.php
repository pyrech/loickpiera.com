<?php

use Silex\Application;
use Silex\Provider\HttpFragmentServiceProvider;
use Silex\Provider\RoutingServiceProvider;
use Silex\Provider\ServiceControllerServiceProvider;
use Silex\Provider\SwiftmailerServiceProvider;
use Silex\Provider\TwigServiceProvider;
use Silex\Provider\ValidatorServiceProvider;

$app = new Application();

$app->register(new RoutingServiceProvider());
$app->register(new ValidatorServiceProvider());
$app->register(new ServiceControllerServiceProvider());
$app->register(new TwigServiceProvider());
$app->register(new HttpFragmentServiceProvider());
$app->register(new SwiftmailerServiceProvider());

$app['twig'] = $app->extend('twig', function($twig, $app) {
    $twig->addGlobal('ga_account', $app['ga_account']);
    $twig->addGlobal('age', floor((time()-674085600)/(3600*24*365.25)));
    $twig->addGlobal('copyright', '2013'.(date('Y') > 2013 ? ' - '.date('Y') : ''));

    $twig->addFunction(new \Twig_SimpleFunction('asset', function ($asset) use ($app) {
        $versionParameter = $app['asset_version'];
        $asset .= (false === strpos($asset, '?') ? '?' : '&').$versionParameter;
        return $app['request_stack']->getMasterRequest()->getBasepath().'/'.ltrim($asset, '/');
    }));

    return $twig;
});

return $app;
