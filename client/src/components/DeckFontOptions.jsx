// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

// The fonts a deck's text can be set in, as a <select>'s options: Settings →
// Font (the deck's font) and the Themes panel's Text tab (body text's and
// the headings' fonts). Their values are CSS font family lists, which is
// what decks save.
export default function DeckFontOptions() {
  return (
    <>
      <optgroup label="Sans-serif">
        <option value="Arial, sans-serif">Arial</option>
        <option value="'Helvetica Neue', sans-serif">Helvetica</option>
        <option value="Inter, sans-serif">Inter</option>
        <option value="'Inter Tight', sans-serif">Inter Tight</option>
        <option value="Roboto, sans-serif">Roboto</option>
        <option value="'Open Sans', sans-serif">Open Sans</option>
        <option value="'Source Sans 3', sans-serif">Source Sans 3</option>
        <option value="'Fira Sans', sans-serif">Fira Sans</option>
        <option value="'IBM Plex Sans', sans-serif">IBM Plex Sans</option>
        <option value="Manrope, sans-serif">Manrope</option>
        <option value="Geist, sans-serif">Geist</option>
        <option value="'Titillium Web', sans-serif">Titillium Web</option>
        <option value="Figtree, sans-serif">Figtree</option>
        <option value="'Public Sans', sans-serif">Public Sans</option>
        <option value="Jost, sans-serif">Jost</option>
        <option value="Ubuntu, sans-serif">Ubuntu</option>
        <option value="Rubik, sans-serif">Rubik</option>
        <option value="'PT Sans', sans-serif">PT Sans</option>
        <option value="'Didact Gothic', sans-serif">Didact Gothic</option>
        <option value="Questrial, sans-serif">Questrial</option>
        <option value="Barlow, sans-serif">Barlow</option>
        <option value="'Libre Franklin', sans-serif">Libre Franklin</option>
        <option value="'Bricolage Grotesque', sans-serif">Bricolage Grotesque</option>
        <option value="Lexend, sans-serif">Lexend</option>
        <option value="Archivo, sans-serif">Archivo</option>
        <option value="Saira, sans-serif">Saira</option>
        <option value="'Computer Modern Sans', sans-serif">Computer Modern Sans</option>
      </optgroup>
      <optgroup label="Rounded">
        <option value="Comfortaa, sans-serif">Comfortaa</option>
        <option value="Nunito, sans-serif">Nunito</option>
        <option value="'Nunito Sans', sans-serif">Nunito Sans</option>
        <option value="Quicksand, sans-serif">Quicksand</option>
        <option value="Dosis, sans-serif">Dosis</option>
        <option value="'M PLUS Rounded 1c', sans-serif">M PLUS Rounded 1c</option>
        <option value="Jura, sans-serif">Jura</option>
      </optgroup>
      <optgroup label="Condensed">
        <option value="'Barlow Condensed', sans-serif">Barlow Condensed</option>
        <option value="'Asap Condensed', sans-serif">Asap Condensed</option>
        <option value="'Roboto Condensed', sans-serif">Roboto Condensed</option>
      </optgroup>
      <optgroup label="Serif">
        <option value="Georgia, serif">Georgia</option>
        <option value="'Times New Roman', serif">Times New Roman</option>
        <option value="'Playfair Display', serif">Playfair Display</option>
        <option value="Merriweather, serif">Merriweather</option>
        <option value="'STIX Two Text', serif">STIX Two Text</option>
        <option value="'EB Garamond', Georgia, serif">EB Garamond</option>
        <option value="'Computer Modern Serif', serif">Computer Modern</option>
      </optgroup>
      <optgroup label="Monospace">
        <option value="'Courier New', monospace">Courier New</option>
        <option value="'Courier Prime', monospace">Courier Prime</option>
        <option value="'Martian Mono', monospace">Martian Mono</option>
        <option value="'Fira Code', monospace">Fira Code</option>
        <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
        <option value="Inconsolata, monospace">Inconsolata</option>
        <option value="'Roboto Mono', monospace">Roboto Mono</option>
        <option value="'Space Mono', monospace">Space Mono</option>
        <option value="VT323, monospace">VT323</option>
        <option value="'B612 Mono', monospace">B612 Mono</option>
        <option value="'DM Mono', monospace">DM Mono</option>
      </optgroup>
      <optgroup label="Display">
        <option value="Impact, sans-serif">Impact</option>
        <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
        <option value="'Big Shoulders Display', sans-serif">Big Shoulders</option>
        <option value="'Big Shoulders Stencil Display', sans-serif">Big Shoulders Stencil</option>
        <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
        <option value="Codystar, sans-serif">Codystar</option>
        <option value="'National Park', sans-serif">National Park</option>
        <option value="'Futura PT', Futura, 'Century Gothic', sans-serif">Futura</option>
        <option value="'Bauhaus 93', Impact, sans-serif">Bauhaus 93</option>
        <option value="Caveat, cursive">Caveat</option>
        <option value="'Architects Daughter', cursive">Architects Daughter</option>
        <option value="'Press Start 2P', monospace">Press Start 2P</option>
        <option value="'Pixelify Sans', sans-serif">Pixelify Sans</option>
      </optgroup>
    </>
  )
}
