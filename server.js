const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

let gameState = {
  board: [
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null]
  ],
  turn: 'A', // Player A starts
  playerSetup: { A: false, B: false },
  players: { A: null, B: null }
};

// Function to process moves
function processMove(command, player) {
  const [charName, move] = command.split(':');
  const character = findCharacter(charName, player);
  if (!character) return { type: 'invalid_move' };

  const { row, col, name } = character;

  // Define move directions
  const moveDirections = {
    L: [-1, 0],
    R: [1, 0],
    F: [0, 1],
    B: [0, -1],
    FL: [-1, 1],
    FR: [1, 1],
    BL: [-1, -1],
    BR: [1, -1]
  };

  const [dRow, dCol] = moveDirections[move];
  if (!dRow || !dCol) return { type: 'invalid_move' };

  let newRow = row + dRow;
  let newCol = col + dCol;

  // Validate move bounds and update board
  if (newRow < 0 || newRow >= 5 || newCol < 0 || newCol >= 5) return { type: 'invalid_move' };

  const targetCell = gameState.board[newRow][newCol];
  if (targetCell && targetCell.player === player) return { type: 'invalid_move' };

  // Check if path is clear for Hero1 and Hero2
  if (name.startsWith('H1') || name.startsWith('H2')) {
    let r = row;
    let c = col;
    while (r !== newRow || c !== newCol) {
      r += dRow;
      c += dCol;
      if (gameState.board[r] && gameState.board[r][c]) {
        if (gameState.board[r][c].player !== player) {
          gameState.board[r][c] = null;
        } else {
          return { type: 'invalid_move' };
        }
      }
    }
  }

  // Move character to new position
  gameState.board[newRow][newCol] = { player, name };
  gameState.board[row][col] = null;

  // Check for game over condition
  const opponent = player === 'A' ? 'B' : 'A';
  const opponentCharacters = gameState.board.flat().filter(cell => cell && cell.player === opponent);

  if (opponentCharacters.length === 0) {
    return { type: 'game_over', winner: player };
  }

  return { type: 'update', gameState };
}

// Find a character for a given player
function findCharacter(name, player) {
  for (let row = 0; row < gameState.board.length; row++) {
    for (let col = 0; col < gameState.board[row].length; col++) {
      const cell = gameState.board[row][col];
      if (cell && cell.player === player && cell.name === name) {
        return { row, col, ...cell };
      }
    }
  }
  return null;
}

server.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'setup') {
      gameState.board[data.character.row][data.character.col] = {
        player: data.player,
        name: data.character.name
      };
      if (data.player === 'A') {
        gameState.players.A = ws;
      } else {
        gameState.players.B = ws;
      }
      broadcast({ type: 'update', gameState });
    } else if (data.type === 'player_setup_complete') {
      gameState.playerSetup[data.player] = true;
      if (gameState.playerSetup.A && gameState.playerSetup.B) {
        gameState.turn = 'A'; // Player A starts
      }
      broadcast({ type: 'update', gameState });
    } else if (data.type === 'move') {
      if (data.player === gameState.turn) {
        const result = processMove(data.command, data.player);
        if (result.type === 'update') {
          gameState.turn = gameState.turn === 'A' ? 'B' : 'A';
          broadcast(result);
        } else {
          ws.send(JSON.stringify(result));
        }
      } else {
        ws.send(JSON.stringify({ type: 'invalid_move' }));
      }
    }
  });
});

// Broadcast updates to all connected clients
function broadcast(message) {
  for (const player of Object.values(gameState.players)) {
    if (player && player.readyState === WebSocket.OPEN) {
      player.send(JSON.stringify(message));
    }
  }
}
