# KindlePress — Privacy Policy

_Last updated: 28 October 2026_

## The short version

KindlePress collects nothing, sends nothing, and stores nothing about you.

There is no server, no account, and no analytics. The extension has no backend
to send anything to, which is why this policy is short.

## What the extension does with the page you are reading

When you click the KindlePress icon, it reads the article in the tab you are on
and builds an EPUB file from it, entirely inside your browser. That file is then
saved to your downloads folder.

The article text, the images, and the address of the page never leave your
computer. They are not transmitted to the developer or to any third party.

## Network requests

The extension makes exactly one kind of network request: it downloads the images
that appear in the article you asked it to convert, directly from the servers
that already host them, so they can be embedded in your EPUB. Your browser would
make those same requests to display the page.

No request is ever made to a server operated by the developer, because there
isn't one.

## Permissions, and why each exists

| Permission | Why |
|---|---|
| `activeTab` | Read the article from the tab you are on, only at the moment you click the icon. This is used deliberately instead of host permissions, so the extension never has standing access to any site you visit. |
| `scripting` | Inject the extraction script into that tab on that click. |
| `downloads` | Save the EPUB to your downloads folder. |

The extension does not request access to your browsing history, your bookmarks,
your cookies, or any website other than the one tab you explicitly act on.

## Storage

The extension stores no data, locally or remotely. It does not use cookies.

## Third parties

None. No analytics, no error reporting, no advertising, no trackers.

Article extraction uses Mozilla's Readability library, which is bundled inside
the extension and runs locally. It is not a service and makes no network calls.

## Amazon

When you choose "Open Send to Kindle", the extension opens Amazon's own upload
page in a new tab. Anything you do there is between you and Amazon, under
Amazon's privacy policy. KindlePress sends nothing to Amazon on your behalf.

## Changes

If this policy ever changes, the updated version will be published at this same
address with a new date at the top.

## Contact

Questions about this policy can be sent to the developer through the Chrome Web
Store listing's support link.
