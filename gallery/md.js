// daily-slop gallery — tiny markdown -> HTML renderer (no deps).
// Supports: headings, hr, fenced code, inline code, bold/italic,
// links, images, ul/ol lists, blockquotes, pipe tables, paragraphs.

window.renderMarkdown = (function () {
  "use strict";

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s) {
    // s is already HTML-escaped
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push("<code>" + c + "</code>");
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    s = s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\s][^_]*)_/g, "$1<em>$2</em>");
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return codes[+i]; });
  }

  function tableRow(line, tag) {
    var cells = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|");
    return "<tr>" + cells.map(function (c) {
      return "<" + tag + ">" + inline(c.trim()) + "</" + tag + ">";
    }).join("") + "</tr>";
  }

  return function renderMarkdown(src) {
    if (!src || !src.trim()) {
      return '<p class="md-empty">(nothing here — this project has no such file)</p>';
    }
    var lines = src.split(/\r?\n/);
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var raw = lines[i];
      var line = esc(raw);

      // fenced code
      var fence = /^```/.exec(raw);
      if (fence) {
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(esc(lines[i++]));
        i++; // closing fence
        out.push("<pre><code>" + buf.join("\n") + "</code></pre>");
        continue;
      }
      // blank
      if (!raw.trim()) { i++; continue; }
      // hr
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(raw)) { out.push("<hr>"); i++; continue; }
      // heading
      var h = /^(#{1,6})\s+(.*)$/.exec(raw);
      if (h) {
        var lvl = Math.min(h[1].length, 6);
        out.push("<h" + lvl + ">" + inline(esc(h[2])) + "</h" + lvl + ">");
        i++;
        continue;
      }
      // table (header row + separator row)
      if (/^\s*\|.*\|\s*$/.test(raw) && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /-/.test(lines[i + 1])) {
        var t = ["<table><thead>", tableRow(esc(raw), "th"), "</thead><tbody>"];
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
          t.push(tableRow(esc(lines[i]), "td"));
          i++;
        }
        t.push("</tbody></table>");
        out.push(t.join(""));
        continue;
      }
      // blockquote
      if (/^\s*>\s?/.test(raw)) {
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          q.push(inline(esc(lines[i].replace(/^\s*>\s?/, ""))));
          i++;
        }
        out.push("<blockquote><p>" + q.join("<br>") + "</p></blockquote>");
        continue;
      }
      // lists
      var ul = /^\s*[-*+]\s+/.test(raw);
      var ol = /^\s*\d+[.)]\s+/.test(raw);
      if (ul || ol) {
        var tag = ul ? "ul" : "ol";
        var re = ul ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
        var items = [];
        while (i < lines.length && re.test(lines[i])) {
          var item = lines[i].replace(re, "");
          i++;
          // hanging continuation lines
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) &&
                 !re.test(lines[i]) && !/^\s*[-*+]\s+/.test(lines[i])) {
            item += " " + lines[i].trim();
            i++;
          }
          items.push("<li>" + inline(esc(item)) + "</li>");
        }
        out.push("<" + tag + ">" + items.join("") + "</" + tag + ">");
        continue;
      }
      // paragraph — gather until blank/structural line
      var para = [line];
      i++;
      while (i < lines.length && lines[i].trim() &&
             !/^(#{1,6}\s|```|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*>|\s*\|)/.test(lines[i]) &&
             !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])) {
        para.push(esc(lines[i]));
        i++;
      }
      out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return out.join("\n");
  };
})();
