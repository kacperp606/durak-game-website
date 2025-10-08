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

const STORAGE_KEYS = {
  SOLO_STATE: "durak_solo_state",
  SOLO_PLAYER: "durak_solo_player"
};

const SEAT_ORDER = ["south", "west", "north", "east"];
const SUIT_ORDER = ["clubs", "diamonds", "hearts", "spades"];
const SOLO_AI_NAMES = ["West", "Nord", "Ost"];

const TableState = {
  mode: null,
  game: null,
  lobby: null,
  lobbyCode: null,
  localPlayerId: null,
  aiTimeout: null
};

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
  if (!code) return null;
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

function removeLobby(code) {
  localStorage.removeItem(getLobbyStorageKey(code));
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function uppercaseCode(value) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

let toastTimeout = null;
function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) {
    console.log(text);
    return;
  }
  toast.textContent = text;
  toast.hidden = false;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
    toast.hidden = true;
  }, 2400);
}

function initHomePage() {
  // Home-Seite benötigt keine spezielle Logik.
}

function initSetupPage() {
  const mode = getQueryParam("mode") || "solo";
  const soloSection = document.querySelector('.setup-panel[data-mode="solo"]');
  const multiSection = document.querySelector('.setup-panel[data-mode="multiplayer"]');
  if (soloSection) soloSection.hidden = mode !== "solo";
  if (multiSection) multiSection.hidden = mode !== "multiplayer";

  if (mode === "solo") {
    const form = document.getElementById("soloForm");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = (formData.get("player") || "Spieler").toString().trim() || "Spieler";
      const playerId = createId();
      const players = [
        { id: playerId, name, type: "human" }
      ];
      SOLO_AI_NAMES.forEach((aiName) => {
        players.push({ id: createId(), name: aiName, type: "ai" });
      });
      const game = new DurakGame({ players, mode: "solo" });
      game.startNewGame();
      TableState.mode = "solo";
      TableState.game = game;
      TableState.localPlayerId = playerId;
      persistSoloState();
      sessionStorage.setItem(STORAGE_KEYS.SOLO_PLAYER, playerId);
      window.location.href = "table.html?mode=solo";
    });
  } else {
    const createForm = document.getElementById("createLobbyForm");
    const joinForm = document.getElementById("joinLobbyForm");

    if (createForm) {
      createForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(createForm);
        const name = (formData.get("host") || "Host").toString().trim() || "Host";
        const code = generateLobbyCode();
        const hostId = createId();
        const lobby = {
          code,
          hostId,
          players: [{ id: hostId, name, type: "human" }],
          status: "waiting",
          gameState: null,
          createdAt: new Date().toISOString()
        };
        saveLobby(lobby);
        sessionStorage.setItem(`durak_local_${code}`, hostId);
        window.location.href = `lobby.html?code=${code}`;
      });
    }

    if (joinForm) {
      joinForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(joinForm);
        const rawCode = (formData.get("code") || "").toString();
        const name = (formData.get("guest") || "Gast").toString().trim() || "Gast";
        const code = uppercaseCode(rawCode);
        if (code.length !== 5) {
          showToast("Bitte gib einen gültigen Code ein.");
          return;
        }
        const lobby = loadLobby(code);
        if (!lobby) {
          showToast("Diese Lobby existiert nicht.");
          return;
        }
        if (lobby.status === "playing") {
          showToast("Das Spiel läuft bereits.");
          return;
        }
        if (lobby.players.length >= 4) {
          showToast("Alle vier Plätze sind bereits besetzt.");
          return;
        }
        const playerId = createId();
        lobby.players.push({ id: playerId, name, type: "human" });
        saveLobby(lobby);
        sessionStorage.setItem(`durak_local_${code}`, playerId);
        window.location.href = `lobby.html?code=${code}`;
      });
    }
  }
}

