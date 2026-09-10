<?php

use Castor\Attribute\AsTask;
use Castor\Context;
use Symfony\Component\Process\Process;

use function Castor\context;
use function Castor\exit_code;
use function Castor\http_client;
use function Castor\log;
use function Castor\io;
use function Castor\run;

const DOCKER_IMAGE_NAME = 'castor-hugo';
const HUGO_VERSION = '0.113.0';
const JOLICODE_AUTHOR_URL = 'https://jolicode.com/blog/auteur/loick-piera';
const JOLICODE_IGNORED_TAGS = ['conference', 'afup', 'joliday'];

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
    sync_jolicode();

    io()->title('Building Hugo site');

    do_run(['hugo', '--gc', '--minify']);
}

#[AsTask(description: 'Serve site and watches for changes')]
function serve(): void
{
    sync_jolicode();

    io()->title('Building and watching website');

    do_run(['hugo', 'server']);
}

#[AsTask(description: 'Create stub posts for my JoliCode blog articles that are not yet in content/blog')]
function sync_jolicode(): void
{
    io()->title('Syncing JoliCode articles');

    $blogDir = __DIR__ . '/content/blog';

    // Articles already present, keyed by their JoliCode URL
    $known = [];
    foreach (glob($blogDir . '/*.md') as $file) {
        if (preg_match('/^external_url:\s*(\S+)/m', file_get_contents($file), $m)) {
            $known[rtrim($m[1], '/')] = true;
        }
    }

    try {
        $client = http_client();
        $listing = $client->request('GET', JOLICODE_AUTHOR_URL)->getContent();
        preg_match_all('#href="/blog/([a-z0-9-]+)" class="c-stretched-link__target#', $listing, $m);
        $slugs = array_unique($m[1]);

        if (!$slugs) {
            throw new \RuntimeException('No article found on the author page, the HTML structure may have changed');
        }

        $created = 0;
        foreach ($slugs as $slug) {
            $url = 'https://jolicode.com/blog/' . $slug;
            if (isset($known[$url])) {
                continue;
            }

            $page = $client->request('GET', $url)->getContent();
            $meta = function (string $property) use ($page): array {
                preg_match_all(sprintf('#<meta property="%s" content="([^"]*)"#', preg_quote($property, '#')), $page, $mm);

                return array_map(fn (string $v) => html_entity_decode($v, ENT_QUOTES | ENT_HTML5), $mm[1]);
            };

            // Tag slugs (accent-free) rather than the "article:tag" meta labels
            preg_match_all('#href="/blog/tag/([^"]+)"#', $page, $tm);
            $tags = array_unique($tm[1]);
            if (array_intersect($tags, JOLICODE_IGNORED_TAGS)) {
                log(sprintf('Skipping %s (tags: %s)', $slug, implode(', ', $tags)), 'info');
                continue;
            }

            // <html lang> is always "fr" on JoliCode, og:locale carries the real language
            $lang = substr($meta('og:locale')[0] ?? 'fr', 0, 2);
            // FR/EN versions list each other as hreflang alternates: the smallest slug is a stable
            // key on both sides, Hugo pairs the two stubs through translationKey
            preg_match_all('#<link rel="alternate" hreflang="(?:fr|en)" href="https://jolicode.com/blog/([a-z0-9-]+)"#', $page, $am);
            $alternates = $am[1] ?: [$slug];
            sort($alternates);
            $translationKey = $alternates[0];
            $title = $meta('og:title')[0] ?? $slug;
            $description = $meta('og:description')[0] ?? '';
            if ('' !== $description && !preg_match('/[.!?…]$/u', $description)) {
                $description .= '…'; // og:description is cut mid-sentence
            }
            $date = (new \DateTimeImmutable($meta('article:published_time')[0] ?? 'now'))->format(\DATE_ATOM);
            $yaml = fn (string $v) => json_encode($v, \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES);
            $readMore = 'fr' === $lang
                ? sprintf("[Lire l'article complet](%s) sur le blog de JoliCode.", $url)
                : sprintf("[Read the full article](%s) on JoliCode's blog.", $url);

            $file = sprintf('%s/%s%s.md', $blogDir, $slug, 'fr' === $lang ? '' : '.' . $lang);
            file_put_contents($file, <<<MD
            ---
            title: {$yaml($title)}
            description: {$yaml($description)}
            locale: {$lang}
            translationKey: {$translationKey}
            date: {$date}
            draft: false
            disable_share: true
            tags: ["jolicode", "tech"]
            external_url: {$url}
            featured_image: /images/cover-jolicode.png
            ---

            {$description}

            {$readMore}

            MD);
            log(sprintf('Created %s', basename($file)), 'info');
            ++$created;
        }

        io()->success(sprintf('%d new article(s)', $created));
    } catch (\Throwable $e) {
        // The site must still build from the committed stubs when JoliCode is unreachable
        io()->warning(sprintf('Could not sync JoliCode articles: %s', $e->getMessage()));
    }
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
