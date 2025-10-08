# Durak Arena

Eine moderne, komplett clientseitige Umsetzung des Kartenspiels **Durak** – inklusive Solo-Modus gegen eine KI sowie einer lokalen Mehrspieler-Lobby mit Einladungscode.

## Features

- 🌐 Startseite mit klarer Modus-Wahl (Solo oder Multiplayer).
- 🧠 Solo-Duell gegen eine adaptive KI, die Angriffe und Verteidigungen automatisiert.
- 🤝 Lobby-System mit generierten Codes, das in mehreren Browser-Tabs über `localStorage` synchronisiert wird.
- 🃏 Vollständige Spielmechanik für Durak (36er Kartendeck, Trumpf, Angriffs-/Verteidigungsphasen, Nachziehen, Siegbedingungen).
- 💾 Automatisches Wiederherstellen einer laufenden Lobby beim erneuten Öffnen des Tabs.
- 🎨 Cleanes, modernes Design mit Glas-Effekt und responsivem Layout.

## Projektstruktur

```
├── index.html      # Einstiegspunkt der Anwendung
├── main.js         # Spiel- und Lobby-Logik, UI-Rendering
├── styles.css      # Globales Styling
└── README.md
```

## Entwicklung & Nutzung

1. Repository klonen und in das Projektverzeichnis wechseln.
2. Eine lokale Entwicklungsumgebung starten, z. B. mit Python:

   ```bash
   python -m http.server 5173
   ```

3. Im Browser `http://localhost:5173` öffnen.

> Hinweis: Alle Funktionen laufen vollständig im Browser. Für Multiplayer muss jede Partei dieselbe Lobby in einem weiteren Tab/Fenster öffnen – die Synchronisation erfolgt über `localStorage`.

## Multiplayer-Flow

1. **Lobby erstellen** und den angezeigten Code teilen.
2. **Zweiter Spieler** gibt den Code ein und tritt bei.
3. Sobald beide verbunden sind, startet der Host die Runde. Spielzüge werden automatisch zwischen den geöffneten Tabs synchronisiert.

## Lizenz

Dieses Projekt steht ohne spezielle Lizenzangabe zur Verfügung. Passe es gerne an deine Bedürfnisse an.