function initLobbyPage() {
  const code = uppercaseCode(getQueryParam("code") || "");
  const seatsElement = document.getElementById("lobbySeats");
  const messageElement = document.getElementById("lobbyMessage");
  const codeElement = document.getElementById("lobbyCode");
  const startButton = document.getElementById("startGameButton");
  const leaveButton = document.getElementById("leaveLobbyButton");
  const logElement = document.getElementById("lobbyLog");

  if (!code) {
    messageElement.textContent = "Kein Lobby-Code angegeben.";
    if (startButton) startButton.disabled = true;
    if (seatsElement) seatsElement.innerHTML = "";
    return;
  }

  codeElement.textContent = code;
  let lobby = loadLobby(code);
  if (!lobby) {
    messageElement.textContent = "Die Lobby wurde nicht gefunden.";
    if (startButton) startButton.disabled = true;
    return;
  }

  let localPlayerId = sessionStorage.getItem(`durak_local_${code}`);
  if (!localPlayerId) {
    const firstPlayer = lobby.players[0];
    if (firstPlayer) {
      localPlayerId = firstPlayer.id;
      sessionStorage.setItem(`durak_local_${code}`, localPlayerId);
    }
  }

  function renderLobby() {
    lobby = loadLobby(code);
    if (!lobby) {
      messageElement.textContent = "Die Lobby wurde geschlossen.";
      if (seatsElement) seatsElement.innerHTML = "";
      if (startButton) startButton.disabled = true;
      return;
    }

    if (lobby.status === "playing" && lobby.gameState) {
      window.location.href = `table.html?mode=lobby&code=${code}`;
      return;
    }

    const seats = lobby.players;
    const seatLabels = ["Süd", "West", "Nord", "Ost"];
    if (seatsElement) {
      seatsElement.innerHTML = "";
      for (let i = 0; i < 4; i += 1) {
        const container = document.createElement("div");
        container.className = "lobby-seat";
        const headline = document.createElement("h3");
        headline.textContent = seatLabels[i];
        container.appendChild(headline);
        if (seats[i]) {
          const player = seats[i];
          const name = document.createElement("p");
          name.className = "seat-name";
          name.textContent = player.name;
          container.appendChild(name);
          const tags = document.createElement("span");
          tags.className = "seat-tags";
          const parts = [];
          if (player.id === lobby.hostId) parts.push("Host");
          if (player.id === localPlayerId) parts.push("Du");
          if (player.type === "ai") parts.push("KI");
          tags.textContent = parts.join(" • ");
          container.appendChild(tags);
        } else {
          const empty = document.createElement("p");
          empty.className = "seat-empty";
          empty.textContent = "Frei";
          container.appendChild(empty);
        }
        seatsElement.appendChild(container);
      }
    }

    const missing = 4 - seats.length;
    if (missing > 0) {
      messageElement.textContent = `Es fehlen noch ${missing} Spieler für den Vierer-Tisch.`;
    } else {
      messageElement.textContent = "Alle Plätze besetzt. Host kann das Spiel starten.";
    }

    if (logElement) {
      logElement.innerHTML = "";
      const entries = lobby.gameState?.log || [];
      if (!entries.length) {
        const empty = document.createElement("li");
        empty.textContent = "Noch keine Aktionen aufgezeichnet.";
        logElement.appendChild(empty);
      } else {
        entries
          .slice(-6)
          .reverse()
          .forEach((entry) => {
            const item = document.createElement("li");
            item.textContent = `${formatTime(entry.timestamp)} – ${entry.text}`;
            logElement.appendChild(item);
          });
      }
    }

    if (startButton) {
      const isHost = lobby.hostId === localPlayerId;
      startButton.disabled = !isHost || lobby.players.length < 4;
      startButton.textContent = lobby.players.length < 4 ? "Warte auf Mitspieler" : "Spiel beginnen";
    }
  }

  renderLobby();

  if (startButton) {
    startButton.addEventListener("click", () => {
      lobby = loadLobby(code);
      if (!lobby) {
        showToast("Lobby nicht mehr vorhanden.");
        return;
      }
      if (lobby.hostId !== localPlayerId) {
        showToast("Nur der Host kann starten.");
        return;
      }
      if (lobby.players.length < 4) {
        showToast("Für den Tisch werden vier Spieler benötigt.");
        return;
      }
      const game = new DurakGame({ players: lobby.players, mode: "lobby" });
      game.startNewGame();
      lobby.status = "playing";
      lobby.gameState = game.toJSON();
      saveLobby(lobby);
      window.location.href = `table.html?mode=lobby&code=${code}`;
    });
  }

  if (leaveButton) {
    leaveButton.addEventListener("click", () => {
      leaveLobby(code, localPlayerId);
      window.location.href = "setup.html?mode=multiplayer";
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== getLobbyStorageKey(code)) return;
    renderLobby();
  });
}

