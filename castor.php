<?php

use Castor\Attribute\AsTask;
use Castor\Context;
use Symfony\Component\Process\Process;

use function Castor\context;
use function Castor\exit_code;
use function Castor\log;
use function Castor\io;
use function Castor\run;

const DOCKER_IMAGE_NAME = 'castor-hugo';
const HUGO_VERSION = '0.113.0';

#[AsTask(description: 'Build mkdocs docker image')]
function docker_build(): int
{
    $exit = exit_code(\sprintf(
        'docker build -t %s --build-arg HUGO_VERSION=%s %s',
        DOCKER_IMAGE_NAME,
        HUGO_VERSION,
        __DIR__,
    ));

    if (0 !== $exit) {
        io()->error('Failed to build Docker image');

        return $exit;
    }

    return exit_code(\sprintf(
        'docker tag %s:latest %s:%s',
        DOCKER_IMAGE_NAME,
        DOCKER_IMAGE_NAME,
        HUGO_VERSION,
    ));
}

#[AsTask(description: 'Build site')]
function build(): void
{
    io()->title('Building Hugo site');

    do_run(['hugo', '--gc', '--minify']);
}

#[AsTask(description: 'Serve site and watches for changes')]
function serve(): void
{
    io()->title('Building and watching website');

    do_run(['hugo', 'server']);
}

function do_run(array $runCommand, ?Context $c = null): Process
{
    $process = run(\sprintf(
        'docker image inspect %s:%s',
        DOCKER_IMAGE_NAME,
        HUGO_VERSION,
    ), context: context()->withAllowFailure(true)->withQuiet(true));

    if (false === $process->isSuccessful()) {
        docker_build();
    }

    return docker_run(
        DOCKER_IMAGE_NAME,
        $runCommand,
        volumes: [
            \sprintf('%s:/hugo:cached', realpath(__DIR__)),
        ],
        environment: [
            // For maximum backward compatibility with Hugo modules
            'HUGO_ENVIRONMENT' => 'production',
            'HUGO_ENV' => 'production',
            'TZ' => 'America/Los_Angeles',
        ],
        context: $c
    );
}

function docker_run(string $imageName, array $runCommand, ?string $workDir = null, array $volumes = [], array $environment = [], ?Context $context = null): Process
{
    $context ??= context();

    $command = [
        'docker',
        'run',
        '--init',
        '--rm',
        '-t',
        '--network=host',
    ];

    if (!$context->quiet && false !== $context->tty && false !== $context->pty) {
        $command[] = '-i';
    }

    $userId = posix_geteuid();
    $groupId = posix_getegid();

    if ($userId > 256000) {
        $userId = 1000;
        $groupId = 1000;
    }

    if (0 === $userId) {
        log('Running as root? Fallback to fake user id.', 'warning');
        $userId = 1000;
        $groupId = 1000;
    }

    $command[] = '--user';
    $command[] = \sprintf('%s:%s', $userId, $groupId);

    if (null !== $workDir) {
        $command[] = '-w';
        $command[] = $workDir;
    }

    foreach ($volumes as $volume) {
        $command[] = '-v';
        $command[] = $volume;
    }

    foreach ($environment as $key => $value) {
        $command[] = '-e';
        $command[] = "{$key}={$value}";
    }

    $command[] = $imageName;
    $command = array_merge($command, $runCommand);

    return run($command, context: $context);
}
