const RANKS = [
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "B", value: 11 },
  { label: "D", value: 12 },
  { label: "K", value: 13 },
  { label: "A", value: 14 }
];

const SUITS = [
  { key: "spades", symbol: "♠", color: "black", label: "Pik" },
  { key: "hearts", symbol: "♥", color: "red", label: "Herz" },
  { key: "diamonds", symbol: "♦", color: "red", label: "Karo" },
  { key: "clubs", symbol: "♣", color: "black", label: "Kreuz" }
];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const id = `${rank.label}-${suit.symbol}`;
      deck.push({
        id,
        suit: suit.key,
        suitSymbol: suit.symbol,
        rank: rank.label,
        value: rank.value,
        color: suit.color
      });
    }
  }
  return deck;
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(16).slice(2, 10);
}

class DurakGame {
  constructor(options) {
    const defaults = {
      players: [],
      deck: [],
      discard: [],
      table: [],
      trumpCard: null,
      attackerIndex: 0,
      phase: "attack-select",
      status: "running",
      message: "",
      mode: "solo",
      winnerId: null,
      loserId: null,
      log: []
    };

    Object.assign(this, defaults, options || {});

    this.players = (options?.players || []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type || "human",
      hand: (p.hand || []).map((card) => ({ ...card }))
    }));
    this.deck = (options?.deck || []).map((card) => ({ ...card }));
    this.discard = (options?.discard || []).map((card) => ({ ...card }));
    this.table = (options?.table || []).map((pair) => ({
      attack: pair.attack ? { ...pair.attack } : null,
      defense: pair.defense ? { ...pair.defense } : null
    }));
    this.trumpCard = options?.trumpCard ? { ...options.trumpCard } : null;
    this.log = (options?.log || []).map((entry) => ({ ...entry }));
  }

  addLogEntry(type, text, extra = {}) {
    const entry = {
      id: createId(),
      type,
      text,
      timestamp: new Date().toISOString(),
      ...extra
    };
    this.log.push(entry);
    if (this.log.length > 80) {
      this.log.splice(0, this.log.length - 80);
    }
  }

  startNewGame() {
    this.deck = shuffle(createDeck());
    this.discard = [];
    this.table = [];
    this.status = "running";
    this.winnerId = null;
    this.loserId = null;
    this.phase = "attack-select";
    this.log = [];

    this.trumpCard = this.deck[this.deck.length - 1];
    const trumpSuit = this.trumpCard.suit;

    this.players.forEach((player) => {
      player.hand = [];
    });

    for (let i = 0; i < 6; i += 1) {
      this.players.forEach((player) => {
        this.drawCard(player);
      });
    }

    const lowestTrump = this.players
      .map((player, index) => {
        const trumps = player.hand
          .filter((card) => card.suit === trumpSuit)
          .sort((a, b) => a.value - b.value);
        return trumps.length
          ? { index, value: trumps[0].value }
          : { index, value: Infinity };
      })
      .reduce((acc, curr) => (curr.value < acc.value ? curr : acc), {
        index: 0,
        value: Infinity
      });

    this.attackerIndex = lowestTrump.value === Infinity ? 0 : lowestTrump.index;
    const startingPlayer = this.players[this.attackerIndex];
    this.addLogEntry("start", `Neue Runde gestartet. ${startingPlayer.name} greift zuerst an.`, {
      actorId: startingPlayer.id
    });
    this.updateMessage();
  }

  toJSON() {
    return {
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        type: player.type,
        hand: player.hand.map((card) => ({ ...card }))
      })),
      deck: this.deck.map((card) => ({ ...card })),
      discard: this.discard.map((card) => ({ ...card })),
      table: this.table.map((pair) => ({
        attack: pair.attack ? { ...pair.attack } : null,
        defense: pair.defense ? { ...pair.defense } : null
      })),
      trumpCard: this.trumpCard ? { ...this.trumpCard } : null,
      attackerIndex: this.attackerIndex,
      phase: this.phase,
      status: this.status,
      message: this.message,
      mode: this.mode,
      winnerId: this.winnerId,
      loserId: this.loserId,
      log: this.log.map((entry) => ({ ...entry }))
    };
  }

  static fromState(state) {
    return new DurakGame(state);
  }

  drawCard(player) {
    if (!this.deck.length) return null;
    const card = this.deck.shift();
    player.hand.push(card);
    return card;
  }

  get trumpSuit() {
    return this.trumpCard?.suit;
  }

  get currentAttacker() {
    return this.players[this.attackerIndex];
  }

  get defenderIndex() {
    return (this.attackerIndex + 1) % this.players.length;
  }

  get currentDefender() {
    return this.players[this.defenderIndex];
  }

  isCardValidForAttack(card) {
    if (this.table.length === 0) return true;
    const ranksOnTable = new Set();
    this.table.forEach((pair) => {
      if (pair.attack) ranksOnTable.add(pair.attack.rank);
      if (pair.defense) ranksOnTable.add(pair.defense.rank);
    });
    return ranksOnTable.has(card.rank);
  }

  canAddMoreAttacks() {
    const defender = this.currentDefender;
    return (
      this.table.length < defender.hand.length &&
      this.currentAttacker.hand.some((card) => this.isCardValidForAttack(card))
    );
  }

  getValidDefenseCards(attackCard, defender) {
    return defender.hand.filter((card) => this.canDefendCard(card, attackCard));
  }

  canDefendCard(defenseCard, attackCard) {
    if (!defenseCard || !attackCard) return false;
    if (defenseCard.id === attackCard.id) return false;
    if (defenseCard.suit === attackCard.suit) {
      return defenseCard.value > attackCard.value;
    }
    if (defenseCard.suit === this.trumpSuit) {
      if (attackCard.suit !== this.trumpSuit) return true;
      return defenseCard.value > attackCard.value;
    }
    return false;
  }

  playAttackCard(playerId, cardId) {
    if (this.status !== "running") return;
    const attacker = this.currentAttacker;
    if (attacker.id !== playerId) {
      throw new Error("Du bist gerade nicht am Zug zum Angreifen.");
    }
    if (!["attack-select", "attack-throw-in"].includes(this.phase)) {
      throw new Error("Aktuell kann kein Angriff gespielt werden.");
    }
    if (
      this.phase === "attack-throw-in" &&
      this.table.length >= this.currentDefender.hand.length
    ) {
      throw new Error("Der Verteidiger hat nicht genug Karten – Angriff beenden.");
    }
    const cardIndex = attacker.hand.findIndex((card) => card.id === cardId);
    if (cardIndex === -1) throw new Error("Diese Karte befindet sich nicht in deiner Hand.");
    const card = attacker.hand[cardIndex];
    if (!this.isCardValidForAttack(card)) {
      throw new Error("Diese Karte passt nicht zu den ausliegenden Rängen.");
    }
    attacker.hand.splice(cardIndex, 1);
    this.table.push({ attack: card, defense: null });
    this.addLogEntry(
      "attack",
      `${attacker.name} legt ${card.rank}${card.suitSymbol} auf den Tisch.`,
      {
        actorId: attacker.id,
        card: { rank: card.rank, suit: card.suit, suitSymbol: card.suitSymbol }
      }
    );
    this.phase = "defend-select";
    this.updateMessage();
  }

  playDefenseCard(playerId, cardId) {
    if (this.status !== "running") return;
    if (this.phase !== "defend-select") {
      throw new Error("Aktuell wird nicht verteidigt.");
    }
    const defender = this.currentDefender;
    if (defender.id !== playerId) {
      throw new Error("Nur der Verteidiger darf eine Karte ausspielen.");
    }
    const lastPair = this.table[this.table.length - 1];
    if (!lastPair || lastPair.defense) {
      throw new Error("Keine Karte zum Verteidigen vorhanden.");
    }
    const cardIndex = defender.hand.findIndex((card) => card.id === cardId);
    if (cardIndex === -1) throw new Error("Diese Karte ist nicht in deiner Hand.");
    const defenseCard = defender.hand[cardIndex];
    if (!this.canDefendCard(defenseCard, lastPair.attack)) {
      throw new Error("Diese Verteidigung ist nicht erlaubt.");
    }
    defender.hand.splice(cardIndex, 1);
    lastPair.defense = defenseCard;
    this.addLogEntry(
      "defense",
      `${defender.name} verteidigt mit ${defenseCard.rank}${defenseCard.suitSymbol}.`,
      {
        actorId: defender.id,
        card: {
          rank: defenseCard.rank,
          suit: defenseCard.suit,
          suitSymbol: defenseCard.suitSymbol
        }
      }
    );
    if (this.canAddMoreAttacks() && this.currentAttacker.hand.some((card) => this.isCardValidForAttack(card))) {
      this.phase = "attack-throw-in";
    } else if (this.table.every((pair) => pair.defense)) {
      this.phase = "attack-throw-in";
    } else {
      this.phase = "attack-throw-in";
    }
    this.updateMessage();
  }

  defenderTake(playerId) {
    if (this.status !== "running") return;
    if (this.phase !== "defend-select") {
      throw new Error("Nur während der Verteidigung kann aufgenommen werden.");
    }
    if (this.currentDefender.id !== playerId) {
      throw new Error("Nur der Verteidiger kann Karten aufnehmen.");
    }
    const defender = this.currentDefender;
    const takenCards = this.table.reduce((sum, pair) => {
      return sum + (pair.attack ? 1 : 0) + (pair.defense ? 1 : 0);
    }, 0);
    this.table.forEach((pair) => {
      if (pair.attack) defender.hand.push(pair.attack);
      if (pair.defense) defender.hand.push(pair.defense);
    });
    this.table = [];
    this.refillHands(this.attackerIndex);
    this.phase = "attack-select";
    this.addLogEntry(
      "take",
      `${defender.name} nimmt ${takenCards} Karte${takenCards === 1 ? "" : "n"} auf.`,
      {
        actorId: defender.id,
        count: takenCards
      }
    );
    this.updateMessage();
    this.checkForGameOver();
  }

  endAttack(playerId) {
    if (this.status !== "running") return;
    if (this.phase !== "attack-throw-in") {
      throw new Error("Der Angriff kann jetzt nicht beendet werden.");
    }
    if (this.currentAttacker.id !== playerId) {
      throw new Error("Nur der Angreifer kann die Runde beenden.");
    }
    if (!this.table.every((pair) => pair.defense)) {
      throw new Error("Alle Karten müssen verteidigt sein.");
    }
    const defender = this.currentDefender;
    const clearedCards = this.table.reduce((sum, pair) => {
      return sum + (pair.attack ? 1 : 0) + (pair.defense ? 1 : 0);
    }, 0);
    this.table.forEach((pair) => {
      if (pair.attack) this.discard.push(pair.attack);
      if (pair.defense) this.discard.push(pair.defense);
    });
    this.table = [];
    this.attackerIndex = this.defenderIndex;
    this.refillHands(this.attackerIndex);
    this.phase = "attack-select";
    this.addLogEntry(
      "round",
      `${defender.name} verteidigt erfolgreich ${clearedCards} Karte${clearedCards === 1 ? "" : "n"} und greift nun an.`,
      {
        actorId: defender.id,
        count: clearedCards
      }
    );
    this.updateMessage();
    this.checkForGameOver();
  }

  refillHands(startIndex) {
    for (let offset = 0; offset < this.players.length; offset += 1) {
      const index = (startIndex + offset) % this.players.length;
      const player = this.players[index];
      while (player.hand.length < 6 && this.deck.length) {
        this.drawCard(player);
      }
    }
  }

  updateMessage() {
    if (this.status !== "running") {
      if (this.status === "finished" && this.winnerId) {
        const winner = this.players.find((p) => p.id === this.winnerId);
        const loser = this.players.find((p) => p.id === this.loserId);
        this.message = `${winner?.name ?? ""} hat gewonnen. ${loser?.name ?? ""} ist der Durak.`;
      } else if (this.status === "draw") {
        this.message = "Unentschieden! Beide Spieler wurden ihre Karten los.";
      }
      return;
    }

    if (this.phase === "attack-select") {
      this.message = `${this.currentAttacker.name} greift an.`;
    } else if (this.phase === "defend-select") {
      this.message = `${this.currentDefender.name} muss verteidigen.`;
    } else if (this.phase === "attack-throw-in") {
      if (this.table.every((pair) => pair.defense)) {
        this.message = `${this.currentAttacker.name} kann weitere Karten nachlegen oder den Angriff beenden.`;
      } else {
        this.message = `${this.currentDefender.name} verteidigt.`;
      }
    }
  }

  checkForGameOver() {
    if (this.status !== "running") {
      return;
    }
    const deckEmpty = this.deck.length === 0;
    const playersWithoutCards = this.players.filter((p) => p.hand.length === 0);

    if (!deckEmpty) {
      this.updateMessage();
      return;
    }

    if (playersWithoutCards.length === this.players.length) {
      this.status = "draw";
      this.addLogEntry("draw", "Unentschieden – alle Spieler sind ihre Karten los.");
    } else if (playersWithoutCards.length === this.players.length - 1) {
      const winner = playersWithoutCards[0];
      const loser = this.players.find((p) => p.hand.length > 0);
      if (winner && loser) {
        this.status = "finished";
        this.winnerId = winner.id;
        this.loserId = loser.id;
        this.addLogEntry(
          "finish",
          `${winner.name} gewinnt die Runde. ${loser.name} bleibt als Durak zurück.`,
          {
            winnerId: winner.id,
            loserId: loser.id
          }
        );
      }
    }
    this.updateMessage();
  }
}

