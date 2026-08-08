// quarto — booklet imposition engine + UI
// National Book Lovers Day, 2026-08-09
//
// The one counter-intuitive fact this thing teaches: when you print a
// saddle-stitched booklet, the pages are NOT laid out on the sheet in reading
// order. Each sheet holds four pages (two per side), arranged so that nesting,
// folding and stapling produces 1,2,3… in sequence. That arrangement is the
// "imposition", and it follows a clean closed form.

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────
  // 1. THE ENGINE  (pure functions — also exercised by test_engine.js)
  // ─────────────────────────────────────────────────────────────────

  // For a P-page saddle-stitched booklet, return the list of sheets.
  // Each sheet is { index, front:[a,b], back:[c,d] }, where front is the
  // OUTSIDE face and back is the INSIDE face, read left→right.
  //
  // The pattern, for sheet i (0 = outermost):
  //   front (outside) = [ P - 2i , 2i + 1 ]     ← the cover sheet sits here
  //   back  (inside)  = [ 2i + 2 , P - (2i+1) ]
  //
  // Each of the four pages on a sheet sums to P+1, which is the invariant.
  function imposeSheets(P) {
    if (P % 4 !== 0 || P < 4) throw new Error("page count must be a positive multiple of 4");
    const sheets = [];
    const n = P / 4;
    for (let i = 0; i < n; i++) {
      sheets.push({
        index: i,
        front: [P - 2 * i, 2 * i + 1],
        back: [2 * i + 2, P - (2 * i + 1)],
      });
    }
    return sheets;
  }

  // Given the sheets, produce a flat reading-order page list [1,2,…,P] and,
  // for each page, where it physically lives (sheet index + face).
  function readingOrder(P) {
    const sheets = imposeSheets(P);
    const map = {}; // pageNumber -> { sheet, face }
    sheets.forEach((s) => {
      s.front.forEach((pg) => (map[pg] = { sheet: s.index, face: "front" }));
      s.back.forEach((pg) => (map[pg] = { sheet: s.index, face: "back" }));
    });
    const order = [];
    for (let p = 1; p <= P; p++) order.push({ page: p, ...map[p] });
    return order;
  }

  // The fold order — which sheet goes OUTERMOST, which nests inside it, etc.
  // (The last sheet printed becomes the center; the first becomes the cover.)
  function nestingOrder(P) {
    return imposeSheets(P).map((s) => s.index); // already 0=outer → n-1=center
  }

  // Folio / quarto / octavo terminology — the traditional sheet-fold names.
  // A "folio" is one fold (2 leaves, 4 pages); "quarto" folds that again
  // (4 leaves, 8 pages); "octavo" folds a third time (8 leaves, 16 pages).
  function formatName(P) {
    if (P <= 0) return "";
    if (P === 4) return "folio · 1 sheet, 1 fold";
    if (P === 8) return "quarto · 2 sheets, 1 fold each";
    if (P === 16) return "octavo · 4 sheets, 1 fold each";
    if (P === 32) return "sexto-decimo · 8 sheets";
    if (P < 8) return `${P} pages`;
    if (P < 16) return `${P} pages`;
    return `${P} pages`;
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. STATE + DOM
  // ─────────────────────────────────────────────────────────────────
  let P = 16;
  let currentSpread = 0; // index into spreads; spread 0 = pages [1,2]

  const $ = (id) => document.getElementById(id);

  // ─────────────────────────────────────────────────────────────────
  // 3. RENDER — THE SHEET TAB
  // ─────────────────────────────────────────────────────────────────
  function renderSheets() {
    const grid = $("sheetGrid");
    const sheets = imposeSheets(P);
    grid.innerHTML = "";
    sheets.forEach((s) => {
      const card = document.createElement("div");
      card.className = "sheet-card";
      card.innerHTML = `
        <div class="sheet-head">sheet ${s.index + 1} of ${sheets.length}
          <span class="nest-tag">${s.index === 0 ? "· outermost (cover)" : s.index === sheets.length - 1 ? "· innermost (center)" : ""}</span>
        </div>
        <div class="face">
          <div class="face-label">outside (front)</div>
          <div class="face-pages">
            <span class="page-cell">${s.front[0]}</span>
            <span class="page-cell">${s.front[1]}</span>
          </div>
        </div>
        <div class="face">
          <div class="face-label">inside (back)</div>
          <div class="face-pages">
            <span class="page-cell">${s.back[0]}</span>
            <span class="page-cell">${s.back[1]}</span>
          </div>
        </div>`;
      grid.appendChild(card);
    });
    $("metaInfo").textContent = `${formatName(P)} · ${sheets.length} sheet${sheets.length > 1 ? "s" : ""} · fold each once, nest & staple`;
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. RENDER — THE FOLD ANIMATION (outermost sheet)
  // ─────────────────────────────────────────────────────────────────
  function setupFold() {
    const s = imposeSheets(P)[0]; // outermost
    $("foldL1").textContent = s.front[0];
    $("foldL2").textContent = s.front[1];
    $("foldCaption").innerHTML =
      `The <strong>outer sheet</strong> of a ${P}-page booklet. Pages <strong>${s.front[0]}</strong> ` +
      `and <strong>${s.front[1]}</strong> share the outside face. Fold along the crease and page ` +
      `<strong>${Math.min(...s.front)}</strong> becomes the front cover.`;
  }

  function playFold() {
    const sheet = $("foldSheet");
    sheet.classList.remove("folding", "folded");
    void sheet.offsetWidth; // reflow to restart animation
    sheet.classList.add("folding");
    setTimeout(() => {
      sheet.classList.remove("folding");
      sheet.classList.add("folded");
    }, 1400);
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. RENDER — THE BOOKLET TAB (flip through finished pages)
  // ─────────────────────────────────────────────────────────────────

  // A short essay on how a book is made — split across P pages so even an
  // 8-page booklet reads as a real little book. Page text by 1-based page no.
  const BOOK_TEXT = [
    { h: "How a Book is Made", b: "A book begins as a single large sheet." },
    { h: "The Sheet", b: "Before there were pages, there was a sheet. A printer takes one sheet and prints FOUR pages on it — two on the front, two on the back." },
    { h: "The Fold", b: "The sheet is folded once down the middle. That single fold turns four printed pages into four readable ones, in order. We call the folded unit a signature." },
    { h: "Imposition", b: "Here is the trick. The pages on the sheet are NOT in reading order. Page 1 sits next to the last page. Page 2 sits next to the second-last. Only the fold makes them run 1, 2, 3, 4…" },
    { h: "The Nest", b: "For a longer book, several sheets are printed, nested one inside the other, then stapled through the crease. The outer sheet becomes the cover; the inner sheet becomes the heart of the book." },
    { h: "The Stitch", b: "A saddle-stitched booklet — the kind in your hands — is stapled along the fold, like a rider in a saddle. Two staples, and the sheets become one book." },
    { h: "Folio Names", b: "One sheet, folded once, makes a folio. Folded twice it is a quarto. Three times, an octavo. The words survive from the age of handmade paper." },
    { h: "Why It Matters", b: "Every paperback on your shelf was once an impossible jumble of numbers on flat sheets. Imposition is the invisible geometry that turns paper into a book." },
  ];

  function textForPage(p, totalP) {
    if (p === 1) return { h: BOOK_TEXT[0].h, b: BOOK_TEXT[0].b };
    if (p === totalP) return { h: "— end —", b: "Turn back to the beginning." };
    // spread the essay across the interior pages
    const interior = totalP - 2;
    const idx = Math.min(BOOK_TEXT.length - 2, Math.floor((p - 2) * (BOOK_TEXT.length - 2) / Math.max(1, interior - 1)));
    return BOOK_TEXT[1 + idx];
  }

  function spreadsOf(P) {
    // a "spread" = one leaf turned = a left/right pair, pages [2k+1, 2k+2]
    const spreads = [];
    for (let i = 0; i < P / 2; i++) spreads.push([2 * i + 1, 2 * i + 2]);
    return spreads;
  }

  function renderBooklet() {
    const spreads = spreadsOf(P);
    currentSpread = Math.min(currentSpread, spreads.length - 1);
    $("lastPage").textContent = P;
    paintSpread();
  }

  function paintSpread() {
    const spreads = spreadsOf(P);
    currentSpread = Math.max(0, Math.min(currentSpread, spreads.length - 1));
    const [pa, pb] = spreads[currentSpread];
    paintPage($("bookLeft"), pa);
    paintPage($("bookRight"), pb);
    const order = readingOrder(P);
    const la = order[pa - 1], lb = order[pb - 1];
    $("pageInfo").textContent =
      `spread ${currentSpread + 1} of ${spreads.length} · ` +
      `pages ${pa}–${pb} · from sheet ${la.sheet + 1}/${lb.sheet + 1}`;
  }

  function paintPage(el, p) {
    const t = textForPage(p, P);
    el.innerHTML =
      `<div class="pg-num-top">${p}</div>` +
      `<div class="pg-body"><h3>${t.h}</h3><p>${t.b}</p></div>` +
      `<div class="pg-num-bot">${p}</div>`;
  }

  function turnPage(dir) {
    const spreads = spreadsOf(P);
    const target = currentSpread + dir;
    if (target < 0 || target >= spreads.length) return;

    const leaf = $("leafTurn");
    const fromLeft = dir > 0;
    // The turning leaf shows the page you're leaving on its front
    // and the page you're heading to on its back.
    const [curA, curB] = spreads[currentSpread];
    const [nxtA, nxtB] = spreads[target];
    if (fromLeft) {
      paintPage($("leafFront"), curB);
      paintPage($("leafBack"), nxtA);
    } else {
      paintPage($("leafFront"), nxtB);
      paintPage($("leafBack"), curA);
    }

    leaf.style.transition = "none";
    leaf.classList.remove("turning-fwd", "turning-back");
    leaf.style.transform = fromLeft ? "rotateY(0deg)" : "rotateY(-180deg)";
    void leaf.offsetWidth;

    leaf.style.transition = "transform 0.55s cubic-bezier(.4,.1,.3,1)";
    leaf.classList.add(fromLeft ? "turning-fwd" : "turning-back");
    leaf.style.transform = fromLeft ? "rotateY(-180deg)" : "rotateY(0deg)";

    setTimeout(() => {
      currentSpread = target;
      paintSpread();
      leaf.classList.remove("turning-fwd", "turning-back");
      leaf.style.transition = "none";
      leaf.style.transform = "rotateY(0deg)";
    }, 560);
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. RENDER — THE MATH TAB
  // ─────────────────────────────────────────────────────────────────
  function renderMath() {
    const sheets = imposeSheets(P);
    const target = P + 1;
    let html =
      `<div class="formula">` +
      `<span class="fn-label">front (outside):</span> <code>[ P − 2i , 2i + 1 ]</code><br>` +
      `<span class="fn-label">back (inside):</span> <code>[ 2i + 2 , P − (2i+1) ]</code><br>` +
      `<span class="fn-label">invariant:</span> every one of the four faces sums to <code>P + 1 = ${target}</code>` +
      `</div>`;
    html += `<table class="math-table"><thead><tr>
      <th>sheet <i>i</i></th><th>front (outside)</th><th>back (inside)</th><th>face sum</th>
    </tr></thead><tbody>`;
    sheets.forEach((s) => {
      const fs = s.front[0] + s.front[1];
      const bs = s.back[0] + s.back[1];
      html += `<tr>
        <td>${s.index + 1}</td>
        <td>[${s.front[0]}, ${s.front[1]}]</td>
        <td>[${s.back[0]}, ${s.back[1]}]</td>
        <td>${fs}, ${bs}, ${s.front[0] + s.back[0]}, ${s.front[1] + s.back[1]}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    html += `<p class="math-note">So for P = ${P}: the first (cover) sheet carries pages
      <code>[${sheets[0].front.join(", ")}]</code> on its outside and
      <code>[${sheets[0].back.join(", ")}]</code> on its inside. Fold it and page
      <strong>${sheets[0].front[1]}</strong> lands on top as page 1.</p>`;
    $("mathView").innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────
  // 7. WIRE UP
  // ─────────────────────────────────────────────────────────────────
  function setP(newP) {
    P = Math.max(4, Math.min(32, newP));
    $("pageCount").textContent = P;
    $("preset").value = String(P);
    currentSpread = 0;
    renderAll();
  }

  function renderAll() {
    renderSheets();
    setupFold();
    renderBooklet();
    renderMath();
  }

  function activateTab(name) {
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === "tab-" + name));
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("inc").addEventListener("click", () => setP(P + 4));
    $("dec").addEventListener("click", () => setP(P - 4));
    $("preset").addEventListener("change", (e) => setP(parseInt(e.target.value, 10)));
    $("foldBtn").addEventListener("click", playFold);
    $("prevPage").addEventListener("click", () => turnPage(-1));
    $("nextPage").addEventListener("click", () => turnPage(1));
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.addEventListener("click", () => activateTab(b.dataset.tab)));

    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") turnPage(-1);
      if (e.key === "ArrowRight") turnPage(1);
      if (e.key === "[" ) setP(P - 4);
      if (e.key === "]" ) setP(P + 4);
    });

    renderAll();
  });

  // ─────────────────────────────────────────────────────────────────
  // 8. EXPORTS (for test_engine.js under Node)
  // ─────────────────────────────────────────────────────────────────
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { imposeSheets, readingOrder, nestingOrder, formatName };
  }
})();
