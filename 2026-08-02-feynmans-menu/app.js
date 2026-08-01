const BASE_SEED = 8022026;

const restaurantNames = [
  "The Copper Fig",
  "Pigeon & Pear",
  "The Quiet Clove",
  "Marigold Room",
  "Juniper & Salt",
  "The Blue Ladle",
  "Cinder House",
  "Little Mackerel",
  "The Red Apricot",
  "North Window",
  "The Paper Olive",
  "Saffron Bicycle",
  "The Crooked Lemon",
  "Nightjar Kitchen",
  "The Brass Peach",
  "Three Small Onions",
  "The Green Lantern",
  "Second Cousin",
  "The Velvet Bean",
  "Rosemary Radio",
  "The Silver Anchovy",
  "Good Neighbor",
  "The Last Shallot",
  "Apricot Standard"
];

const restaurantTypes = [
  "Levantine · eight tables",
  "Noodle bar · open late",
  "Bistro · handwritten menu",
  "Seafood · no reservations",
  "Family kitchen · upstairs",
  "Wine bar · tiny plates",
  "Canteen · excellent rumors",
  "Bakery supper · one sitting",
  "Grill · charcoal and vinyl",
  "Corner café · cash only",
  "Tavern · local vegetables",
  "Supper club · behind a curtain"
];

const scoreNotes = [
  [90, "A meal worth rearranging the trip for."],
  [80, "You immediately text someone about it."],
  [70, "The kind of table you remember."],
  [60, "Good, with one glorious bite."],
  [50, "Pleasant enough. The bread helped."],
  [35, "You finish, but not the story."],
  [0, "Character-building."]
];

const elements = {
  newTown: document.querySelector("#new-town"),
  nightButtons: [...document.querySelectorAll("[data-nights]")],
  nextNight: document.querySelector("#next-night"),
  totalNights: document.querySelector("#total-nights"),
  townStamp: document.querySelector("#town-stamp"),
  receipt: document.querySelector("#receipt"),
  receiptNight: document.querySelector("#receipt-night"),
  restaurantType: document.querySelector("#restaurant-type"),
  restaurantName: document.querySelector("#restaurant-name"),
  restaurantNote: document.querySelector("#restaurant-note"),
  restaurantScore: document.querySelector("#restaurant-score"),
  favoriteScore: document.querySelector("#favorite-score"),
  favoriteName: document.querySelector("#favorite-name"),
  favoriteDetail: document.querySelector("#favorite-detail"),
  averageScore: document.querySelector("#average-score"),
  decisionQuestion: document.querySelector("#decision-question"),
  explore: document.querySelector("#explore"),
  return: document.querySelector("#return"),
  returnDetail: document.querySelector("#return-detail"),
  runningPoints: document.querySelector("#running-points"),
  ledger: document.querySelector("#ledger"),
  recommendation: document.querySelector("#recommendation"),
  recommendationVerb: document.querySelector("#recommendation-verb"),
  recommendationCopy: document.querySelector("#recommendation-copy"),
  meterBest: document.querySelector("#meter-best"),
  meterThreshold: document.querySelector("#meter-threshold"),
  meterBestLine: document.querySelector("#meter-best-line"),
  meterThresholdLine: document.querySelector("#meter-threshold-line"),
  thresholdChart: document.querySelector("#threshold-chart"),
  resultPanel: document.querySelector("#result-panel"),
  resultClose: document.querySelector("#result-close"),
  resultTitle: document.querySelector("#result-title"),
  resultSummary: document.querySelector("#result-summary"),
  playerResult: document.querySelector("#player-result"),
  optimalResult: document.querySelector("#optimal-result"),
  resultFootnote: document.querySelector("#result-footnote"),
  playAgain: document.querySelector("#play-again"),
  announcer: document.querySelector("#announcer")
};

let townCount = 0;
let state;
let receiptTimer;
let unlockTimer;
let resultTimer;

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
}

function makeTown(seed, count) {
  const random = mulberry32(seed);
  const names = shuffle(restaurantNames, random);
  const types = shuffle(restaurantTypes, random);

  return Array.from({ length: count }, (_, index) => ({
    name: names[index % names.length],
    type: types[index % types.length],
    score: random() * 100,
    visits: 0
  }));
}

function threshold(nightsRemaining) {
  const root = Math.sqrt(nightsRemaining);
  return (100 * root) / (root + 1);
}

function scoreNote(score) {
  return scoreNotes.find(([minimum]) => score >= minimum)[1];
}

function formatScore(score) {
  return score.toFixed(1);
}

function recommendationFor(best, nightsRemaining) {
  if (!best) return "explore";
  return best.score >= threshold(nightsRemaining) ? "return" : "explore";
}

function createLedger() {
  elements.ledger.innerHTML = "";
  elements.ledger.style.setProperty("--nights", state.nights);

  for (let dinner = 1; dinner <= state.nights; dinner += 1) {
    const item = document.createElement("li");
    item.dataset.dinner = dinner;
    item.innerHTML = `<span>${String(dinner).padStart(2, "0")}</span>`;
    elements.ledger.append(item);
  }
}

