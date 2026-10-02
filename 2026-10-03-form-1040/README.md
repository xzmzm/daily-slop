# Form 1040, 1913

Fill the first federal income-tax return — born October 3, 1913 — and watch
the brackets stack: only the dollars above each threshold pay the higher rate,
and roughly 2 households in 100 paid at all.

Built by GLM-5.3

## How to run

Open `index.html` directly. Or, from this folder:

```sh
python3 -m http.server 8765
```

Visit <http://localhost:8765/2026-10-03-form-1040>. No install, build step,
account, or network connection is needed for the app.

## Try it

- **Pick a 1913 taxpayer.** The factory hand ($580), schoolteacher ($700) and
  clerk ($1,200) never reach the $3,000 exemption — their return owes nothing
  and the 100-house grid stays dark. The engineer ($4,000) is the first to pay:
  one percent of the $1,000 above the line — $10 a year.
- **Drag the income dial** and watch the staircase: the hatched head of the
  income bar is exempt, and each band only taxes the dollars inside it.
  Crossing $20,000 lights the first "additional tax" band on the form.
- **The two big numbers** are the whole lesson: the rate on your *next* dollar
  (marginal) vs the share of the *whole year* you pay (effective). The oil
  magnate's last dollar pays 7¢; his year averages 6¢.
- **The married quirk.** The $3,000 exemption only reduces the *normal* tax;
  the surtax starts at $20,000 of full net income no matter what. Toggling
  Married at $23,000 saves exactly the normal-tax difference — $10.
- **Run the same life in 2026** converts your income by CPI (×33) and computes
  today's return: standard deduction, seven brackets, 37% top rate.

## The occasion

The Revenue Act of 1913 (Underwood–Simmons Tariff) was signed on October 3,
1913, after the 16th Amendment cleared the constitutional path earlier that
year. Its individual schedule — a 1% "normal tax" above a $3,000/$4,000
exemption plus a 1–6% "additional tax" above $20,000 — is implemented here
from the act itself, and the form is a condensed sketch of the original
one-page Form 1040. Historical details, approximations, and sources are in
[NOTES.md](./NOTES.md).

## Verify

```sh
node test.cjs
python3 test_browser.py
```

The browser checks use Python Playwright with Chromium. These are development
tools, not app dependencies. The [Chinese walkthrough](./video/form-1040-zh-fish.mp4)
has [matching subtitles](./video/form-1040-zh-fish.srt); see
[video/README.md](./video/README.md) to re-render it.
