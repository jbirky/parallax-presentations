# Timing Diagrams

Draw clock, signal and bus waveforms from a few lines of WaveJSON, the format of [WaveDrom](https://wavedrom.com), which is what hardware datasheets and course notes use. While you present, the waveforms can appear cycle by cycle, with a cursor at the edge and a caption for each step. WaveDrom also draws a register's bit fields.

## Making one

1. Open the **Diagrams** menu in the toolbar and click **Timing Diagram**.
2. The editor opens with a clock, a data bus and a request and acknowledge handshake. Edit the WaveJSON on the left, or pick another diagram from **Start from…**: an SPI byte, I²C, a UART frame, an AXI-style valid and ready handshake, a pipeline, or a RISC-V instruction's fields.
3. Click **Insert**.

The diagram on the right redraws as you type. If the WaveJSON can't be read, the line under it says why and on which line.

To change it later, double-click the diagram or select it and click **Edit Timing Diagram…** in the right panel.

## Writing WaveJSON

A diagram is a list of signals, each with a name and a wave, one character for each cycle:

```js
{ signal: [
  { name: 'clk',  wave: 'p.....' },
  { name: 'data', wave: 'x.34.x', data: ['head', 'body'] },
  { name: 'req',  wave: '0.1..0' },
] }
```

| Character | Draws |
|---|---|
| `p` `n` | A clock rising or falling at the start of each cycle; `P` `N` add an arrow at the edge |
| `0` `1` | Low or high |
| `l` `h` | Low or high with a sharp edge, as a clock's |
| `x` | Unknown |
| `z` | High impedance |
| `=` and `2` to `9` | A value on a bus, labelled from the signal's `data` list in order; the digit sets its color |
| `.` | The same as the cycle before |
| `\|` | A gap, for time left out |
| `u` `d` | Pulled up or down |

More you can write:

- `{}` leaves an empty row; `['Name', signal, signal]` puts signals in a labelled group.
- `period: 2` stretches a signal's cycles; `phase: 0.5` shifts it.
- `node: '..a...'` names events, and `edge: ['a~>b label']` draws an arrow between them: `->` straight, `~>` curved, `-|>` square, `<->` both ways.
- `head: { text: 'Title', tick: 0 }` adds a title and numbers the cycles; `foot` puts text under it.
- `config: { hscale: 2 }` widens every cycle.

Keys don't need quotes, strings can use single quotes and a list can end with a comma, as in WaveDrom's own editor. WaveDrom's [tutorial](https://wavedrom.com/tutorial.html) has every feature.

### Registers

A list of fields under `reg` draws a register, least significant bits on the right:

```js
{ reg: [
  { bits: 7,  name: 'opcode', attr: 'OP-IMM' },
  { bits: 5,  name: 'rd' },
  { bits: 3,  name: 'funct3' },
  { bits: 5,  name: 'rs1' },
  { bits: 12, name: 'imm[11:0]' },
], config: { bits: 32 } }
```

## Colors

**For a dark slide** draws with WaveDrom's dark skin; **For a light slide** with its usual one. A new diagram matches the slide it's on. Change it in the editor or in the right panel.

## Revealing it cycle by cycle

In the editor's **Steps**, each step shows the waveforms up to a cycle:

- **Add a step** reveals one more cycle than the step before; type over its cycle to change it. A step can stop halfway through a cycle (2.5).
- **A step every _n_ cycles** writes a step for each _n_ cycles to the end.
- **Before the first, show** sets how much shows when the slide opens. At 0, only the signal names show.
- Give a step a **caption** and it shows under the diagram from that step on, until a later step's caption replaces it.
- **A cursor where the waveforms stop** draws a dashed line at the edge of what's shown.

Click **Preview build** to step through it as the presented slide will (→ and ←). **First step at slide step**, in the right panel, places the steps among the slide's other animations.

The canvas always shows every cycle. In a PDF, each step gets its own page. Registers have no steps.

## Copying it out

- **Copy WaveJSON**, in the right panel or the editor, copies the source, which also opens in [WaveDrom's editor](https://wavedrom.com/editor.html).
- **SVG**, in the editor, copies the drawing as an SVG file's text, for a paper or a datasheet.
- **PowerPoint (.pptx)** export puts the diagram on its slide as an image.

WaveDrom is by Aliaksei Chapyzhenka and others, under the MIT license.
