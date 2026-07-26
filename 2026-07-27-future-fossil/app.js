const form = document.querySelector("#fossil-form");
const objectInput = document.querySelector("#object-name");
const clueInput = document.querySelector("#object-clue");
const card = document.querySelector("#catalog-card");
const status = document.querySelector("#status");

const templates = {
  titles: [
    ["DOMESTIC", "ALIGNMENT", "DEVICE"],
    ["PERSONAL", "DEVOTION", "TOKEN"],
    ["PORTABLE", "STATUS", "RELIC"],
    ["RITUAL", "CONVENIENCE", "VESSEL"],
    ["MINIATURE", "SOCIAL", "INSTRUMENT"],
    ["HOUSEHOLD", "PATIENCE", "TEST"],
    ["CEREMONIAL", "ATTENTION", "ANCHOR"],
    ["POCKET", "COMFORT", "TALISMAN"],
  ],
  uses: [
    "Likely displayed to signal membership in a minor convenience cult.",
    "A private ceremonial object, activated during periods of public avoidance.",
    "Scholars believe it helped users negotiate with invisible subscription spirits.",
    "Probably used to make ordinary waiting feel administratively productive.",
    "Carried daily as protection against silence, boredom, or direct eye contact.",
    "An intimacy proxy exchanged between humans and their household machines.",
    "Thought to measure social rank through its proximity to a charging cable.",
    "A domestic offering intended to save between four and seven minutes.",
  ],
  curatorNotes: [
    "Repeated ownership marks suggest the object was treasured, or simply difficult to clean.",
    "Its compact scale contradicts the enormous emotional importance assigned to it in surviving advertisements.",
    "The absence of repairable parts is now understood as a defining aesthetic of the Late Disposable Period.",
    "Archive images show users purchasing several before admitting they already owned one.",
    "No complete instruction manual survives; researchers suspect none was ever read.",
    "Microscopic traces of pocket lint confirm near-constant ceremonial transport.",
    "The object's true purpose remains disputed, though all interpretations involve mild inconvenience.",
    "Its asymmetrical wear indicates a right-handed society with limited patience.",
  ],
  acquisitions: [
    "Recovered beneath Seat 14A during the Terminal Three excavations.",
    "Gift of the Estate of Someone Who Meant to Sort That Drawer.",
    "Excavated from a sealed kitchen cabinet in the former Northern Hemisphere.",
    "Found with seventeen charging leads of incompatible ritual standard.",
    "Recovered from the sediment layer once known as a 'junk drawer.'",
    "Donated anonymously after a century in the pocket of an unworn coat.",
    "Salvaged from the Great Self-Storage Stratum, Unit B-104.",
    "Acquired during the archaeological clearance of a suburban bedside table.",
  ],
};

const conditionCopy = {
  pristine: [
    "Unusually intact; protective film remains ceremonially unpeeled.",
    "No visible use marks. Possibly purchased for an aspirational future self.",
    "Factory surface preserved; practical purpose may never have been attempted.",
  ],
  worn: [
    "Surface polished by repeated handling; original urgency has faded.",
    "Edges softened by daily use and at least one avoidable drop.",
    "Operational scars consistent with long service and short attention spans.",
  ],
  mysterious: [
    "Residue of unknown origin; curatorial tasting strictly prohibited.",
    "Function unclear. Several apertures appear emotionally significant.",
    "Fragmentary condition; may be complete by 2026 design standards.",
  ],
};

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRandom(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function makeTitle(words, random) {
  const token = words.toLowerCase();
  const traits = [];
  if (/phone|ear|head|speaker|radio/.test(token)) traits.push("AURICULAR");
  if (/cup|bottle|carton|mug|glass/.test(token)) traits.push("HYDRATION");
  if (/air|fan|dryer|heater|oven/.test(token)) traits.push("THERMAL");
  if (/stand|holder|case|shelf/.test(token)) traits.push("ALIGNMENT");
  if (/shoe|sock|shirt|hat|wear/.test(token)) traits.push("BODILY");
  if (/key|lock|door/.test(token)) traits.push("ACCESS");
  const base = [...pick(templates.titles, random)];
  if (traits.length) base[Math.floor(random() * base.length)] = pick(traits, random);
  return base.join(" ");
}

function generate(event) {
  event?.preventDefault();
  const objectName = objectInput.value.trim().replace(/\s+/g, " ");
  if (!objectName) {
    objectInput.focus();
    return;
  }

  const condition = new FormData(form).get("condition");
  const clue = clueInput.value.trim();
  const random = makeRandom(hashString(`${objectName}|${condition}|${clue}`));
  const serial = String(Math.floor(random() * 999)).padStart(3, "0");

  document.querySelector("#accession").textContent = `FFB.2126.0727.${serial}`;
  document.querySelector("#future-name").textContent = makeTitle(objectName, random);
  document.querySelector("#present-name").textContent = `Formerly: “${objectName.toLowerCase()},” c. 2026`;
  document.querySelector("#probable-use").textContent = pick(templates.uses, random);
  document.querySelector("#curator-note").textContent = clue
    ? `Surviving field note reads “${clue}.” Its ritual significance is unresolved.`
    : pick(templates.curatorNotes, random);
  document.querySelector("#condition-note").textContent = pick(conditionCopy[condition], random);
  document.querySelector("#acquisition").textContent = pick(templates.acquisitions, random);
  document.querySelector("#object-glyph").textContent = objectName.charAt(0);

  card.classList.remove("refresh");
  void card.offsetWidth;
  card.classList.add("refresh");
  status.textContent = "CATALOG UPDATED";
  window.setTimeout(() => {
    status.textContent = "";
  }, 1800);
}

function labelText() {
  const title = document.querySelector("#future-name").textContent;
  const former = document.querySelector("#present-name").textContent;
  const accession = document.querySelector("#accession").textContent;
  const rows = [...document.querySelectorAll(".metadata > div")]
    .map((row) => `${row.querySelector("dt").textContent}\n${row.querySelector("dd").textContent}`)
    .join("\n\n");
  return `${title}\n${former}\n${accession}\n\n${rows}\n\nFuture Fossil Bureau · 2126`;
}

form.addEventListener("submit", generate);

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    objectInput.value = button.dataset.example;
    clueInput.value = "";
    generate();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(labelText());
    status.textContent = "LABEL COPIED";
  } catch {
    status.textContent = "COPY UNAVAILABLE";
  }
  window.setTimeout(() => {
    status.textContent = "";
  }, 1800);
});

document.querySelector("#print-button").addEventListener("click", () => window.print());

generate();
