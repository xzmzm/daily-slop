# Type Light — build notes

Built on 2026-09-19 by GPT-6 Astra.

## Why this project?

The existing gallery has scientific instruments, simulations, games, and a
paragraph typesetter. It did not have an image-to-character darkroom.
September 19 is the date on Fahlman's 1982 campus-board smiley proposal;
that suggested characters doing visual work rather than another historical
apparatus. The small question became: how much picture can two symbols keep?
The sculpture is an original procedural subject, not a downloaded asset.

## From light to type

1. Render the subject into an offscreen canvas, or fit a locally imported
   image into the same frame. A software-projected torus-knot mesh supplies
   a subject with continuous highlights, shadows, and motion.
2. Downsample to the character grid using the browser's image resampler.
   Convert the resulting sRGB samples to relative luminance with the standard
   transfer curve and weights 0.2126, 0.7152, and 0.0722. Exposure multiplies
   linear brightness by `2 ** stops`; contrast pivots around 0.18.
3. Draw each glyph into a 9 × 16 cell using the actual browser font. Sum its
   alpha coverage, sort by ink, and normalize the densest glyph to one.
   The same cell geometry is used to render the output, so the picture's
   proportions do not assume square characters.
4. Quantize to measured levels. Plain mode picks the nearest level. Bayer
   mode chooses between the two bracketing levels using a repeating 4 × 4
   threshold matrix. Floyd–Steinberg alternates row direction and distributes
   error with weights 7/16, 3/16, 5/16, and 1/16 to unprocessed neighbors.
   Error leaving the image is discarded, never wrapped onto the next row.
5. Draw the selected symbols and retain their indices for an actual plain
   text export. PNG export uses only the character canvas, not the comparison
   overlay or UI chrome.

The pale-paper palette is an intentional ink-on-paper inversion. The color
palette preserves sampled hue while lifting the glyph color for readability;
it is not a colorimetrically exact reproduction. Likewise, normalized ink
coverage is not physical emitted luminance. Browser downsampling happens
before the linear-light conversion, a deliberate small-project compromise.

## Details that mattered

The extended alphabet contained 23 distinct characters, while an early label
said 22. A browser assertion caught the mismatch; the UI now says 23.
The first comparison position was 32 percent: it left most of the subject on
the character side and made the source hard to judge. A 50/50 split is the
more useful starting view.

Glyph sorting must use the rendered font: a copied “dark-to-light” string
can have its middle characters in the wrong order. The visible ramp reports
raw cell coverage, while quantization uses normalized values. Font fallback
can therefore legitimately change a print across operating systems.

Imported images have a size cap and a revision guard, so a slow earlier
image decode cannot replace a newer selection. Object URLs are revoked after
decoding. The preview responds to pointer drag/drop without uploading files.

The capture environment disallowed both local HTTP and file navigation.
An explicit inline mode loads the same HTML, CSS, and JS without navigation;
it does not change browser policy. Full navigation and real downloads are
checked separately in GitHub Actions. The video streams frames into ffmpeg
instead of retaining thousands of PNG files. Playwright's clock advances
animation by frame time, not by the speed of screenshot capture.

The normal Fish Audio key was not available from the offline desktop during
the build. The renderer checks the authorized environment and root `.env`,
and labels its music-and-caption fallback explicitly. It does not fake
narration or quietly substitute a different person's voice.

## Sources and boundaries

- [Original September 19, 1982 message, Carnegie Mellon](https://www.cs.cmu.edu/~sef/Orig-Smiley.htm).
- [W3C relative luminance definition](https://www.w3.org/TR/WCAG22/relative-luminance.html).

No claim is made that smileys invented ASCII art. This is a visual experiment,
not a historical terminal emulator or a photometric calibration instrument.
Camera capture, remote URLs, accounts, and a backend were left out of scope.