function buildThresholdChart() {
  elements.thresholdChart.innerHTML = "";
  elements.thresholdChart.style.setProperty("--nights", state.nights);

  for (let nights = state.nights; nights >= 1; nights -= 1) {
    const step = document.createElement("div");
    step.className = "curve-step";
    step.dataset.remaining = nights;
    step.style.setProperty("--level", threshold(nights).toFixed(2));
    step.style.setProperty("--bar-height", `${((threshold(nights) - 45) / 35) * 100}%`);
    step.title = `${nights} left: ${formatScore(threshold(nights))}`;
    step.innerHTML = `<span>${nights}</span>`;
    elements.thresholdChart.append(step);
  }
}

function markLedger(dinnerNumber, restaurant, action, matchedRule, automatic = false) {
  const item = elements.ledger.children[dinnerNumber - 1];
  if (!item) return;

  item.classList.add("is-filled");
  item.classList.toggle("is-return", action === "return");
  const ruleResult = automatic
    ? "Automatic opening dinner."
    : matchedRule
      ? "Matched the napkin rule."
      : "Did not match the napkin rule.";
  item.title = `Dinner ${dinnerNumber}: ${restaurant.name}, ${formatScore(restaurant.score)}. ${action === "return" ? "Returned" : "Explored"}. ${ruleResult}`;
  item.setAttribute("aria-label", item.title);
  item.innerHTML = `<span>${formatScore(restaurant.score)}</span><small aria-hidden="true">${automatic ? "A" : matchedRule ? "✓" : "×"}</small>`;
}

function updateReceipt(restaurant, dinnerNumber, action, immediate = false) {
  window.clearTimeout(receiptTimer);

  const render = () => {
    elements.receiptNight.textContent = `Dinner ${String(dinnerNumber).padStart(2, "0")}`;
    elements.restaurantType.textContent = action === "return" ? `${restaurant.type} · revisited` : restaurant.type;
    elements.restaurantName.textContent = restaurant.name;
    elements.restaurantNote.textContent = action === "return" ? "Exactly as good as you remembered." : scoreNote(restaurant.score);
    elements.restaurantScore.textContent = formatScore(restaurant.score);
    elements.receipt.classList.remove("is-changing");
  };

  if (immediate) {
    render();
    return;
  }

  elements.receipt.classList.add("is-changing");
  receiptTimer = window.setTimeout(render, 150);
}

function updateInterface() {
  const dinnersEaten = state.nights - state.remaining;
  const nextDinner = Math.min(state.nights, dinnersEaten + 1);
  const stoppingLine = state.remaining > 0 ? threshold(state.remaining) : 50;
  const advice = state.remaining > 0 ? recommendationFor(state.best, state.remaining) : "return";

  elements.nextNight.textContent = nextDinner;
  elements.totalNights.textContent = state.nights;
  elements.townStamp.textContent = `Town ${String(state.seed % 10000).padStart(4, "0")}`;
  elements.favoriteScore.textContent = formatScore(state.best.score);
  elements.favoriteName.textContent = state.best.name;
  elements.favoriteDetail.textContent = `${state.best.visits} ${state.best.visits === 1 ? "visit" : "visits"} · best of ${state.exploreIndex} tried`;
  elements.averageScore.textContent = formatScore(state.total / dinnersEaten);
  elements.runningPoints.textContent = `${formatScore(state.total)} pts`;
  elements.returnDetail.textContent = `Bank ${formatScore(state.best.score)} points tonight`;

  if (state.remaining > 0) {
    elements.decisionQuestion.textContent = state.remaining === 1
      ? "Last dinner: trust the favorite, or take one final chance?"
      : `Risk dinner on an unknown table, or return to ${state.best.name}?`;
  }

  elements.recommendation.classList.toggle("is-return", advice === "return");
  elements.recommendationVerb.textContent = advice;
  elements.recommendationCopy.textContent = advice === "return"
    ? "Your favorite clears tonight’s stopping line. The rule goes back."
    : "Your favorite is below tonight’s stopping line. The rule keeps looking.";
  elements.meterBest.textContent = formatScore(state.best.score);
  elements.meterThreshold.textContent = formatScore(stoppingLine);
  elements.meterBestLine.style.left = `${state.best.score}%`;
  elements.meterThresholdLine.style.left = `${stoppingLine}%`;

  [...elements.thresholdChart.children].forEach((step) => {
    step.classList.toggle("is-current", Number(step.dataset.remaining) === state.remaining);
  });

  elements.explore.disabled = state.remaining === 0 || state.animating;
  elements.return.disabled = state.remaining === 0 || state.animating || !state.best;
}

