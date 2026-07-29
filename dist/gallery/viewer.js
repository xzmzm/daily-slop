// daily-slop gallery — viewer page: project iframe + notes/readme panel

(function () {
  "use strict";

  var data = window.GALLERY || { projects: [] };
  var dir = new URLSearchParams(location.search).get("p");
  var project = null;
  for (var i = 0; i < data.projects.length; i++) {
    if (data.projects[i].dir === dir) { project = data.projects[i]; break; }
  }
  if (!project) {
    location.replace("index.html");
    return;
  }

  document.title = project.title + " — daily-slop";
  document.getElementById("frame").src = project.dir + "/index.html";

  var panel = document.getElementById("panel");
  var scrim = document.getElementById("scrim");
  var infoBtn = document.getElementById("info-btn");
  var body = document.getElementById("panel-body");
  var tabs = document.querySelectorAll(".tab");
  var current = "notes";

  function render() {
    var src = current === "notes" ? project.notes : project.readme;
    body.innerHTML = window.renderMarkdown(src);
    body.scrollTop = 0;
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    scrim.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", String(!open));
    infoBtn.setAttribute("aria-expanded", String(open));
  }

  infoBtn.addEventListener("click", function () {
    var opening = !panel.classList.contains("open");
    if (opening) render();
    setOpen(opening);
  });
  document.getElementById("panel-close").addEventListener("click", function () {
    setOpen(false);
  });
  scrim.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      current = tab.dataset.tab;
      tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
      render();
    });
  });
})();
