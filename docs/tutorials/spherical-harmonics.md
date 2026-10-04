# Spherical Harmonics

Put spherical harmonics Yₗᵐ, and sums of them, on a slide: as lobes, as a colored sphere, as a vibrating surface, as a sky map, or as the whole table of ℓ and m. Drag one to turn it while you present, set it spinning or moving as a wave, and step through pictures that morph from one to the next.

## Adding one

Open the **Diagrams** menu in the toolbar and click **Spherical Harmonics**. A complex Y₂¹ goes on the slide, drawn as lobes colored by phase, in colors for the slide's background. Everything else is set in the right panel. **Start from** offers ready-made pictures: the five d orbitals as steps, the real and complex tables up to ℓ = 3, nodal lines on a sphere, a ringing star, an sp³ hybrid built term by term, a polar cap with its band limit raised step by step, and a random sky map.

Once the element is selected, **drag it on the canvas to turn it**, with the z axis kept upright. **Keep This View** stores that angle as the one it starts from; **Reset View** goes back to the default. To move the element, drag it before selecting it, or use the arrow keys.

## The function

| Function | What it is |
|---|---|
| **One** | A single harmonic: pick ℓ and m, and the **Form**. **Complex** is Yₗᵐ; **Real** gives the real harmonics chemists draw as orbitals, named s, p_x, d_xy, f_xyz… up to ℓ = 3. |
| **Sum** | A sum you type, such as `(s + p_x + p_y + p_z)/2` or `Y(2,1) - i Y(2,-1)`. |
| **Cap** | A disc on the sphere (1 inside, 0 outside) at (θ₀, φ₀) with radius α, kept to ℓ ≤ ℓmax. Its edge rings (the Gibbs phenomenon), more finely as ℓmax grows. |
| **Random sky** | A random field with power spectrum Cℓ ∝ ℓ⁻ⁿ up to ℓmax, like a map of the cosmic microwave background. **New Draw** picks another. Raising ℓmax adds detail without moving the large features. |

In a typed sum:

- `Y(2,1)` is complex or real, following the **Form** switch; `Y_2^1` and `Y_{2}^{-1}` are always complex; `Y_{2,-1}` is always real.
- Orbital names are real: `s`, `p_x`, `p_y`, `p_z`, `d_xy`, `d_yz`, `d_z2` (or `d_{z^2}`), `d_xz`, `d_x2-y2`, and the f orbitals such as `f_xyz` and `f_z3`.
- Coefficients can be decimals, fractions, `i`, `sqrt(2)` and `pi`, and can multiply a bracket: `(s + p_z)/sqrt(2)`.

The line under the box shows how the sum was read. A product of two harmonics isn't allowed, since it isn't a sum of harmonics without Clebsch–Gordan coefficients, and neither is a number on its own.

## Showing it

**Show** picks what's drawn: the value **f** itself (signed when it's real, colored by phase when it's complex), its real or imaginary part, |f|, or |f|².

| View | What it draws |
|---|---|
| **Lobes** | r = \|f(θ, φ)\|, the textbook picture, colored by sign, or by phase when f is complex. |
| **Sphere** | The unit sphere colored by f, with its nodal lines. |
| **Shape** | r = 1 + εf: a vibrating star, droplet or nucleus. **Amplitude** sets ε. |
| **Map** | A Mollweide or plate carrée map. Tick **Longitude grows to the left** for a map of the sky. |
| **Table** | Every harmonic up to ℓ = 1 to 5, one row for each ℓ, as lobes or spheres. |

Colors follow what the value is. Real values are orange where positive and blue where negative, running through gray in the sphere, shape and map views, so the nodes read as zero. Complex values are colored by phase on a circle of hues, starting from the same orange at phase 0 and reaching blue at π; on the sphere and map, colors darken toward |f| = 0. The **Color key** in the corner shows which scheme is in use.

**Motion** sets it **Spinning** about the z axis, or moving as a **Wave**, multiplied by e^(−iωt): a complex Yₗᵐ travels around the axis, and a real one stands in place. With reduced motion turned on in the system settings, it stays still.

**Label** puts the name in the top left, or the name and its exact formula. **Nodal lines**, **Axes** and **Color key** can be turned off.

## The formula

Below the settings, the panel shows the exact closed form of a single harmonic under the current conventions, such as

Y₂¹(θ, φ) = −½ √(15/2π) sin θ cos θ e^(iφ)

A real harmonic gets its Cartesian form too, such as d_xy = ½ √(15/π) xy/r², and a count of its nodes. **Copy TeX** copies the formula. **Copy Python** copies a script that draws the same picture with NumPy, SciPy and Matplotlib.

## Conventions

θ is the polar angle from +z and φ the azimuth from +x, as in physics texts and SciPy's `sph_harm_y`. Under **Conventions**:

- **Condon–Shortley phase** (on by default) is the factor (−1)ᵐ on Yₗᵐ for m > 0. Turn it off to make Yₗ⁻ᵐ the complex conjugate of Yₗᵐ, as geodesy and some chemistry texts do.
- **Normalization**: orthonormal (∫|Y|² dΩ = 1, as in quantum mechanics), 4π (geodesy), Schmidt semi-normalized (4π/(2ℓ + 1), geomagnetism), or unnormalized (Pₗᵐ(cos θ) e^(imφ)).

Real harmonics are √2 (−1)ᵐ Re Yₗᵐ for m > 0 and √2 (−1)ᵐ Im Yₗ^|m| for m < 0, so p_x's positive lobe is on +x whichever phase convention is used. A single harmonic is always drawn scaled to fit; the conventions change its formula, and the weights of the terms in a sum.

## Steps

Each step is a whole picture: its function, view, what it shows, its motion and its angle, with a caption under it. The strip of steps in the panel picks which one the settings edit, and the canvas shows it.

- **Add a Step** puts a copy of the current picture after it, to change. **↑** and **↓** reorder steps, and **Remove** deletes one.
- **Build up** writes a whole sequence from the current picture: each m for its ℓ; ℓ = 0, 1, … up to its own; band limits 1, 2, 4, … for a cap or a sky; or a sum one term at a time, normalized as it grows.
- **First step at slide step** places the steps among the slide's other animations.

Moving to a step morphs the picture into the next one. Between a map and a 3D view, or to and from a table, it fades across instead.

## Printing and export

- **PDF**: the picture as it opens and at each step, held still, at twice the screen's resolution.
- **Offline HTML**: works as presented, with no internet needed.
- **PowerPoint (.pptx)**: a picture of it as it opens, with its name as plain text.

It's drawn with WebGL 2, which current browsers have. Where it's turned off, the element says so. Dragging turns it, so it can't have a click action of its own; another element's click or hover can still show or hide it.
