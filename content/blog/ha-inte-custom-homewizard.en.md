---
title: "Integrating Data from an Android Application into Home Assistant"
description: "In this article, I'll walk you through the different steps that allowed me to create my Home Assistant integration homewizard_cloud_watermeter homewizard_cloud_watermeter."
locale: en
slug: integrating-data-from-an-android-application-into-home-assistant
date: 2026-03-29T20:00:00+02:00
draft: false
disable_share: false
tags: [ "reverse-engineering", "home-assistant", "home-automation" ]
featured_image: /images/blog/ha-custom-inte/cover.png
images:
    - /images/blog/ha-custom-inte/cover.png
---

In this article, I'll walk you through the different steps that allowed me to create
my Home Assistant integration [homewizard_cloud_watermeter](https://github.com/pyrech/homewizard_cloud_watermeter).

## Introduction

I purchased a [HomeWizard Watermeter](https://www.homewizard.com/watermeter/)
a few months ago. This WiFi device allows you to track water consumption and
integrate it into your Home Assistant home automation. This product is
interesting for several reasons:

- it's compatible with most water meters found in our European region;
- it can be powered either via batteries or USB;
- data is stored either on HomeWizard's cloud or available via a local API.

I want to highlight the brilliant mentality of the company: first, offering a
local API on their devices is quite uncommon. But on top of that, a developer
from the company maintains the official native integration in Home Assistant to
connect all HomeWizard devices to your HA.

But there's obviously a catch, otherwise I wouldn't be writing this article 😇.

## The Watermeter's Limitations

In my case, my water meter is located in the common areas and I don't have an
outlet available near my meter. When powered with batteries (2x CR123A),
HomeWizard indicates that the sensor can last about a year. I did some quick
calculations and so I set up a 10 Ah battery to power the sensor, hoping to be
worry-free for a while.

Verdict: the battery lasted 3 days 🥹.

Why? The device actually has two operating modes. When powered via USB, the
Watermeter exposes water consumption in real-time via the local API. This means
having an active HTTP server and being connected to WiFi permanently, which
drains the battery at lightning speed.

On the other hand, when powered via batteries, the Watermeter doesn't offer a
local API and only reports water consumption 4 times a day to the HomeWizard
cloud. Even if it tracks consumption in real-time, it doesn't upload it in
real-time to the cloud. It's not perfect, but it does significantly reduce the
device's power consumption.

But no local API means that the official Home Assistant integration can't
connect to the sensor. Plus, HomeWizard unfortunately doesn't offer a public API
for their cloud, so we'll have to get creative! And we're going to start by
taking a look at the HomeWizard Android app.

## Analyzing the Application's Network Traffic

If the application can retrieve data from the cloud and display consumption,
then we should be able to do the same, right? Let's try to spy on the
application to discover how it works, and especially, observe the HTTP requests
it makes.

{{< figure src="/images/blog/ha-custom-inte/apercu-application-android.png" title="Proxy configuration in the emulator" alt="Proxy configuration in the emulator">}}

But as we'll see, the path to getting there is far from straightforward, because
Android and modern applications have several layers of protection against TLS
interception.

### Setting Up an HTTP Proxy

My first attempt was a bit naive. I wanted to set up a "[Man In The Middle](https://en.wikipedia.org/wiki/Man-in-the-middle_attack)"
proxy inspired by [this mitmproxy presentation article](https://jolicode.com/blog/arretez-de-deviner-interceptez-vos-flux-http-s-avec-mitmproxy)
written (in french) by my colleague Grégoire Pineau.

As its name suggests, a MITM proxy sits on the network between the client and a
server/internet and thus has access to all network traffic passing through it:

```
Android App
↓
HTTP Proxy configured in Android
↓
mitmproxy
↓
Internet
```

To do this, I start a `mitmweb` instance on my computer (`mitmweb --web-port 9999 --listen-port 8888 --set web_host=0.0.0.0`)
and I add a proxy in my Android phone's network configuration that points to my
computer's IP and port 8888. From there, I can observe the phone's network
traffic in `mitmproxy`'s web interface, at address `http://127.0.0.1:9999/#/flows`.
Except... nope.

These days, all HTTP exchanges are (or at least should be) done in HTTPS. The
traffic is therefore mostly encrypted and it's not  possible to observe HTTP
requests and responses as-is. To quote my colleague:

> `mitmproxy` is not a simple pass-through. To show us the
> encrypted content, it must decrypt it. To do this, it "terminates" the
> SSL connection by impersonating the final server, then initiates a
> new request to the real server.

It's therefore normal that this fails: the whole principle of HTTPS security is
precisely that the HTTP client can verify that the TLS certificate it receives 
from the "server" - which it connects to - is legitimate. If the client detects
an issue, it will refuse the connection and won't send any data. And that's
what's happening here. In `mitmproxy` logs, we see plenty of occurrences like 
this:

```
[14:18:44.616][192.168.0.23:60816] client connect
[14:18:44.616][192.168.0.23:60816] server connect 142.250.75.234:443
[14:18:44.662][192.168.0.23:60816] Client TLS handshake failed. The client does
not trust the proxy's certificate for firebaseinstallations.googleapis.com
(OpenSSL Error([('SSL routines', '', 'ssl/tls alert certificate unknown')]))
[14:18:44.665][192.168.0.23:60816] client disconnect
[14:18:44.666][192.168.0.23:60816] server disconnect 142.250.75.234:443
```

So we need to find a way to make our application believe it can trust our proxy
and its fake certificates.

### Setting Up an Android Emulator

Since I'll need to tinker with the application and/or manually install
certificates in the system, I chose to install [Android Studio](https://developer.android.com/studio)
so I could do my manipulations directly in an Android emulator rather than on my
phone.

We'll also need `adb` to do command-line manipulations on the virtual device. So
I add the tools provided by the SDK to my `PATH`:

```shell
export PATH=${PATH}:$HOME/Android/Sdk/platform-tools/
```

Without overthinking it, I then selected a recent Android version to have an
environment identical to my phone and configured the proxy of my host in the
emulator's configuration.

{{< figure src="/images/blog/ha-custom-inte/emulateur-android-proxy.png" title="Proxy configuration in the emulator" alt="Proxy configuration in the emulator">}}

Here, we've just changed environments, but we're back in the same situation as
before: the proxy could intercept traffic but Android applications' HTTP clients
still refuse to connect to it.

### Attempts to Install System Certificate

To quote Grégoire once more:

> For your system to accept `mitmproxy` as a legitimate authority, we
> need to add its root certificate (CA) to your local certificate store.
> On first launch, `mitmproxy` generates its certificates in `~/.mitmproxy/`.

To install the [Certificate Authority (CA)](https://en.wikipedia.org/wiki/Certificate_authority)
certificates from `mitmproxy` in the emulator, I attempted the standard
procedure:

```shell
$ adb root
$ adb remount
$ adb push ~/.mitmproxy/mitmproxy.crt /system/etc/security/cacerts/
```

But I got plenty of permission errors like this:

```
Device must be bootloader unlocked
Read-only file system
Error writing to partition vbmeta
```

After some investigation, it appears that recent Android versions protect the
system partition. Result: even with adb root, the `/system` partition remains
read-only. Since mobile development isn't my area of expertise, I relied heavily
on Gemini and ChatGPT to try to solve this problem. Apparently, an x86_64 image
with Android API version lower than 34 might have helped. So I tried Android 13
(API 33) - which is the minimum version accepted by HomeWizard's app - but I
still had issues.

I eventually found an alternative solution. Rather than adding a system CA, it's
possible in Android to add a user certificate directly from settings. First, I
_drag & drop_ the `mitmproxy` CA certificate to make it available in the
device's `Downloads` folder. Then, to Android settings:

Settings > Security > More security settings > Encryption & credentials > Install a certificate > CA certificate

And there, I can select the `mitmproxy` certificate from the `Downloads` folder.

There we go, the certificate is installed on the device. From now on, I start
seeing HTTPS traffic appear in `mitmproxy`.

{{< figure src="/images/blog/ha-custom-inte/mitmproxy.png" title="Traffic appears in mitmproxy" alt="Traffic appears in mitmproxy">}}

Are we out of the woods? Not yet. When I open the HomeWizard app and try to log
in, I get this new error that appears directly in the interface:

{{< figure src="/images/blog/ha-custom-inte/application-certificate-not-trusted.png" title="The app still refuses the custom certificate" alt="The app still refuses the custom certificate">}}

```
java.security.cert.CertPathValidatorException: Trust anchor for certification path not found
```

This time, the problem isn't coming from the Android system but from the
application itself, which is already progress, right? 🥹 But what exactly is
happening?

### Certificate Pinning

Adding the CA certificate to the system isn't apparently enough. Indeed, many
modern applications implement their own TLS logic and ignore the "system trust
store". They have several techniques to achieve this:

- hardcoded CA bundle in the app
- custom `TrustManager` embedded in the app
- certificate pinning

The most common case is certificate pinning. It involves storing the fingerprint
of the server certificate in the application, then verifying that the
certificate received matches this fingerprint exactly. Thus, even if the
certificate is valid and the CA is recognized, the connection will fail if the 
fingerprint doesn't match. It's an anti-MITM protection, exactly what we're
trying to do here.

At this point, there are two approaches left: modify the application to bypass
certificate pinning, but that obviously requires having the source code of the
application, which isn't the case when you download an app from the Play Store.

Second option: inject code into the application at runtime.

### Code Injection with Frida

Before a colleague told me about it, I didn't know there were ready-made tools
to do this. So I discovered Frida, which allows you to modify an application's
behavior in memory, without ever having to touch the .apk file itself. It's
arguably the most common solution to instrument an application and bypass TLS
verification.

Let's start by installing Frida:

```shell
pip install frida-tools
```

Then, head to [Frida releases](https://github.com/frida/frida/releases) to
download the `frida-server` binary that will run on our device. You need to get
the right version of the `frida-server` binary corresponding to your platform
(x86_64 in the case of the emulator running on my computer):

```shell
curl -Lso frida-server.xz \
  https://github.com/frida/frida/releases/download/X.Y.Z/frida-server-X.Y.Z-android-x86_64.xz \
  && xz -d frida-server.xz
```

We can now execute the commands to launch the `frida-server` binary on the
Android device:

```shell
# Send the frida-server binary to the device
$ adb push frida-server /data/local/tmp/
frida-server: 1 file pushed, 0 skipped. 135.9 MB/s (110754760 bytes in 0.777s)
$ adb shell "chmod 755 /data/local/tmp/frida-server"
# Open a shell on the device
$ adb shell
# Change user to become root
emu64x:/ $ su
# Launch frida-server (in the background thanks to &)
emu64x:/ # /data/local/tmp/frida-server &
[1] 8364
```

Now, we open the HomeWizard app to make sure it's running. Then we launch this
command on our computer:

```shell
$ frida-ps -Ua
 PID  Name         Identifier                             
----  -----------  ---------------------------------------
5695  Chrome       com.android.chrome
5106  Files        com.google.android.documentsui
7614  HomeWizard   nl.homewizard.android.energy
…
```

We see the list of running processes – including our application – so there we
go, the connection with `frida-server` is established.

We're getting close to the final step. We can now ask Frida to inject some code
that will allow us to bypass certificate pinning. For this, Frida benefits from
a wealth of ready-made community scripts. So I ran the following command:

```shell
frida --codeshare pcipolloni/universal-android-ssl-pinning-bypass-with-frida \
 --codeshare Q0120S/bypass-ssl-pinning -U -f nl.homewizard.android.energy
```

The application's traffic now appears in mitmproxy. Success!

{{< figure src="/images/blog/ha-custom-inte/mitmproxy-application-trafic.png" title="The app's traffic appears in mitmproxy" alt="The app's traffic appears in mitmproxy">}}

After several attempts, I chose two different "codeshare" scripts because the
application seems to have two different HTTP stacks and each one requires a
different injection:

- a Java HTTP client, used notably to query the GraphQL API. For this, I use the
community script `pcipolloni/universal-android-ssl-pinning-bypass-with-frida` to
neutralize standard Java libraries (OkHttp, TrustManager);
- a WebView with JS that is used to display the consumption graph. For this case,
the `Q0120S/bypass-ssl-pinning` script was enough to get the graph working.

> Note: A colleague recently suggested I take a look at [HTTP Toolkit](https://httptoolkit.com/)
> which seems to offer a much simpler setup than Frida for doing MITM on Android
> applications. I haven't tested it yet, but it seems like a good alternative to
> Frida for people who aren't comfortable with the command line.

From there, all that's left is to analyze the various network calls and
understand how to retrieve the information we need. This wasn't straightforward
because HomeWizard's GraphQL API is well-configured and all GraphQL debugging 
options seem to be disabled (so it's not possible to list all models and their
properties). But I eventually got everything I needed. 🎉

Now that we know how to retrieve data from HomeWizard's cloud, it's time to move
to the next step, which is to inject this data into Home Assistant.

## Creating the Custom Home Assistant Integration

To hook a data source into Home Assistant, the simplest way is to create a
custom integration in Python. Home Assistant is a very mature open source
project with solid architecture and well-established best practices. There's
also very comprehensive documentation to help developers create their own
integrations: https://developers.home-assistant.io/docs/creating_integration_file_structure.

### Integration Structure

With the help of LLMs and official documentation, I was able to create my own
integration. I won't detail the code in this article, but the project is open
source and [available on GitHub](https://github.com/pyrech/homewizard_cloud_watermeter)
if you'd like to take a look. Feel free to reach out if you have improvement ideas or if you'd like to contribute!

Here's what the project structure looks like:

```
custom_components/homewizard_cloud_watermeter/
├── __init__.py      # Integration initialization
├── api.py           # Class managing communication with HomeWizard's API
├── config_flow.py   # Interface for email/password input and home selection
├── const.py         # Constants (URLs, domains, etc.)
├── coordinator.py   # Handling data updates and sync with HA
├── sensor.py        # Entity definition (Water consumption, device WiFi signal strength, battery level, etc.)
└── manifest.json    # Integration info (documentation link, integration type, dependencies, etc.)
```

After quite a few trials and tests, I managed to get the integration working
locally on my Home Assistant instance. I was able to retrieve water consumption
data from HomeWizard's cloud and inject it into HA.

When the integration is installed, it's possible to create a new configuration
by logging in with your HomeWizard account credentials, then selecting the "home"
registered in your account.

{{< figure src="/images/blog/ha-custom-inte/inte-ha-login.png" title="Logging into the HomeWizard account" alt="Logging into the HomeWizard account">}}

{{< figure src="/images/blog/ha-custom-inte/inte-ha-details.png" title="Device details page" alt="Device details page">}}

### Injecting into History and Energy Dashboard

One of the complexities of this project was making sure the data was injected 
into Home Assistant's long-term statistics (LTS) to feed the Energy Dashboard. 
This is a fascinating feature because it allows you to have a global view of
your water consumption over the long term and perform more advanced analysis.

Normally, the history of entities in Home Assistant is managed by Home Assistant's
internal systems. It knows how to handle, for example, total water consumption
that increases over time.

But in our case, we don't want to "blindly" increase the total consumption value
with each API reading. Because, remember, the Watermeter only reports water
consumption 4 times a day, which would mean that the history on Home Assistant's
side would be very choppy.

Instead, we want to inject the true evolution of water consumption throughout
the day. After some trial and error, I managed to get the consumption reported
directly in the long-term statistics section. It was necessary to make some
adjustments to the code for Home Assistant to recognize the data as water
consumption, to handle data retrieval around the end of the day (to avoid the
reset to zero at midnight issues), etc.

But the result is there: water consumption data is now available in Home
Assistant's history and can be used to feed the Energy Dashboard:

{{< figure src="/images/blog/ha-custom-inte/dashboard-energie.png" title="Water consumption in Home Assistant's Energy dashboard" alt="Water consumption in Home Assistant's Energy dashboard">}}

### HACS

To install an integration that's not native to Home Assistant, there are
generally two options:

- install the integration manually by copying files into the `custom_components`
folder of Home Assistant;
- use [HACS](https://hacs.xyz/) (Home Assistant Community Store) which is a
community store that makes it easy to install and update custom integrations in
Home Assistant.

HACS is the recommended solution to make life easier for users who want to
install a custom integration. So I [did what was needed](https://hacs.xyz/docs/publish/integration/)
to make my integration available directly in HACS.

With HACS installed on your Home Assistant instance, you can search for and
install my `HomeWizard Cloud Watermeter` integration directly from HACS's
interface.

## Conclusion

This project was a great end-to-end experience, from reverse-engineering the
Android app to understand how to retrieve data, to creating a custom integration
for Home Assistant. I learned a lot about analyzing network traffic in mobile
applications, security bypass techniques, and the inner workings of Home 
Assistant.

I'm thrilled with the result. I've already received feedback from users who
were able to use the integration and finally connect their Watermeter to Home
Assistant, which wasn't possible before for people who couldn't use the device
with USB power.

Feel free to reach out if you have improvement ideas for the integration or if
you'd like to contribute to the project!

