<?php

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

$app->get('/', function () use ($app) {
    return $app['twig']->render('home.html', array(
        'seo' => array(
            'title' => 'Loïck Piera',
            'description' => 'Développeur web PHP / Symfony',
        ),
        'menu_active' => 'home',
        'greet' => (intval(date('H')) >= 19 || intval(date('H')) <= 3) ? 'Bonsoir' : 'Bonjour',
    ));
})
->bind('home');

$app->get('/a-propos', function () use ($app) {
    return $app['twig']->render('about.html', array(
        'seo' => array(
            'title' => 'A propos | Loïck Piera',
            'description' => 'A propos de moi et de ce site | Loïck Piera',
        ),
        'menu_active' => 'about',
    ));
})
->bind('about');

$app->match('/contact', function (Request $request) use ($app) {
    $submitted = false;
    $sent = false;
    $values = array(
        'name' => '',
        'email' => '',
        'subject' => '',
        'message' => '',
    );
    $errors = array();
    if ($request->request->has('form-contact')) {
        $values = $request->request->get('form');
        $submitted = true;
        if (!array_key_exists('name', $values) || strlen($values['name']) < 1) {
            $errors['name'] = true;
        }
        if (!array_key_exists('email', $values) || !filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = true;
        }
        if (!array_key_exists('subject', $values) || strlen($values['subject']) < 1) {
            $errors['subject'] = true;
        }
        if (!array_key_exists('message', $values) || strlen($values['message']) < 1) {
            $errors['message'] = true;
        }

        if (count($errors) < 1) {
            $body = "New message sent from loickpiera.com by ".$values['name']."\r\n"
                   ."====================================\r\n"
                   .$values['message'];

            $message = \Swift_Message::newInstance()
                ->setSubject('[loickpiera.com] '.$values['subject'])
                ->setFrom(array($app['contact.from']))
                ->setTo(array($app['contact.to']))
                ->setBody($body)
            ;

            $app['mailer']->send($message);
            $app['swiftmailer.spooltransport']
                ->getSpool()
                ->flushQueue($app['swiftmailer.transport'])
            ;

            $sent = true;
        }
    }

    return $app['twig']->render('contact.html', array(
        'seo' => array(
            'title' => 'Contact | Loïck Piera',
            'description' => 'Contactez moi',
        ),
        'menu_active' => 'contact',
        'submitted' => $submitted,
        'sent' => $sent,
        'errors' => $errors,
        'values' => $values,
    ));
})
->method('GET|POST')
->bind('contact');

$app->error(function (\Exception $e, Request $request, $code) use ($app) {
    if ($app['debug']) {
        return;
    }

    // 404.html, or 4xx.html, or 500.html, or 5xx.html, or default.html
    $templates = array(
        'errors/'.$code.'.html',
        'errors/'.substr($code, 0, 2).'x.html',
        'errors/'.substr($code, 0, 1).'xx.html',
        'errors/default.html',
    );

    return new Response($app['twig']->resolveTemplate($templates)->render(array('code' => $code)), $code);
});
