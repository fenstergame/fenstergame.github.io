import React, { useState } from "react";
import "./App.css";
import { Button, Input, List, Modal, Space, Typography } from "antd";
import backgroundImage from './img/background.png';
import { ArrowRightOutlined } from "@ant-design/icons";

const cardValues = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["♠️", "♥️", "♣️", "♦️"];

interface CardType {
  id: number;
  card: {
    value: string;
    suit: string;
  };
  faceUp: boolean;
}

const backImage = "https://deckofcardsapi.com/static/img/back.png";

function getCardImage(value: string, suit: string): string {
  const suitMap: Record<string, string> = {
    "♠️": "S", "♥️": "H", "♣️": "C", "♦️": "D",
  };
  const valMap: Record<string, string> = {
    "10": "0", "J": "J", "Q": "Q", "K": "K", "A": "A",
  };
  const val = valMap[value] || value;
  return `https://deckofcardsapi.com/static/img/${val}${suitMap[suit]}.png`;
}

function cardToNumber(value: string): number {
  if (value === "A") return 14; // Ace is highest
  if (value === "K") return 13;
  if (value === "Q") return 12;
  if (value === "J") return 11;
  return parseInt(value, 10);
}

function createShuffledDeck(): { value: string; suit: string }[] {
  const deck = [];
  for (const value of cardValues) {
    for (const suit of suits) {
      deck.push({ value, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const gridMapping: (number | null)[] = [
  0, 1, 2, 3, 4,
  5, null, 6, null, 7,
  8, 9, 10, 11, 12,
  13, null, 14, null, 15,
  16, 17, 18, 19, 20
];

const outerIds = [0, 1, 2, 3, 4, 5, 7, 8, 12, 13, 15, 16, 17, 18, 19, 20];
const innerEdgeIds = [6, 9, 11, 14];
const centerId = 10;
const cornerIds = [0, 4, 16, 20];

const PlayerModal: React.FC<{ onSubmit: (players: string[]) => void }> = ({ onSubmit }) => {
  const [input, setInput] = useState("");
  const [players, setPlayers] = useState<string[]>([]);

  const addPlayer = () => {
    const trimmed = input.trim();
    if (trimmed && !players.includes(trimmed)) {
      setPlayers([...players, trimmed]);
      setInput("");
    }
  };

  return (
    <Modal open={true} title="Enter Player Names" footer={null} closable={false} centered width={300}>
      <Space style={{ width: "100%", justifyContent: "center" }}>
        <Button type="primary" disabled={players.length === 0} onClick={() => onSubmit(players)}>Start</Button>
        <Input
          placeholder="Player name"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={addPlayer}
          style={{ width: 150 }}
        />
        <Button onClick={addPlayer}>+</Button>
      </Space>

      {players.length > 0 && (
        <List
          size="small"
          style={{ marginTop: 20 }}
          dataSource={players}
          renderItem={(item, index) => (
            <List.Item>
              <Typography.Text>{index + 1}.</Typography.Text> {item}
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
};

const App: React.FC = () => {
  const initialState = () => {
    const deck = createShuffledDeck();
    const initialCards = Array.from({ length: 21 }, (_, i) => {
      const isCorner = cornerIds.includes(i);
      const card = deck.pop()!;
      return { id: i, card, faceUp: isCorner };
    });
    return { deck, cards: initialCards };
  };

  const [{ cards }, setGameState] = useState(initialState);
  const [currentCard, setCurrentCard] = useState<CardType | null>(null);
  const [message, setMessage] = useState("Choose a card to start!");

  const [players, setPlayers] = useState<string[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [gameLocked, setGameLocked] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);

  const isAdjacent = (a: number, b: number) =>
    [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [4, 7], [5, 8], [6, 9], [6, 11], [7, 12],
    [8, 9], [9, 10], [10, 11], [11, 12], [8, 13], [12, 15], [13, 16], [14, 17], [14, 19],
    [15, 20], [16, 17], [17, 18], [18, 19], [19, 20]].some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const isStrictlyBetweenTwoFaceUp = (id: number): { min: number, max: number } | null => {
    const horizontal = [[0, 1, 2, 3, 4], [16, 17, 18, 19, 20]];
    const vertical = [[0, 5, 8, 13, 16], [4, 7, 12, 15, 20]];
    const lines = [...horizontal, ...vertical];

    for (const line of lines) {
      const index = line.indexOf(id);
      if (index === -1) continue;
      const prev = line[index - 1];
      const next = line[index + 1];

      if (prev !== undefined && next !== undefined) {
        const prevCard = cards.find(c => c.id === prev);
        const nextCard = cards.find(c => c.id === next);
        if (prevCard?.faceUp && nextCard?.faceUp) {
          if (cornerIds.includes(prevCard.id) && cornerIds.includes(nextCard.id)) return null;
          const min = Math.min(cardToNumber(prevCard.card.value), cardToNumber(nextCard.card.value));
          const max = Math.max(cardToNumber(prevCard.card.value), cardToNumber(nextCard.card.value));
          return { min, max };
        }
      }
    }
    return null;
  };

  const findConnectedFaceUp = (startId: number): number[] => {
    const visited = new Set<number>();
    const stack = [startId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = cards.filter(c => c.faceUp && isAdjacent(current, c.id)).map(c => c.id);
      for (const n of neighbors) {
        if (!visited.has(n)) stack.push(n);
      }
    }
    return Array.from(visited);
  };

  const allOuterTurned = () => outerIds.every(id => cards.find(c => c.id === id)?.faceUp);
  const allInnerTurned = () => innerEdgeIds.every(id => cards.find(c => c.id === id)?.faceUp);

  const handleGuess = (id: number, guess: string) => {
    if (gameLocked) return;
    const selected = cards.find(c => c.id === id)!;
    let isCorrect = false;

    if (outerIds.includes(id)) {
      const val = cardToNumber(selected.card.value);
      const between = isStrictlyBetweenTwoFaceUp(id);
      if (between) {
        const { min, max } = between;
        isCorrect = (guess === "inside" && val >= min && val <= max) ||
          (guess === "outside" && (val < min || val > max));
      } else {
        if (!currentCard) return;
        const prevVal = cardToNumber(currentCard.card.value);
        isCorrect = (guess === "higher" && val > prevVal) || (guess === "lower" && val < prevVal);
      }
    }

    if (innerEdgeIds.includes(id)) {
      const isRed = selected.card.suit === "♥️" || selected.card.suit === "♦️";
      isCorrect = (guess === "red" && isRed) || (guess === "black" && !isRed);
    }

    if (id === centerId) {
      isCorrect = selected.card.suit === guess;
    }

    const newCards = cards.map(c => c.id === id ? { ...c, faceUp: true } : c);
    setGameState(prev => ({ ...prev, cards: newCards }));

    if (isCorrect) {
      setCurrentCard(selected);
      setCorrectGuesses(prev => prev + 1);

      if (allOuterTurned() && allInnerTurned() && id === centerId) {
        setGameFinished(true);
        setMessage("Wow! The game is finished. Everyone go home now! 🎉");
      } else {
        setMessage("Correct! Continue or pass.");
      }

    } else {
      const connected = findConnectedFaceUp(id);
      setMessage(`Wrong! Drink ${connected.length} sips!`);
      setCorrectGuesses(0);
      setGameLocked(true);

      setTimeout(() => {
        setGameState(prev => {
          const returned = prev.cards.filter(c => connected.includes(c.id)).map(c => c.card);
          const newDeck = [...prev.deck, ...returned];
          for (let i = newDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
          }

          const updated = prev.cards.map(c => {
            if (connected.includes(c.id)) {
              const isCorner = cornerIds.includes(c.id);
              return { ...c, card: newDeck.pop()!, faceUp: isCorner };
            }
            return c;
          });

          return { deck: newDeck, cards: updated };
        });

        setCurrentCard(null);
        setGameLocked(false);
        setMessage(`Choose a card`);
      }, 2000);
    }
  };

  const handleSelectStartCard = (id: number) => {
    if (gameLocked) return;
    const selected = cards.find(c => c.id === id)!;
    setCurrentCard(selected);
    setMessage(`Starting with ${selected.card.value}${selected.card.suit}`);
  };

  if (players.length === 0) {
    return <PlayerModal onSubmit={setPlayers} />;
  }

  return (
    <div
      className="container main-game"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        padding: "20px",
        boxSizing: "border-box",
        margin: 0,
        color: "white"
      }}
    >
      <h1>🍻 Fenster 🍻</h1>
      <p><strong>Current Player:</strong> {players[currentPlayer]}</p>
      <p>{message}</p>

      <div className="board">
        {gridMapping.map((cardIndex, i) => {
          if (cardIndex === null) return <div key={i} className="empty-slot" />;
          const c = cards[cardIndex];

          const renderOverlay = () => {
            if (gameLocked || c.faceUp || gameFinished) return null;

            if (outerIds.includes(c.id)) {
              if (currentCard && isAdjacent(currentCard.id, c.id)) {
                const between = isStrictlyBetweenTwoFaceUp(c.id);
                if (between) {
                  return (
                    <div className="overlay">
                      <button onClick={() => handleGuess(c.id, "inside")}>🔼 Inside</button>
                      <button onClick={() => handleGuess(c.id, "outside")}>🔽 Outside</button>
                    </div>
                  );
                }
                return (
                  <div className="overlay">
                    {/* ↑ */}
                    {/* ↓ */}
                    <button onClick={() => handleGuess(c.id, "higher")}>Higher</button>
                    <button onClick={() => handleGuess(c.id, "lower")}>Lower</button>
                  </div>
                );
              }
            }

            if (innerEdgeIds.includes(c.id) && allOuterTurned()) {
              return (
                <div className="overlay">
                  <button onClick={() => handleGuess(c.id, "red")}>🔴 Red</button>
                  <button onClick={() => handleGuess(c.id, "black")}>⚫ Black</button>
                </div>
              );
            }

            if (c.id === centerId && allInnerTurned()) {
              return (
                <div className="overlay">
                  {suits.map(suit => (
                    <button key={suit} onClick={() => handleGuess(c.id, suit)}>{suit}</button>
                  ))}
                </div>
              );
            }

            return null;
          };

          return (
            <div key={c.id} className="card-slot">
              <div
                className={`card-inner ${c.faceUp ? "flipped" : ""}`}
                onClick={() => { if (c.faceUp) handleSelectStartCard(c.id); }}
              >
                <div className="card-front">
                  <img src={getCardImage(c.card.value, c.card.suit)} alt="front" className="card-image" />
                </div>
                <div className="card-back">
                  <img src={backImage} alt="back" className="card-image" />
                </div>
              </div>
              {renderOverlay()}
            </div>
          );
        })}
      </div>

      <Button
        className="next-player-btn"
        type="primary"
        shape="round"
        size="large"
        ghost
        disabled={correctGuesses < 2 || gameLocked || gameFinished}
        onClick={() => {
          setCorrectGuesses(0);
          setCurrentPlayer((prev) => (prev + 1) % players.length);
          setCurrentCard(null);
          setMessage(`Choose a card.`);
        }}
        style={{
          marginTop: 20,
          opacity: correctGuesses < 2 || gameLocked || gameFinished ? 0.5 : 1,
          cursor: correctGuesses < 2 || gameLocked || gameFinished ? "not-allowed" : "pointer",
          color: "#fff",
          borderColor: "#fff",
        }}
      >
        <ArrowRightOutlined /> Next Player
      </Button>
    </div>
  );
};

export default App;
