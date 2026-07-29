// daily-slop gallery — renders the project grid from window.GALLERY

(function () {
  "use strict";

  var data = window.GALLERY || { projects: [] };
  var grid = document.getElementById("grid");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  data.projects.forEach(function (p) {
    var card = el("a", "card");
    card.href = "view.html?p=" + encodeURIComponent(p.dir);

    var shot = el("div", "shot");
    var img = el("img");
    img.src = "gallery/" + p.shot;
    img.alt = p.title + " screenshot";
    img.loading = "lazy";
    shot.appendChild(img);
    card.appendChild(shot);

    var meta = el("div", "meta");
    meta.appendChild(el("div", "date", p.date));
    meta.appendChild(el("div", "name", p.title));
    if (p.tagline) meta.appendChild(el("p", "tag", p.tagline));
    var by = el("div", "byline");
    by.appendChild(document.createTextNode(p.stack));
    if (p.builtBy) {
      by.appendChild(document.createTextNode(" · built by "));
      var b = el("b", null, p.builtBy);
      by.appendChild(b);
    }
    meta.appendChild(by);
    card.appendChild(meta);

    grid.appendChild(card);
  });

  var info = document.getElementById("build-info");
  if (info) {
    info.textContent = data.projects.length + " projects · manifest built " +
      (data.generated || "?");
  }
})();