function takeDinner(action, initial = false) {
  if (!state || state.remaining <= 0 || state.animating) return;

  const activeState = state;
  state.animating = !initial;
  const dinnerNumber = state.nights - state.remaining + 1;
  const expectedAction = recommendationFor(state.best, state.remaining);
  let restaurant;

  if (action === "explore") {
    restaurant = state.town[state.exploreIndex];
    state.exploreIndex += 1;
    if (!state.best || restaurant.score > state.best.score) state.best = restaurant;
  } else {
    restaurant = state.best;
  }

  restaurant.visits += 1;
  state.total += restaurant.score;
  state.remaining -= 1;
  state.choices.push({
    action,
    expectedAction,
    matchedRule: action === expectedAction,
    automatic: initial,
    restaurant,
    dinnerNumber
  });

  markLedger(dinnerNumber, restaurant, action, action === expectedAction, initial);
  updateReceipt(restaurant, dinnerNumber, action, initial);
  updateInterface();

  if (!initial) {
    elements.announcer.textContent = `${action === "explore" ? "Tried" : "Returned to"} ${restaurant.name}: ${formatScore(restaurant.score)}. ${state.remaining} dinners remain.`;
    unlockTimer = window.setTimeout(() => {
      if (state !== activeState) return;
      state.animating = false;
      updateInterface();
    }, 190);
  }

  if (state.remaining === 0) {
    elements.explore.disabled = true;
    elements.return.disabled = true;
    resultTimer = window.setTimeout(showResults, 620);
  }
}

function simulateOptimal() {
  let best = null;
  let exploreIndex = 0;
  let total = 0;
  const choices = [];

  for (let nightsRemaining = state.nights; nightsRemaining >= 1; nightsRemaining -= 1) {
    const action = recommendationFor(best, nightsRemaining);
    let restaurant;

    if (action === "explore") {
      restaurant = state.town[exploreIndex];
      exploreIndex += 1;
      if (!best || restaurant.score > best.score) best = restaurant;
    } else {
      restaurant = best;
    }

    total += restaurant.score;
    choices.push(action);
  }

  return { total, choices };
}

function showResults() {
  const optimal = simulateOptimal();
  const playerDecisions = state.choices.filter((choice) => !choice.automatic);
  const matches = playerDecisions.filter((choice) => choice.matchedRule).length;
  const decisionCount = playerDecisions.length;
  const difference = state.total - optimal.total;

  elements.playerResult.textContent = formatScore(state.total);
  elements.optimalResult.textContent = formatScore(optimal.total);

  if (matches === decisionCount) {
    elements.resultTitle.textContent = "Napkin-perfect.";
    elements.resultSummary.textContent = "Every choice matched the stopping rule — no second-guessing required.";
  } else if (difference > 0.05) {
    elements.resultTitle.textContent = "You got lucky.";
    elements.resultSummary.textContent = `You beat the expected-value rule by ${formatScore(difference)} points in this particular town.`;
  } else if (Math.abs(difference) <= 0.05) {
    elements.resultTitle.textContent = "A dead heat.";
    elements.resultSummary.textContent = "Different choices, almost exactly the same bill.";
  } else {
    elements.resultTitle.textContent = "The napkin wins this one.";
    elements.resultSummary.textContent = `The stopping rule kept ${formatScore(Math.abs(difference))} more points across the same restaurant deck.`;
  }

  elements.resultFootnote.textContent = `You matched ${matches} of ${decisionCount} choices. The opening dinner is automatic. “Optimal” means the best average result over many unknown towns; luck can still win or lose any single trip.`;
  elements.resultPanel.hidden = false;
  elements.resultClose.focus();
}

function hideResults() {
  elements.resultPanel.hidden = true;
  elements.newTown.focus();
}

function startNewTown({ increment = true } = {}) {
  window.clearTimeout(receiptTimer);
  window.clearTimeout(unlockTimer);
  window.clearTimeout(resultTimer);

  if (increment) townCount += 1;

  const selectedButton = elements.nightButtons.find((button) => button.classList.contains("is-active"));
  const nights = Number(selectedButton.dataset.nights);
  const seed = BASE_SEED + townCount * 7919 + nights * 101;

  state = {
    nights,
    remaining: nights,
    seed,
    town: makeTown(seed, nights),
    exploreIndex: 0,
    best: null,
    total: 0,
    choices: [],
    animating: false
  };

  elements.resultPanel.hidden = true;
  elements.announcer.textContent = "";
  createLedger();
  buildThresholdChart();
  takeDinner("explore", true);
}

elements.explore.addEventListener("click", () => takeDinner("explore"));
elements.return.addEventListener("click", () => takeDinner("return"));
elements.newTown.addEventListener("click", () => startNewTown());
elements.playAgain.addEventListener("click", () => {
  startNewTown();
  elements.explore.focus();
});
elements.resultClose.addEventListener("click", hideResults);

elements.nightButtons.forEach((button) => {
  button.addEventListener("click", () => {
    elements.nightButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    startNewTown();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (!elements.resultPanel.hidden && event.key === "Escape") {
    hideResults();
    return;
  }
  if (!elements.resultPanel.hidden) return;

  const key = event.key.toLowerCase();
  if (key === "e" && !elements.explore.disabled) takeDinner("explore");
  if (key === "r" && !elements.return.disabled) takeDinner("return");
  if (key === "n") startNewTown();
});

startNewTown({ increment: false });
