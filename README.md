# Durak Lounge

Eine moderne, komplett clientseitige Umsetzung des Kartenspiels **Durak** – jetzt mit einem vierseitigen Spieltisch, separaten Seiten für Lobby, Setup und Spiel sowie einer warmen Lounge-Atmosphäre.

## Highlights

- 🏠 Getrennte Seiten für Start, Setup, Lobby und Spieltisch sorgen für einen klaren Ablauf.
- 🧠 Solo-Modus mit drei KI-Gegnern, die vollständig nach Durak-Regeln agieren.
- 🤝 Private Vier-Spieler-Lobby mit Einladungs-Code und Echtzeit-Synchronisation via `localStorage`.
- 🃏 Vollständige Durak-Mechanik: Trumpf, Angriffs-/Verteidigungsphasen, Nachziehen, Log und Rundenabschluss.
- 🪑 Tischlayout mit vier Sitzpositionen (Nord, Ost, Süd, West) und realistischer Kartenpräsentation.
- 📜 Rundenprotokoll mit Zeitstempeln, das im Spiel und in der Lobby sichtbar bleibt.

## Struktur

```
├── index.html      # Startseite mit Tischauswahl
├── setup.html      # Solo-Setup bzw. Lobby-Erstellung/-Beitritt
├── lobby.html      # Vierer-Lobby mit Sitzplätzen und Log
├── table.html      # Spieltisch mit Karten und Log
├── main.js         # Spiel-/Lobbylogik + Page-spezifische Controller
├── styles.css      # Gemeinsames Styling im Lounge-Look
└── README.md
```

## Nutzung

1. Repository klonen und in das Projektverzeichnis wechseln.
2. Eine lokale Entwicklungsumgebung starten, z. B. mit Python:

   ```bash
   python -m http.server 5173
   ```

3. Im Browser die gewünschte Seite öffnen, z. B. `http://localhost:5173/index.html`.

> Hinweis: Für Multiplayer öffnet jede Person die Lobby bzw. den Tisch im eigenen Tab. Die Synchronisierung erfolgt über `localStorage`, daher muss der Code im selben Browser/auf demselben Gerät geteilt werden.

## Ablauf im Mehrspieler-Modus

1. Auf `setup.html?mode=multiplayer` eine Lobby erstellen und den Code teilen.
2. Weitere Spieler treten über denselben Link mit dem Code bei. Vier Plätze müssen besetzt sein.
3. Der Host startet die Runde und alle wechseln automatisch zu `table.html?mode=lobby&code=xxxxx`.
4. Spielzüge werden zwischen allen offenen Tabs synchron gehalten. Nach einer Runde kann der Host direkt eine Revanche starten.

Viel Spaß in der Durak Lounge!
