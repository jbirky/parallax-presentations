# Plugins

Plugins add elements that other people made: plots, simulations, diagrams. Each one comes from a public GitHub repo, and an admin reviews every version before it's listed. Browse them in the [plugin gallery](https://parallax-presentations.com/plugins), where each runs live on its own page, or from the editor.

## Installing one

In the editor, open **Insert** in the toolbar and, under **Plugins**, choose **Browse plugins…** (or **Tools › Plugins › Browse plugins…**). Under **Browse**, search or scroll, and choose **Install**. On a plugin's page in the gallery, **Install in Parallax** does the same, signing you in first if you need to.

An installed plugin's elements are under **Plugins** in the toolbar's **Insert** menu, in every presentation. Installing is for your account; it doesn't change anyone else's menu.

## Using a plugin's element

Insert it from **Insert › Plugins**, then move and resize it like any other element. To use it on the canvas, select it first: a plugin's element takes clicks and hovers only while it's selected. Most plugins keep their settings inside the element, such as a settings button in a corner.

With the element selected, the properties panel shows which plugin it is, its version, and a link to its page in the gallery.

A plugin's element looks and works the same when you present, share a link or export. It can read the deck's datasets; see [Live Datasets](./live-datasets.md#datasets-in-html-p5-and-plugin-elements).

## Versions and updates

An element keeps the version of its plugin that it was inserted with, so a new version never changes a deck you've already made.

When a newer version is listed, the editor says so above the canvas, and the properties panel offers it too. **Update to** moves every element of that plugin in the deck to the new version. Their settings stay, and **Undo** reverses it. **Not now** hides the offer until you open the deck again.

If a version is withdrawn, its elements show "This plugin isn't available", and the editor offers a version that can be used instead.

## Uninstalling

In **Browse plugins…**, choose **Installed** on the plugin. It leaves **Insert › Plugins**. Its elements already in decks still draw, for you and for everyone who opens those decks: a deck shows its plugins whether or not the person viewing it installed them.

## What a plugin can reach

A plugin runs in a sandbox. It can't see your account, the rest of the deck or the page around it. It sees its own element's settings and, when it asks, the deck's datasets.

It can reach only the websites its page in the gallery lists under **Reaches**. Most plugins reach none, and work offline and in exported decks.

## Publishing your own

See [Writing Plugins](./writing-plugins.md).
