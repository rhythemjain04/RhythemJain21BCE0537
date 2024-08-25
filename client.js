const socket = new WebSocket('ws://localhost:8080');

const gameState = {
  board: Array.from({ length: 5 }, () => Array(5).fill(null)),
  turn: 'A',
  playerSetup: { A: false, B: false },
  selectedCharacter: null,
  selectedMove: null,
  player: 'A'
};

const placedCharacters = { A: [], B: [] };

window.onload = function() {
  initializeBoard();
  setupEventListeners();
};

function initializeBoard() {
  const board = document.getElementById('board');

  // Create 25 cells for the 5x5 board
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.addEventListener('dragover', (e) => e.preventDefault()); // Allow drop
    cell.addEventListener('drop', handleDrop);
    board.appendChild(cell);
  }
}

function setupEventListeners() {
  document.getElementById('move-button').addEventListener('click', () => {
    handleMoveButtonClick();
  });

  document.querySelectorAll('.character').forEach(element => {
    element.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', e.target.getAttribute('data-name'));
    });
  });
}

function handleDrop(event) {
  event.preventDefault();
  const cellIndex = event.target.dataset.index;
  const row = Math.floor(cellIndex / 5);
  const col = cellIndex % 5;

  if (!gameState.playerSetup.A || !gameState.playerSetup.B) {
    // Place characters during setup phase
    placeCharacter(gameState.player, row, col);
  } else {
    // Handle moves
    handleMove(row, col);
  }
}

function placeCharacter(player, row, col) {
  if (gameState.selectedCharacter && !gameState.playerSetup[player]) {
    if (row === (player === 'A' ? 0 : 4)) { // Only allow placement on the starting row
      if (gameState.board[row][col] === null && placedCharacters[player].length < 5) {
        // Update the game state and board
        gameState.board[row][col] = { player, name: gameState.selectedCharacter };
        placedCharacters[player].push(gameState.selectedCharacter);

        // Send setup information to server
        socket.send(JSON.stringify({
          type: 'setup',
          character: { row, col, name: gameState.selectedCharacter },
          player
        }));

        // Reset selection
        gameState.selectedCharacter = null;
        document.getElementById('selected-character').innerText = 'Selected Character: None';
        document.querySelector('.character.selected')?.classList.remove('selected');

        // Update board display
        updateBoard();

        if (placedCharacters[player].length === 5) {
          gameState.playerSetup[player] = true;
          socket.send(JSON.stringify({
            type: 'player_setup_complete',
            player
          }));

          // Switch player for the next setup phase
          if (player === 'A') {
            gameState.player = 'B';
            document.getElementById('selected-character').innerText = 'Select a character to place for Player B';
          } else {
            document.getElementById('selected-character').innerText = 'Setup complete!';
            document.getElementById('turn-indicator').innerText = 'Player A\'s Turn';
          }
        }
      } else {
        alert('Invalid placement or maximum characters placed.');
      }
    } else {
      alert('Characters can only be placed on your starting row.');
    }
  } else {
    alert('Please select a character first.');
  }
}

function handleMove(row, col) {
  if (gameState.selectedCharacter && gameState.selectedMove) {
    const moveCommand = `${gameState.selectedCharacter}:${gameState.selectedMove}`;
    socket.send(JSON.stringify({
      type: 'move',
      command: moveCommand,
      player: gameState.player,
      to: { row, col }
    }));
    gameState.selectedMove = null;
    document.querySelectorAll('.move-option').forEach(btn => btn.classList.remove('selected'));
  } else {
    alert('Please select a character and move first.');
  }
}

function handleMoveButtonClick() {
  const moveCommand = `${gameState.selectedCharacter}:${gameState.selectedMove}`;
  if (gameState.selectedCharacter && gameState.selectedMove) {
    socket.send(JSON.stringify({
      type: 'move',
      command: moveCommand,
      player: gameState.player
    }));
  } else {
    alert('Please select a character and a move option.');
  }
}

function updateBoard() {
  const board = document.getElementById('board');
  board.querySelectorAll('.cell').forEach((cell, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const cellContent = gameState.board[row][col];
    if (cellContent) {
      cell.innerText = cellContent.name;
      cell.style.backgroundColor = cellContent.player === 'A' ? '#e0f7fa' : '#ffebee';
    } else {
      cell.innerText = '';
      cell.style.backgroundColor = '#fff';
    }
  });
}

socket.onmessage = function(event) {
  const data = JSON.parse(event.data);

  if (data.type === 'update') {
    gameState.board = data.gameState.board;
    gameState.turn = data.gameState.turn;
    gameState.playerSetup = data.gameState.playerSetup;
    updateBoard();
    document.getElementById('turn-indicator').innerText = `Player ${gameState.turn}'s Turn`;
  } else if (data.type === 'game_over') {
    alert(`Game Over! Player ${data.winner} wins!`);
  } else if (data.type === 'invalid_move') {
    alert('Invalid move, please try again.');
  }
};