function leaveLobby(code, playerId) {
  if (!code || !playerId) return;
  const lobby = loadLobby(code);
  if (!lobby) return;
  lobby.players = lobby.players.filter((player) => player.id !== playerId);
  if (!lobby.players.length) {
    removeLobby(code);
  } else {
    if (lobby.hostId === playerId) {
      lobby.hostId = lobby.players[0].id;
    }
    lobby.status = "waiting";
    lobby.gameState = null;
    saveLobby(lobby);
  }
  sessionStorage.removeItem(`durak_local_${code}`);
}

function initTablePage() {
  const mode = getQueryParam("mode") || "solo";
  TableState.mode = mode;
  const restartButton = document.getElementById("restartButton");
  const backLink = document.getElementById("backToLobby");

  if (mode === "solo") {
    const rawState = localStorage.getItem(STORAGE_KEYS.SOLO_STATE);
    if (!rawState) {
      window.location.replace("setup.html?mode=solo");
      return;
    }
    let state;
    try {
      state = JSON.parse(rawState);
    } catch (error) {
      console.error(error);
      localStorage.removeItem(STORAGE_KEYS.SOLO_STATE);
      window.location.replace("setup.html?mode=solo");
      return;
    }
    TableState.game = DurakGame.fromState(state.game);
    TableState.localPlayerId = state.localPlayerId;
    if (!TableState.localPlayerId) {
      TableState.localPlayerId = sessionStorage.getItem(STORAGE_KEYS.SOLO_PLAYER);
    }
    renderTable();
    queueAIMoveIfNeeded();
    if (backLink) backLink.href = "index.html";
  } else {
    const code = uppercaseCode(getQueryParam("code") || "");
    if (!code) {
      window.location.replace("setup.html?mode=multiplayer");
      return;
    }
    const lobby = loadLobby(code);
    if (!lobby) {
      showToast("Lobby nicht gefunden.");
      window.location.replace("setup.html?mode=multiplayer");
      return;
    }
    if (lobby.status !== "playing" || !lobby.gameState) {
      window.location.replace(`lobby.html?code=${code}`);
      return;
    }
    const playerId = sessionStorage.getItem(`durak_local_${code}`);
    if (!playerId) {
      window.location.replace(`lobby.html?code=${code}`);
      return;
    }
    TableState.lobby = lobby;
    TableState.lobbyCode = code;
    TableState.game = DurakGame.fromState(lobby.gameState);
    TableState.localPlayerId = playerId;
    renderTable();
    if (backLink) backLink.href = `lobby.html?code=${code}`;

    window.addEventListener("storage", handleTableStorageSync);
  }

  if (restartButton) {
    restartButton.addEventListener("click", handleRestart);
  }
}

function persistSoloState() {
  if (TableState.mode !== "solo" || !TableState.game) return;
  const payload = {
    localPlayerId: TableState.localPlayerId,
    game: TableState.game.toJSON()
  };
  localStorage.setItem(STORAGE_KEYS.SOLO_STATE, JSON.stringify(payload));
}

function persistLobbyState() {
  if (TableState.mode !== "lobby" || !TableState.lobbyCode || !TableState.game) return;
  const lobby = loadLobby(TableState.lobbyCode);
  if (!lobby) {
    showToast("Lobby wurde geschlossen.");
    return;
  }
  lobby.gameState = TableState.game.toJSON();
  lobby.status = TableState.game.status === "running" ? "playing" : "finished";
  saveLobby(lobby);
  TableState.lobby = lobby;
}

function afterInteraction() {
  if (TableState.mode === "solo") {
    persistSoloState();
  } else {
    persistLobbyState();
  }
  renderTable();
  queueAIMoveIfNeeded();
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.suit === b.suit) {
      return a.value - b.value;
    }
    return SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  });
}