const AppState = {
  view: "home",
  lobby: null,
  localPlayerId: null,
  game: null,
  mode: "home"
};

const appElement = document.getElementById("app");

function setView(view) {
  AppState.view = view;
  render();
}

function createHomeView() {
  const container = document.createElement("div");
  container.className = "section";
  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Durak Arena";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "Modernes Kartenerlebnis";
  header.appendChild(title);
  header.appendChild(badge);

  const subtitle = document.createElement("p");
  subtitle.textContent = "Wähle deinen Modus: Spiele allein gegen die KI oder teile einen Lobby-Code mit Freunden für ein Duell.";

  const actions = document.createElement("div");
  actions.className = "home-actions";

  const soloCard = document.createElement("div");
  soloCard.className = "section";
  const soloTitle = document.createElement("h2");
  soloTitle.textContent = "Solo spielen";
  const soloText = document.createElement("p");
  soloText.textContent = "Fordere unsere adaptive KI heraus und trainiere deine Durak-Skills.";
  const soloButton = document.createElement("button");
  soloButton.textContent = "Solo starten";
  soloButton.addEventListener("click", () => {
    setView("solo-setup");
  });
  soloCard.appendChild(soloTitle);
  soloCard.appendChild(soloText);
  soloCard.appendChild(soloButton);

  const multiCard = document.createElement("div");
  multiCard.className = "section";
  const multiTitle = document.createElement("h2");
  multiTitle.textContent = "Mit Freunden";
  const multiText = document.createElement("p");
  multiText.textContent = "Erstelle eine Lobby, teile den Code und spielt gemeinsam – komplett im Browser.";
  const multiButton = document.createElement("button");
  multiButton.textContent = "Lobby finden";
  multiButton.addEventListener("click", () => setView("multiplayer"));
  multiCard.appendChild(multiTitle);
  multiCard.appendChild(multiText);
  multiCard.appendChild(multiButton);

  actions.appendChild(soloCard);
  actions.appendChild(multiCard);

  container.appendChild(header);
  container.appendChild(subtitle);
  container.appendChild(actions);
  return container;
}

