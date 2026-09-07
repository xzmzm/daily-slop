const sample = 'A reader walks into a room made of words. Some lines hurry to the far wall; others stop early, leaving a small silence behind. The typesetter moves no walls and changes no words. Only the places where we pause are different. A word borrowed from one line can give the next line room to breathe. Good typography is a quiet host: you remember the story, not the chair.';
const $ = id => document.getElementById(id);
const ctx = document.createElement('canvas').getContext('2d');
ctx.font = '20px Georgia';
$('copy').value = sample;
function update() {
  const words = $('copy').value.trim().split(/\s+/u).filter(Boolean);
  const widths = words.map(word => ctx.measureText(word).width);
  const limit = Number($('width').value);
  $('width-value').textContent = `${limit} px`;
  $('word-count').textContent = `${words.length} words / ${$('copy').value.length} characters`;
  document.body.classList.toggle('hide-slack', !$('show-slack').checked);
  const results = [false, true].map(optimal => LineBreak.layout(widths, ctx.measureText(' ').width, limit, optimal));
  ['greedy', 'balanced'].forEach((id, k) => {
    const node = $(id); node.replaceChildren(); node.style.width = `${limit}px`;
    results[k].lines.forEach(line => {
      const row = document.createElement('div'); row.className = 'line';
      const text = document.createElement('span'); text.className = 'words';
      text.textContent = words.slice(line.start, line.end).join(' ');
      const slack = document.createElement('span'); slack.className = 'slack'; slack.setAttribute('aria-hidden', 'true');
      row.append(text, slack); node.append(row);
    });
    if (!words.length) node.textContent = 'Your words go here.';
    $(`${id}-lines`).textContent = `${results[k].lines.length} lines`;
    $(`${id}-score`).textContent = Math.round(results[k].score).toLocaleString();
  });
  const improvement = results[0].score ? Math.round((1 - results[1].score / results[0].score) * 100) : 0;
  $('verdict').textContent = !words.length ? 'Start with a few words. The breaks will follow.' : improvement ? `${improvement}% less unevenness. Same words, different decisions.` : 'Both approaches agree here. Try another width or change the copy.';
  window.lastLayout = results;
}
['width', 'copy', 'show-slack'].forEach(id => $(id).addEventListener('input', update));
[['narrow', 260], ['book', 360], ['wide', 440]].forEach(([id, value]) => $(id).addEventListener('click', () => {$('width').value = value; update();}));
$('reset').addEventListener('click', () => {$('copy').value = sample; update();});
update();