function getSeatAssignments(game, localPlayerId) {
  const assignments = [];
  if (!game) return assignments;
  let localIndex = game.players.findIndex((player) => player.id === localPlayerId);
  if (localIndex === -1) {
    localIndex = 0;
  }
  const total = game.players.length;
  const offsets = [0, 1, 2, 3];
  offsets.forEach((offset, seatIndex) => {
    const playerIndex = (localIndex + offset) % total;
    const player = game.players[playerIndex];
    assignments.push({
      seat: SEAT_ORDER[seatIndex],
      player,
      isLocal: seatIndex === 0
    });
  });
  return assignments;
}

function renderTable() {
  const game = TableState.game;
  if (!game) return;

  document.getElementById("deckCount").textContent = `${game.deck.length}`;
  document.getElementById("discardCount").textContent = `${game.discard.length}`;
  const messageElement = document.getElementById("gameMessage");
  messageElement.textContent = game.message;

  const trumpContainer = document.getElementById("trumpCard");
  if (trumpContainer) {
    trumpContainer.innerHTML = "";
    if (game.trumpCard) {
      trumpContainer.appendChild(createCardElement(game.trumpCard, { small: true }));
    }
  }

  const tablePairs = document.getElementById("tablePairs");
  if (tablePairs) {
    tablePairs.innerHTML = "";
    game.table.forEach((pair) => {
      const group = document.createElement("div");
      group.className = "pair";
      const attackWrapper = document.createElement("div");
      attackWrapper.className = "pair-card attack";
      if (pair.attack) {
        attackWrapper.appendChild(createCardElement(pair.attack));
      }
      const defenseWrapper = document.createElement("div");
      defenseWrapper.className = "pair-card defense";
      if (pair.defense) {
        defenseWrapper.appendChild(createCardElement(pair.defense));
      }
      group.appendChild(attackWrapper);
      group.appendChild(defenseWrapper);
      tablePairs.appendChild(group);
    });
  }

  const assignments = getSeatAssignments(game, TableState.localPlayerId);
  assignments.forEach(({ seat, player, isLocal }) => {
    const seatElement = document.querySelector(`.seat-${seat}`);
    if (!seatElement) return;
    const nameElement = seatElement.querySelector(".seat-name");
    const statusElement = seatElement.querySelector(".seat-status");
    const cardsElement = seatElement.querySelector(".seat-cards");

    if (!player) {
      seatElement.classList.add("seat-empty");
      if (nameElement) nameElement.textContent = "Leer";
      if (statusElement) statusElement.textContent = "";
      if (cardsElement) cardsElement.innerHTML = "";
      return;
    }

    seatElement.classList.toggle("seat-local", isLocal);
    seatElement.classList.toggle("seat-attacker", player.id === game.currentAttacker.id);
    seatElement.classList.toggle("seat-defender", player.id === game.currentDefender.id);

    if (nameElement) {
      nameElement.textContent = isLocal ? `${player.name} (Du)` : player.name;
    }
    if (statusElement) {
      const badges = [];
      if (player.id === game.currentAttacker.id) badges.push("Angriff");
      if (player.id === game.currentDefender.id) badges.push("Verteidigung");
      if (player.hand.length === 0) badges.push("fertig");
      if (player.type === "ai" && !isLocal) badges.push("KI");
      statusElement.textContent = badges.join(" • ");
    }
    if (!cardsElement) return;
    cardsElement.innerHTML = "";
    if (isLocal) {
      const sorted = sortHand(player.hand);
      sorted.forEach((card) => {
        const cardElement = createCardElement(card);
        cardElement.dataset.cardId = card.id;
        cardElement.tabIndex = 0;
        cardElement.setAttribute("role", "button");
        cardElement.setAttribute("aria-label", `${card.rank}${card.suitSymbol}`);
        cardElement.addEventListener("click", () => handleCardClick(card.id));
        cardElement.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCardClick(card.id);
          }
        });
        cardsElement.appendChild(cardElement);
      });
    } else {
      for (let i = 0; i < player.hand.length; i += 1) {
        const back = document.createElement("div");
        back.className = "card card-back small";
        cardsElement.appendChild(back);
      }
      const counter = document.createElement("span");
      counter.className = "card-count";
      counter.textContent = `${player.hand.length}`;
      cardsElement.appendChild(counter);
    }
  });

  updatePlayerActions();
  updateLogPanel(game);
  updateEndPanel(game);
}

