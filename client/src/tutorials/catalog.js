// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The landing page's Tutorials tab (components/landing/Tutorials.jsx): tasks
// done step by step in the real editor, with a screenshot at each step. More
// detail than the landing page's demos, less than the docs, which they link
// to for the rest.
//
// A step's shot is client/public/tutorials/<slug>/<shot>.webp, and its pins
// are boxes on it, numbered in the order given here and explained beside it.
// scripts/tutorials/capture.py takes the shots in the editor and writes where
// each pin sits (shots.json): change a step there and here together, and run
// it again when the editor changes.
//
// where: the way to the tool, as the editor names each part of it.

export const TUTORIALS = [
  {
    slug: 'first-talk',
    title: 'Your first talk',
    summary: 'Start a presentation in a theme, fill slides from layouts, write math, plan the minutes in the outline, and present with your notes in front of you.',
    minutes: 10,
    badge: 'Start here',
    uses: ['Themes', 'Layouts', 'LaTeX', 'Outline', 'Presenter Mode'],
    cover: 'present',
    steps: [
      {
        shot: 'new-deck',
        title: 'Start a presentation',
        where: ['Dashboard', 'New Presentation'],
        text: 'On your dashboard, click New Presentation. Name the talk and pick a theme. The theme sets the colors, fonts and title styles of every slide, and changing it later redoes none of your work.',
        pins: {
          title: 'The talk’s name, as your dashboard lists it.',
          theme: 'Kourou, one of the themes. Scroll the list for more: some plain, some with fonts and decoration of their own.',
          create: 'Opens the new talk in the editor.',
        },
      },
      {
        shot: 'layouts',
        title: 'Add slides from layouts',
        where: ['Toolbar', 'New slide ▾'],
        text: 'The arrow beside New slide opens the layouts: a title slide, title and content, columns, a big number and more. Each one has placeholders that already follow your theme. Pick one, and the slide goes in after the one you’re on.',
        pins: {
          arrow: 'Opens the layouts.',
          'title-content': 'Title and Content: a title over a bulleted list, the slide most talks are made of.',
          typographic: 'Further down, layouts built on a typographic grid.',
        },
      },
      {
        shot: 'type',
        title: 'Type into the placeholders, math and all',
        where: ['Double-click a placeholder'],
        text: 'Double-click a placeholder and type; Enter starts a new bullet. For math, click ∑ in the text toolbar and type LaTeX. It’s set right in the line, in the text’s own size and color. Press Escape twice when you’re done.',
        pins: {
          box: 'The text box you’re typing in.',
          sigma: 'Math in the line (∑) or on a line of its own (∫), typed as LaTeX.',
          math: 'The math, set with KaTeX. Click it to change it.',
        },
      },
      {
        shot: 'outline',
        title: 'Plan the minutes in the outline',
        where: ['Left panel', 'Outline'],
        text: 'Switch the left panel to Outline and the talk becomes a list of its slides. Give each slide its minutes, and the outline adds them up against the length of the talk. The notes under a slide are yours: they never change it, and they don’t show when you present.',
        pins: {
          tab: 'Switches between the slides and the outline.',
          length: 'How long the talk is. The bar fills as you plan the minutes.',
          minutes: 'The minutes this slide gets.',
          note: 'A note to yourself. Enter adds another, and Tab tucks it under the one above.',
        },
      },
      {
        shot: 'theme',
        title: 'Change the theme whenever you like',
        where: ['Toolbar', 'Theme'],
        text: 'Theme lists the themes beside your slide. Click one and every slide changes with it. Customize colors adjusts the theme’s own colors, and the Text and CSS tabs go further. Save the result under My themes to use it in your next talk.',
        pins: {
          button: 'Opens and closes the themes.',
          custom: 'The page, text and heading colors, changed for this talk.',
          mine: 'Your own themes, saved from a talk you like.',
        },
      },
      {
        shot: 'present',
        title: 'Add speaker notes, then present',
        where: ['Speaker notes, under the slide', 'Present ▾'],
        text: 'Type what you’ll say in the strip under the slide. The arrow beside Present has the ways to give the talk: full screen, Presenter Mode with your notes, Practice Talk to time a rehearsal, and Live Present, a link the audience can follow on their own screens.',
        pins: {
          notes: 'Speaker notes for this slide. Only you see them.',
          presenter: 'The slide in one window, with your notes and a timer.',
          practice: 'A rehearsal, timed slide by slide against the minutes you planned.',
          live: 'A link for the room. They see the slide you’re on, and can look back.',
        },
      },
      {
        shot: 'speaker-view',
        title: 'Give the talk from Presenter Mode',
        where: ['Present ▾', 'Presenter Mode'],
        text: 'Presenter Mode opens a window with the slide, your notes, a timer and the slides still to come. Move through the talk with the arrow keys, or with Prev and Next.',
        pins: {
          notes: 'Your notes for the slide that’s showing.',
          timer: 'How long you’ve been talking, and the buttons to move on.',
          upcoming: 'The slides coming up next.',
        },
      },
    ],
    docs: [
      ['Your first presentation', 'tutorials/first-presentation'],
      ['Outlining a talk', 'tutorials/outline'],
      ['Text and typography', 'tutorials/text-typography'],
      ['Presenting and export', 'tutorials/presenting'],
    ],
  },
  {
    slug: 'citations',
    title: 'Cite your sources',
    summary: 'Bring in a .bib file, cite papers on your slides, and let the numbering and the references slide keep up with you.',
    minutes: 5,
    uses: ['BibTeX', 'Zotero', 'Citations', 'References slide'],
    cover: 'library',
    steps: [
      {
        shot: 'import',
        title: 'Bring in your BibTeX',
        where: ['Tools', 'Citations and bibliography…', 'Import BibTeX'],
        text: 'Open the bibliography from the Tools menu. Paste BibTeX entries or upload a .bib file, then click Import Entries. Papers already in the library are skipped, so importing the same file twice does no harm.',
        pins: {
          tab: 'Import BibTeX: paste entries, or upload a .bib file.',
          paste: 'Your entries, as BibTeX.',
          import: 'Adds them to this talk’s library.',
          zotero: 'Or connect your Zotero library and import from it.',
        },
      },
      {
        shot: 'library',
        title: 'Cite at the cursor',
        where: ['Double-click the text', 'Tools', 'Citations and bibliography…'],
        text: 'Put the cursor where the citation goes, then open the bibliography and click Cite beside the paper. The marker goes in at the cursor, as one piece that moves and deletes as a whole.',
        pins: {
          entry: 'A paper in the library, with its authors, year and BibTeX key.',
          cite: 'Puts its marker at the cursor.',
          count: 'How many papers in the library the slides cite.',
        },
      },
      {
        shot: 'marker',
        title: 'The numbers keep themselves in order',
        text: 'Markers are numbered in the order the talk cites them, slide by slide and top to bottom. Here Zwicky was cited first, but Rubin comes first on the slide, so Rubin is [1]. Move a slide and the numbers follow.',
        pins: {
          marker: 'The markers, numbered as the talk reads.',
        },
      },
      {
        shot: 'references',
        title: 'A references slide, made for you',
        where: ['Slides panel', 'REF'],
        text: 'As soon as the talk cites a paper, a References slide appears at the end. It lists only the papers you cite, with links to their DOIs, and it goes wherever the talk goes. To change it, change the bibliography: the slide follows.',
        pins: {
          thumb: 'The references slide, always last.',
          slide: 'Its preview, made from what the slides cite.',
          auto: 'Made for you, so there’s nothing to edit by hand.',
        },
      },
      {
        shot: 'style',
        title: 'Numbers, or author and year',
        where: ['Citations and bibliography…', 'Settings'],
        text: 'The Settings tab sets how the markers read, as numbers or as author and year, and the order of the numbers: as the talk cites them, or alphabetical.',
        pins: {
          style: 'Numbered, as [1], or author and year, as (Rubin & Ford, 1970).',
          order: 'Number them as the talk cites them, or alphabetically by first author.',
        },
      },
    ],
    docs: [
      ['Citations and bibliography', 'tutorials/citations'],
    ],
  },
  {
    slug: 'present-share',
    title: 'Rehearse, then share',
    summary: 'Time a rehearsal against your plan, see which slides ran long, then send the talk as a link, a file, or a site on GitHub Pages.',
    minutes: 8,
    uses: ['Practice Talk', 'Share link', 'Export', 'GitHub'],
    cover: 'runs',
    steps: [
      {
        shot: 'practice',
        title: 'Time a rehearsal',
        where: ['Present ▾', 'Practice Talk'],
        text: 'Practice Talk presents the talk with a timer on each slide, set against the minutes you planned in the outline. Talk it through as you would in the room, pause if you’re interrupted, and click Finish at the end.',
        pins: {
          slide: 'This slide’s time, against the minutes planned for it.',
          talk: 'The talk so far, and how far ahead of or behind the plan you are.',
          finish: 'Ends the run and keeps it.',
        },
      },
      {
        shot: 'runs',
        title: 'See where it ran long',
        where: ['Tools', 'Practice runs…'],
        text: 'Each run is kept with the talk: every slide’s time against its plan, over in orange and under in blue. Plan from this run makes the times you took the new plan. Only you see your runs; they aren’t shared or published.',
        pins: {
          table: 'Planned and practiced time, slide by slide.',
          use: 'Makes each slide’s practiced time its planned minutes.',
        },
      },
      {
        shot: 'share',
        title: 'Send a link',
        where: ['Share ▾', 'Share link…'],
        text: 'Enable Sharing makes a link that opens the talk in any browser, with nothing to install. To have someone edit it with you instead, invite them under Share › Editors.',
        pins: {
          link: 'The link. Click it to copy it.',
          stop: 'Turns the link off for good. Sharing again makes a new one.',
        },
      },
      {
        shot: 'export',
        title: 'Or send a file',
        where: ['File', 'Export'],
        text: 'Export saves the talk as a PDF, a PowerPoint file, or HTML that presents as Parallax does, sliders and all. Offline HTML carries everything inside it, so it runs from a USB stick with no connection.',
        pins: {
          export: 'File › Export.',
          formats: 'PDF, PowerPoint, HTML for the talk or one slide, and offline HTML.',
        },
      },
      {
        shot: 'github',
        title: 'Or put it on GitHub',
        where: ['Sync ▾', 'GitHub…'],
        text: 'Connect a repository once, with a token from GitHub. Each push is a commit holding the talk’s HTML, its JSON and its figures, so any version is there to go back to. Turn on GitHub Pages and the talk has an address of its own.',
        pins: {
          repo: 'The repository your talks go to.',
          message: 'What this push changes, for the commit.',
          push: 'Sends the talk to GitHub.',
        },
      },
    ],
    docs: [
      ['Presenting and export', 'tutorials/presenting'],
      ['Export and sharing', 'features/export'],
      ['Editing with others', 'tutorials/editing-with-others'],
    ],
  },
]

export const tutorialBySlug = slug => TUTORIALS.find(t => t.slug === slug) || null