function createSoloSetupView() {
  const container = document.createElement("div");
  container.className = "section";
  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Solo-Modus";
  header.appendChild(title);

  const form = document.createElement("form");
  form.className = "player-row";
  const label = document.createElement("label");
  label.textContent = "Dein Spielername";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "z. B. Kartengott";
  input.required = true;

  const controls = document.createElement("div");
  controls.className = "controls";
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "secondary";
  backButton.textContent = "Zurück";
  backButton.addEventListener("click", () => setView("home"));

  const startButton = document.createElement("button");
  startButton.type = "submit";
  startButton.textContent = "Spiel starten";

  controls.appendChild(backButton);
  controls.appendChild(startButton);
  form.appendChild(label);
  form.appendChild(input);
  form.appendChild(controls);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim() || "Spieler";
    startSoloGame(name);
  });

  container.appendChild(header);
  container.appendChild(form);
  return container;
}

function startSoloGame(playerName) {
  const game = new DurakGame({
    players: [
      { id: "player", name: playerName, type: "human" },
      { id: "ai", name: "Aurora KI", type: "ai" }
    ],
    mode: "solo"
  });
  game.startNewGame();
  AppState.game = game;
  AppState.localPlayerId = "player";
  AppState.mode = "solo";
  setView("game");
  queueAIMoveIfNeeded();
}

function generateLobbyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    code += alphabet[index];
  }
  return code;
}

function getLobbyStorageKey(code) {
  return `durak_lobby_${code}`;
}

function loadLobby(code) {
  const raw = localStorage.getItem(getLobbyStorageKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Lobby konnte nicht geladen werden", error);
    return null;
  }
}

function saveLobby(lobby) {
  localStorage.setItem(getLobbyStorageKey(lobby.code), JSON.stringify(lobby));
}

function createMultiplayerView() {
  const wrapper = document.createElement("div");
  wrapper.className = "section";
  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Multiplayer Lobby";
  header.appendChild(title);

  const columns = document.createElement("div");
  columns.style.display = "grid";
  columns.style.gridTemplateColumns = "repeat(auto-fit, minmax(280px, 1fr))";
  columns.style.gap = "18px";

  const createSection = document.createElement("div");
  createSection.className = "section";
  const createTitle = document.createElement("h2");
  createTitle.textContent = "Neue Lobby";
  const createText = document.createElement("p");
  createText.textContent = "Erstelle einen Raum und teile den Code mit deinem Mitspieler.";
  const createForm = document.createElement("form");
  createForm.className = "player-row";
  const createLabel = document.createElement("label");
  createLabel.textContent = "Dein Name";
  const createInput = document.createElement("input");
  createInput.type = "text";
  createInput.placeholder = "z. B. Host";
  createInput.required = true;
  const createButton = document.createElement("button");
  createButton.type = "submit";
  createButton.textContent = "Lobby erstellen";

  createForm.appendChild(createLabel);
  createForm.appendChild(createInput);
  createForm.appendChild(createButton);

  createForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = createInput.value.trim() || "Host";
    const code = generateLobbyCode();
    const lobby = {
      code,
      hostId: createId(),
      players: [],
      status: "waiting",
      gameState: null
    };
    const player = { id: lobby.hostId, name, type: "human" };
    lobby.players.push(player);
    saveLobby(lobby);
    AppState.lobby = lobby;
    AppState.localPlayerId = lobby.hostId;
    AppState.mode = "lobby";
    sessionStorage.setItem(`durak_local_${code}`, lobby.hostId);
    setView("lobby");
  });

  createSection.appendChild(createTitle);
  createSection.appendChild(createText);
  createSection.appendChild(createForm);

  const joinSection = document.createElement("div");
  joinSection.className = "section";
  const joinTitle = document.createElement("h2");
  joinTitle.textContent = "Lobby beitreten";
  const joinText = document.createElement("p");
  joinText.textContent = "Gib den Code ein, um die Lobby zu betreten.";
  const joinForm = document.createElement("form");
  joinForm.className = "player-row";

  const codeLabel = document.createElement("label");
  codeLabel.textContent = "Code";
  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.placeholder = "ABCDE";
  codeInput.required = true;
  codeInput.maxLength = 5;
  codeInput.style.textTransform = "uppercase";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Dein Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "z. B. Gast";
  nameInput.required = true;

  const joinButton = document.createElement("button");
  joinButton.type = "submit";
  joinButton.textContent = "Beitreten";

  joinForm.appendChild(codeLabel);
  joinForm.appendChild(codeInput);
  joinForm.appendChild(nameLabel);
  joinForm.appendChild(nameInput);
  joinForm.appendChild(joinButton);

  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim() || "Gast";
    const lobby = loadLobby(code);
    if (!lobby) {
      alert("Keine Lobby mit diesem Code gefunden.");
      return;
    }
    if (lobby.status === "playing") {
      alert("Diese Lobby spielt bereits.");
      return;
    }
    if (lobby.players.length >= 2) {
      alert("Die Lobby ist bereits voll.");
      return;
    }
    const playerId = createId();
    lobby.players.push({ id: playerId, name, type: "human" });
    saveLobby(lobby);
    AppState.lobby = lobby;
    AppState.localPlayerId = playerId;
    AppState.mode = "lobby";
    sessionStorage.setItem(`durak_local_${code}`, playerId);
    setView("lobby");
  });

  joinSection.appendChild(joinTitle);
  joinSection.appendChild(joinText);
  joinSection.appendChild(joinForm);

  columns.appendChild(createSection);
  columns.appendChild(joinSection);

  const backButton = document.createElement("button");
  backButton.className = "secondary";
  backButton.textContent = "Zur Startseite";
  backButton.addEventListener("click", () => setView("home"));

  wrapper.appendChild(header);
  wrapper.appendChild(columns);
  wrapper.appendChild(backButton);
  return wrapper;
}