function updatePlayerActions() {
  const actionsContainer = document.getElementById("playerActions");
  if (!actionsContainer) return;
  actionsContainer.innerHTML = "";
  const game = TableState.game;
  if (!game || game.status !== "running") return;
  const localId = TableState.localPlayerId;
  if (!localId) return;
  const isAttacker = game.currentAttacker.id === localId;
  const isDefender = game.currentDefender.id === localId;

  if (isDefender && game.phase === "defend-select") {
    const takeButton = document.createElement("button");
    takeButton.className = "button ghost";
    takeButton.textContent = "Karten aufnehmen";
    takeButton.addEventListener("click", handleTakeCards);
    actionsContainer.appendChild(takeButton);
  }

  if (
    isAttacker &&
    game.phase === "attack-throw-in" &&
    game.table.length &&
    game.table.every((pair) => pair.defense)
  ) {
    const endButton = document.createElement("button");
    endButton.className = "button";
    endButton.textContent = "Angriff beenden";
    endButton.addEventListener("click", handleEndAttack);
    actionsContainer.appendChild(endButton);
  }
}

function createCardElement(card, options = {}) {
  const cardElement = document.createElement("div");
  cardElement.className = "card";
  if (options.small) cardElement.classList.add("small");
  const rank = document.createElement("span");
  rank.className = "card-rank";
  rank.textContent = card.rank;
  const suit = document.createElement("span");
  suit.className = "card-suit";
  suit.textContent = card.suitSymbol;
  if (card.color === "red") {
    cardElement.classList.add("red");
  }
  cardElement.appendChild(rank);
  cardElement.appendChild(suit);
  return cardElement;
}