function createLobbyView() {
  const lobby = AppState.lobby;
  if (!lobby) {
    setView("multiplayer");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "section";

  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Deine Lobby";
  header.appendChild(title);

  const codeDisplay = document.createElement("div");
  codeDisplay.className = "lobby-code";
  codeDisplay.textContent = lobby.code;

  const playerList = document.createElement("div");
  playerList.className = "player-row";

  lobby.players.forEach((player) => {
    const tag = document.createElement("div");
    tag.className = "player-tag";
    tag.textContent = player.name;
    if (player.id === lobby.hostId) {
      tag.textContent += " • Host";
    }
    if (player.id === AppState.localPlayerId) {
      tag.textContent += " • Du";
    }
    playerList.appendChild(tag);
  });

  const info = document.createElement("p");
  info.textContent = lobby.players.length < 2
    ? "Warte auf einen weiteren Spieler..."
    : lobby.hostId === AppState.localPlayerId
      ? "Alle bereit. Du kannst das Spiel starten."
      : "Warte darauf, dass der Host das Spiel startet.";

  container.appendChild(header);
  container.appendChild(codeDisplay);
  container.appendChild(playerList);
  container.appendChild(info);

  if (lobby.hostId === AppState.localPlayerId) {
    const startButton = document.createElement("button");
    startButton.textContent = "Spiel starten";
    startButton.disabled = lobby.players.length < 2;
    startButton.addEventListener("click", () => {
      const current = loadLobby(lobby.code);
      if (!current) return;
      current.status = "playing";
      const game = new DurakGame({
        players: current.players,
        mode: "lobby"
      });
      game.startNewGame();
      current.gameState = game.toJSON();
      saveLobby(current);
      AppState.game = game;
      AppState.lobby = current;
      AppState.mode = "lobby";
      setView("game");
    });
    container.appendChild(startButton);
  }

  const leaveButton = document.createElement("button");
  leaveButton.className = "secondary";
  leaveButton.textContent = "Lobby verlassen";
  leaveButton.addEventListener("click", () => {
    leaveLobby();
    setView("home");
  });

  container.appendChild(leaveButton);
  return container;
}

function leaveLobby() {
  const lobby = AppState.lobby;
  if (!lobby) return;
  const updated = loadLobby(lobby.code);
  if (updated) {
    updated.players = updated.players.filter((player) => player.id !== AppState.localPlayerId);
    if (!updated.players.length) {
      localStorage.removeItem(getLobbyStorageKey(updated.code));
    } else {
      if (updated.hostId === AppState.localPlayerId) {
        updated.hostId = updated.players[0].id;
      }
      saveLobby(updated);
    }
  }
  sessionStorage.removeItem(`durak_local_${lobby.code}`);
  AppState.lobby = null;
  AppState.game = null;
  AppState.localPlayerId = null;
  AppState.mode = "home";
}

function createCardElement(card, options = {}) {
  const cardElement = document.createElement("div");
  cardElement.className = "card";
  if (options.hidden) {
    cardElement.classList.add("card-back");
    cardElement.textContent = "Durak";
    return cardElement;
  }

  if (options.disabled) {
    cardElement.classList.add("disabled");
  }

  if (options.selectable) {
    cardElement.dataset.cardId = card.id;
    cardElement.addEventListener("click", () => {
      options.onSelect?.(card);
    });
  }

  const rankTop = document.createElement("span");
  rankTop.className = "rank";
  rankTop.textContent = card.rank;
  rankTop.style.color = card.color === "red" ? "#d6497e" : "#15223b";

  const suit = document.createElement("span");
  suit.className = "suit";
  suit.textContent = card.suitSymbol;
  suit.style.color = card.color === "red" ? "#d6497e" : "#15223b";

  const rankBottom = document.createElement("span");
  rankBottom.className = "rank";
  rankBottom.textContent = card.rank;
  rankBottom.style.alignSelf = "flex-end";
  rankBottom.style.color = card.color === "red" ? "#d6497e" : "#15223b";

  cardElement.appendChild(rankTop);
  cardElement.appendChild(suit);
  cardElement.appendChild(rankBottom);
  return cardElement;
}

function renderTable(game, localPlayerId) {
  const table = document.createElement("div");
  table.className = "table";

  if (!game.table.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "message";
    placeholder.textContent = "Der Tisch ist frei. Der Angreifer wählt eine Karte.";
    table.appendChild(placeholder);
    return table;
  }

  game.table.forEach((pair) => {
    const slot = document.createElement("div");
    slot.className = "table-slot";
    if (pair.attack) {
      slot.appendChild(createCardElement(pair.attack));
    }
    if (pair.defense) {
      slot.appendChild(createCardElement(pair.defense));
    }
    table.appendChild(slot);
  });
  return table;
}

function renderPlayerSection(game, player, localPlayerId) {
  const wrapper = document.createElement("div");
  wrapper.className = "section";

  const header = document.createElement("div");
  header.className = "player-header";
  const title = document.createElement("h3");
  title.textContent = player.name;
  const badge = document.createElement("span");
  badge.className = "badge";
  if (player.id === game.currentAttacker.id) {
    badge.textContent = "Angriff";
  } else if (player.id === game.currentDefender.id) {
    badge.textContent = "Verteidigung";
  } else {
    badge.textContent = "Zuschauer";
  }
  header.appendChild(title);
  header.appendChild(badge);

  const hand = document.createElement("div");
  hand.className = "player-hand";

  const isLocal = player.id === localPlayerId || player.type === "ai";
  const isAttacker = player.id === game.currentAttacker.id;
  const isDefender = player.id === game.currentDefender.id;

  let selectableCards = [];
  if (game.status === "running" && isLocal) {
    if (isAttacker && ["attack-select", "attack-throw-in"].includes(game.phase)) {
      selectableCards = player.hand.filter((card) => game.isCardValidForAttack(card));
    } else if (isDefender && game.phase === "defend-select") {
      const lastPair = game.table[game.table.length - 1];
      selectableCards = lastPair
        ? game.getValidDefenseCards(lastPair.attack, player)
        : [];
    }
  }

  player.hand.forEach((card) => {
    const hidden = !isLocal;
    const selectable = selectableCards.some((selectableCard) => selectableCard.id === card.id);
    const cardElement = createCardElement(card, {
      hidden,
      selectable,
      disabled: !selectable,
      onSelect: (selectedCard) => {
        if (isAttacker) {
          handleAttackCard(selectedCard);
        } else if (isDefender) {
          handleDefenseCard(selectedCard);
        }
      }
    });
    hand.appendChild(cardElement);
  });

  wrapper.appendChild(header);
  wrapper.appendChild(hand);

  if (isLocal && isDefender && game.phase === "defend-select") {
    const controls = document.createElement("div");
    controls.className = "controls";
    const takeButton = document.createElement("button");
    takeButton.className = "secondary";
    takeButton.textContent = "Aufnehmen";
    takeButton.addEventListener("click", () => {
      try {
        game.defenderTake(player.id);
        afterGameInteraction();
      } catch (error) {
        showToast(error.message);
      }
    });
    controls.appendChild(takeButton);
    wrapper.appendChild(controls);
  }

  if (isLocal && isAttacker && game.phase === "attack-throw-in" && game.table.every((pair) => pair.defense)) {
    const controls = document.createElement("div");
    controls.className = "controls";
    const endButton = document.createElement("button");
    endButton.textContent = "Angriff beenden";
    endButton.addEventListener("click", () => {
      try {
        game.endAttack(player.id);
        afterGameInteraction();
      } catch (error) {
        showToast(error.message);
      }
    });
    controls.appendChild(endButton);
    wrapper.appendChild(controls);
  }

  return wrapper;
}

function renderGameMeta(game) {
  const meta = document.createElement("div");
  meta.className = "game-meta";

  const trumpBlock = document.createElement("div");
  trumpBlock.className = "meta-block";
  const trumpTitle = document.createElement("span");
  trumpTitle.className = "meta-title";
  trumpTitle.textContent = "Trumpf";
  const trumpValue = document.createElement("div");
  trumpValue.style.display = "flex";
  trumpValue.style.alignItems = "center";
  trumpValue.style.gap = "12px";
  if (game.trumpCard) {
    trumpValue.appendChild(createCardElement(game.trumpCard));
    const suitName = SUITS.find((suit) => suit.key === game.trumpCard.suit)?.label ?? "";
    const text = document.createElement("span");
    text.textContent = suitName;
    trumpValue.appendChild(text);
  }
  trumpBlock.appendChild(trumpTitle);
  trumpBlock.appendChild(trumpValue);

  const deckBlock = document.createElement("div");
  deckBlock.className = "meta-block";
  const deckTitle = document.createElement("span");
  deckTitle.className = "meta-title";
  deckTitle.textContent = "Restkarten";
  const deckCount = document.createElement("span");
  deckCount.textContent = `${game.deck.length} Karten im Stapel`;
  deckBlock.appendChild(deckTitle);
  deckBlock.appendChild(deckCount);

  const discardBlock = document.createElement("div");
  discardBlock.className = "meta-block";
  const discardTitle = document.createElement("span");
  discardTitle.className = "meta-title";
  discardTitle.textContent = "Ablage";
  const discardCount = document.createElement("span");
  discardCount.textContent = `${game.discard.length} Karten abgelegt`;
  discardBlock.appendChild(discardTitle);
  discardBlock.appendChild(discardCount);

  meta.appendChild(trumpBlock);
  meta.appendChild(deckBlock);
  meta.appendChild(discardBlock);
  return meta;
}

function renderLogSection(game) {
  const section = document.createElement("div");
  section.className = "section log-section";

  const header = document.createElement("div");
  header.className = "player-header";
  const title = document.createElement("h3");
  title.textContent = "Spielverlauf";
  header.appendChild(title);
  section.appendChild(header);

  if (!game.log.length) {
    const empty = document.createElement("p");
    empty.className = "log-empty";
    empty.textContent = "Noch keine Aktionen protokolliert.";
    section.appendChild(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "log-list";
  const entries = [...game.log].slice(-8).reverse();
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = `log-entry log-entry-${entry.type}`;
    const text = document.createElement("span");
    text.textContent = entry.text;
    const time = document.createElement("time");
    time.dateTime = entry.timestamp;
    try {
      time.textContent = new Date(entry.timestamp).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      time.textContent = "";
    }
    item.appendChild(text);
    item.appendChild(time);
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function renderGameView() {
  const game = AppState.game;
  if (!game) {
    setView("home");
    return document.createElement("div");
  }

  const container = document.createElement("div");
  container.className = "section";

  const header = document.createElement("header");
  const title = document.createElement("h1");
  title.textContent = "Durak";
  header.appendChild(title);

  const backButton = document.createElement("button");
  backButton.className = "secondary";
  backButton.textContent = "Beenden";
  backButton.addEventListener("click", () => {
    if (AppState.lobby) {
      leaveLobby();
    }
    AppState.game = null;
    AppState.mode = "home";
    setView("home");
  });
  header.appendChild(backButton);

  const message = document.createElement("div");
  message.className = "message";
  message.textContent = game.message;

  container.appendChild(header);
  container.appendChild(renderGameMeta(game));
  container.appendChild(message);
  container.appendChild(renderTable(game, AppState.localPlayerId));

  game.players.forEach((player) => {
    container.appendChild(renderPlayerSection(game, player, AppState.localPlayerId));
  });

  container.appendChild(renderLogSection(game));

  if (game.status !== "running") {
    const restartButton = document.createElement("button");
    restartButton.textContent = "Neu starten";
    restartButton.addEventListener("click", () => {
      if (AppState.mode === "solo") {
        AppState.game.startNewGame();
        queueAIMoveIfNeeded();
        render();
      } else if (AppState.lobby) {
        const lobby = loadLobby(AppState.lobby.code);
        if (!lobby) return;
        const gameInstance = new DurakGame({
          players: lobby.players,
          mode: "lobby"
        });
        gameInstance.startNewGame();
        lobby.gameState = gameInstance.toJSON();
        lobby.status = "playing";
        saveLobby(lobby);
        AppState.lobby = lobby;
        AppState.game = gameInstance;
        synchronizeGameState();
        render();
      }
    });
    container.appendChild(restartButton);
  }

  return container;
}

let toastTimeout = null;
function showToast(text) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "rgba(15, 23, 42, 0.9)";
    toast.style.color = "white";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "12px";
    toast.style.border = "1px solid rgba(255, 255, 255, 0.2)";
    toast.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.35)";
    toast.style.fontSize = "14px";
    toast.style.zIndex = "100";
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = "1";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2200);
}

function handleAttackCard(card) {
  try {
    AppState.game.playAttackCard(AppState.localPlayerId, card.id);
    afterGameInteraction();
  } catch (error) {
    showToast(error.message);
  }
}

function handleDefenseCard(card) {
  try {
    AppState.game.playDefenseCard(AppState.localPlayerId, card.id);
    afterGameInteraction();
  } catch (error) {
    showToast(error.message);
  }
}

function afterGameInteraction() {
  synchronizeGameState();
  render();
  queueAIMoveIfNeeded();
}

function queueAIMoveIfNeeded() {
  const game = AppState.game;
  if (!game || game.status !== "running") return;
  const currentPlayer = game.currentAttacker;
  if (game.phase === "defend-select") {
    const defender = game.currentDefender;
    if (defender.type === "ai") {
      setTimeout(() => executeAIDefense(defender), 700);
    }
    return;
  }
  if (["attack-select", "attack-throw-in"].includes(game.phase) && currentPlayer.type === "ai") {
    setTimeout(() => executeAIAttack(currentPlayer), 700);
  }
}

function executeAIAttack(aiPlayer) {
  const game = AppState.game;
  if (!game || game.status !== "running") return;
  if (game.currentAttacker.id !== aiPlayer.id) return;

  const validCards = aiPlayer.hand.filter((card) => game.isCardValidForAttack(card));
  if (!validCards.length) {
    if (game.table.every((pair) => pair.defense)) {
      try {
        game.endAttack(aiPlayer.id);
      } catch (error) {
        console.error(error);
      }
      afterGameInteraction();
    }
    return;
  }

  const sorted = validCards.sort((a, b) => {
    const aTrump = a.suit === game.trumpSuit;
    const bTrump = b.suit === game.trumpSuit;
    if (aTrump && !bTrump) return 1;
    if (!aTrump && bTrump) return -1;
    return a.value - b.value;
  });

  const card = sorted[0];
  try {
    game.playAttackCard(aiPlayer.id, card.id);
  } catch (error) {
    console.error(error);
    return;
  }
  render();
  synchronizeGameState();
  queueAIMoveIfNeeded();
}

function executeAIDefense(aiPlayer) {
  const game = AppState.game;
  if (!game || game.status !== "running") return;
  if (game.currentDefender.id !== aiPlayer.id) return;

  const lastPair = game.table[game.table.length - 1];
  if (!lastPair) return;
  const valid = game.getValidDefenseCards(lastPair.attack, aiPlayer);
  if (!valid.length) {
    try {
      game.defenderTake(aiPlayer.id);
    } catch (error) {
      console.error(error);
    }
    afterGameInteraction();
    return;
  }

  const sorted = valid.sort((a, b) => {
    const aTrump = a.suit === game.trumpSuit;
    const bTrump = b.suit === game.trumpSuit;
    if (aTrump && !bTrump) return 1;
    if (!aTrump && bTrump) return -1;
    return a.value - b.value;
  });

  const card = sorted[0];
  try {
    game.playDefenseCard(aiPlayer.id, card.id);
  } catch (error) {
    console.error(error);
    return;
  }
  render();
  synchronizeGameState();
  queueAIMoveIfNeeded();
}

function synchronizeGameState() {
  if (!AppState.lobby || !AppState.game) return;
  const lobby = loadLobby(AppState.lobby.code);
  if (!lobby) return;
  lobby.status = AppState.game.status === "running" ? "playing" : "finished";
  lobby.gameState = AppState.game.toJSON();
  saveLobby(lobby);
}

function applyLobbyGameState(lobby) {
  if (!lobby || !lobby.gameState) return;
  AppState.game = DurakGame.fromState(lobby.gameState);
  AppState.mode = "lobby";
  AppState.view = "game";
  render();
  queueAIMoveIfNeeded();
}

function restoreSession() {
  if (!AppState.lobby) return;
  const storedId = sessionStorage.getItem(`durak_local_${AppState.lobby.code}`);
  if (storedId) {
    AppState.localPlayerId = storedId;
  }
}

function bootstrapFromSession() {
  const sessionKeys = Object.keys(sessionStorage).filter((key) => key.startsWith("durak_local_"));
  if (!sessionKeys.length) return;
  const key = sessionKeys[0];
  const code = key.replace("durak_local_", "");
  const playerId = sessionStorage.getItem(key);
  if (!playerId) return;
  const lobby = loadLobby(code);
  if (!lobby) {
    sessionStorage.removeItem(key);
    return;
  }
  AppState.lobby = lobby;
  AppState.localPlayerId = playerId;
  AppState.mode = "lobby";
  if (lobby.status === "playing" && lobby.gameState) {
    AppState.game = DurakGame.fromState(lobby.gameState);
    AppState.view = "game";
  } else {
    AppState.view = "lobby";
  }
}

window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith("durak_lobby_")) return;
  const code = event.key.replace("durak_lobby_", "");
  if (!AppState.lobby || AppState.lobby.code !== code) return;
  const lobby = loadLobby(code);
  if (!lobby) return;
  AppState.lobby = lobby;
  if (lobby.status === "playing" && lobby.gameState) {
    applyLobbyGameState(lobby);
  } else {
    render();
  }
});

function render() {
  appElement.innerHTML = "";
  let view;
  switch (AppState.view) {
    case "home":
      view = createHomeView();
      break;
    case "solo-setup":
      view = createSoloSetupView();
      break;
    case "multiplayer":
      view = createMultiplayerView();
      break;
    case "lobby":
      view = createLobbyView();
      break;
    case "game":
      view = renderGameView();
      break;
    default:
      view = createHomeView();
  }
  appElement.appendChild(view);
}

bootstrapFromSession();
render();