function updateLogPanel(game) {
  const list = document.getElementById("logList");
  if (!list) return;
  list.innerHTML = "";
  if (!game.log.length) {
    const empty = document.createElement("li");
    empty.textContent = "Noch keine Aktionen protokolliert.";
    list.appendChild(empty);
    return;
  }
  game.log
    .slice(-8)
    .reverse()
    .forEach((entry) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>${formatTime(entry.timestamp)}</span><span>${entry.text}</span>`;
      list.appendChild(item);
    });
}

function updateEndPanel(game) {
  const panel = document.getElementById("endPanel");
  const message = document.getElementById("endMessage");
  if (!panel || !message) return;
  if (game.status === "running") {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  message.textContent = game.message;
  const restartButton = document.getElementById("restartButton");
  if (restartButton) {
    if (TableState.mode === "lobby") {
      const isHost = TableState.lobby?.hostId === TableState.localPlayerId;
      restartButton.disabled = !isHost;
      restartButton.textContent = isHost ? "Revanche starten" : "Warte auf Host";
    } else {
      restartButton.disabled = false;
      restartButton.textContent = "Revanche";
    }
  }
}

function handleCardClick(cardId) {
  const game = TableState.game;
  if (!game || game.status !== "running") return;
  const localId = TableState.localPlayerId;
  if (!localId) return;
  try {
    if (game.currentAttacker.id === localId && ["attack-select", "attack-throw-in"].includes(game.phase)) {
      game.playAttackCard(localId, cardId);
    } else if (game.currentDefender.id === localId && game.phase === "defend-select") {
      game.playDefenseCard(localId, cardId);
    } else {
      showToast("Jetzt ist ein anderer Spieler am Zug.");
      return;
    }
    afterInteraction();
  } catch (error) {
    showToast(error.message);
  }
}

function handleTakeCards() {
  const game = TableState.game;
  if (!game) return;
  try {
    game.defenderTake(TableState.localPlayerId);
    afterInteraction();
  } catch (error) {
    showToast(error.message);
  }
}

function handleEndAttack() {
  const game = TableState.game;
  if (!game) return;
  try {
    game.endAttack(TableState.localPlayerId);
    afterInteraction();
  } catch (error) {
    showToast(error.message);
  }
}

function handleRestart() {
  if (!TableState.game) return;
  if (TableState.mode === "solo") {
    TableState.game.startNewGame();
    afterInteraction();
  } else if (TableState.mode === "lobby") {
    const lobby = loadLobby(TableState.lobbyCode);
    if (!lobby) {
      showToast("Lobby nicht mehr vorhanden.");
      return;
    }
    if (lobby.hostId !== TableState.localPlayerId) {
      showToast("Nur der Host kann eine neue Runde starten.");
      return;
    }
    const game = new DurakGame({ players: lobby.players, mode: "lobby" });
    game.startNewGame();
    lobby.status = "playing";
    lobby.gameState = game.toJSON();
    saveLobby(lobby);
    TableState.game = game;
    TableState.lobby = lobby;
    renderTable();
  }
}

function handleTableStorageSync(event) {
  if (TableState.mode !== "lobby" || !TableState.lobbyCode) return;
  if (event.key !== getLobbyStorageKey(TableState.lobbyCode)) return;
  const lobby = loadLobby(TableState.lobbyCode);
  if (!lobby) {
    showToast("Lobby wurde geschlossen.");
    window.location.replace("setup.html?mode=multiplayer");
    return;
  }
  if (!lobby.gameState) {
    window.location.replace(`lobby.html?code=${TableState.lobbyCode}`);
    return;
  }
  TableState.lobby = lobby;
  TableState.game = DurakGame.fromState(lobby.gameState);
  renderTable();
}

function queueAIMoveIfNeeded() {
  if (TableState.mode !== "solo") return;
  const game = TableState.game;
  if (!game || game.status !== "running") return;
  clearTimeout(TableState.aiTimeout);
  const defender = game.currentDefender;
  if (game.phase === "defend-select" && defender.type === "ai") {
    TableState.aiTimeout = setTimeout(() => executeAIDefense(defender), 700);
    return;
  }
  const attacker = game.currentAttacker;
  if (["attack-select", "attack-throw-in"].includes(game.phase) && attacker.type === "ai") {
    TableState.aiTimeout = setTimeout(() => executeAIAttack(attacker), 700);
  }
}

function executeAIAttack(aiPlayer) {
  const game = TableState.game;
  if (!game || game.status !== "running") return;
  if (game.currentAttacker.id !== aiPlayer.id) return;
  const validCards = aiPlayer.hand.filter((card) => game.isCardValidForAttack(card));
  if (!validCards.length) {
    if (game.table.every((pair) => pair.defense)) {
      try {
        game.endAttack(aiPlayer.id);
        afterInteraction();
      } catch (error) {
        console.error(error);
      }
    }
    return;
  }
  const sorted = [...validCards].sort((a, b) => {
    const aTrump = a.suit === game.trumpSuit;
    const bTrump = b.suit === game.trumpSuit;
    if (aTrump && !bTrump) return 1;
    if (!aTrump && bTrump) return -1;
    return a.value - b.value;
  });
  try {
    game.playAttackCard(aiPlayer.id, sorted[0].id);
    afterInteraction();
  } catch (error) {
    console.error(error);
  }
}

function executeAIDefense(aiPlayer) {
  const game = TableState.game;
  if (!game || game.status !== "running") return;
  if (game.currentDefender.id !== aiPlayer.id) return;
  const lastPair = game.table[game.table.length - 1];
  if (!lastPair) return;
  const valid = game.getValidDefenseCards(lastPair.attack, aiPlayer);
  if (!valid.length) {
    try {
      game.defenderTake(aiPlayer.id);
      afterInteraction();
    } catch (error) {
      console.error(error);
    }
    return;
  }
  const sorted = [...valid].sort((a, b) => {
    const aTrump = a.suit === game.trumpSuit;
    const bTrump = b.suit === game.trumpSuit;
    if (aTrump && !bTrump) return 1;
    if (!aTrump && bTrump) return -1;
    return a.value - b.value;
  });
  try {
    game.playDefenseCard(aiPlayer.id, sorted[0].id);
    afterInteraction();
  } catch (error) {
    console.error(error);
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    return "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  switch (page) {
    case "setup":
      initSetupPage();
      break;
    case "lobby":
      initLobbyPage();
      break;
    case "table":
      initTablePage();
      break;
    default:
      initHomePage();
      break;
  }
});
