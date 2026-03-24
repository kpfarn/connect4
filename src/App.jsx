import { useEffect, useMemo, useState } from 'react'

const ROWS = 6
const COLS = 7
const CONNECT = 4

/** @typedef {'R' | 'Y' | null} Cell */
/** @typedef {'1P' | '2P' | null} GameMode */
/** @typedef {'easy' | 'medium' | 'hard' | null} Difficulty */

/** @returns {Cell[][]} */
function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null))
}

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS
}

/**
 * Given a board and column, find the lowest empty row where a piece would land.
 * @param {Cell[][]} board
 * @param {number} col
 * @returns {number} row index or -1 if column is full
 */
function findNextOpenRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (board[r][col] === null) return r
  }
  return -1
}

/**
 * Count consecutive tokens starting at (r,c) and stepping in direction (dr,dc).
 * @param {Cell[][]} board
 * @param {number} r
 * @param {number} c
 * @param {number} dr
 * @param {number} dc
 * @param {'R' | 'Y'} token
 * @returns {number}
 */
function countDir(board, r, c, dr, dc, token) {
  let count = 0
  let rr = r + dr
  let cc = c + dc
  while (inBounds(rr, cc) && board[rr][cc] === token) {
    count += 1
    rr += dr
    cc += dc
  }
  return count
}

/**
 * Check if placing `token` at (row,col) created a connect-four.
 * @param {Cell[][]} board
 * @param {number} row
 * @param {number} col
 * @param {'R' | 'Y'} token
 * @returns {boolean}
 */
function isWinningMove(board, row, col, token) {
  // Only lines that pass through the last move can win.
  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal down-right
    [1, -1], // diagonal down-left
  ]

  for (const [dr, dc] of directions) {
    const total =
      1 + countDir(board, row, col, dr, dc, token) + countDir(board, row, col, -dr, -dc, token)
    if (total >= CONNECT) return true
  }
  return false
}

/** @param {Cell[][]} board */
function isBoardFull(board) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c] === null) return false
    }
  }
  return true
}

/** @param {Cell[][]} board */
function getPlayableColumns(board) {
  const cols = []
  for (let c = 0; c < COLS; c += 1) {
    if (findNextOpenRow(board, c) >= 0) cols.push(c)
  }
  return cols
}

/**
 * @param {Cell[][]} board
 * @param {number} col
 * @param {'R' | 'Y'} token
 * @returns {{ next: Cell[][], row: number } | null}
 */
function simulateDrop(board, col, token) {
  const row = findNextOpenRow(board, col)
  if (row < 0) return null
  const next = board.map((r) => r.slice())
  next[row][col] = token
  return { next, row }
}

/**
 * @param {Cell[][]} board
 * @param {'R' | 'Y'} token
 * @returns {number | null}
 */
function findImmediateWin(board, token) {
  const playable = getPlayableColumns(board)
  for (const col of playable) {
    const sim = simulateDrop(board, col, token)
    if (sim && isWinningMove(sim.next, sim.row, col, token)) return col
  }
  return null
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function chooseAIMove(board, difficulty) {
  const playable = getPlayableColumns(board)
  if (!playable.length) return null

  // Always take a winning move immediately.
  const winning = findImmediateWin(board, 'Y')
  if (winning !== null) return winning

  if (difficulty === 'easy') {
    return randomChoice(playable)
  }

  // Medium/Hard both block immediate player wins.
  const block = findImmediateWin(board, 'R')
  if (block !== null) return block

  const centerBias = [3, 2, 4, 1, 5, 0, 6].filter((c) => playable.includes(c))
  if (difficulty === 'medium') {
    return randomChoice(centerBias.slice(0, Math.min(3, centerBias.length)))
  }

  // Hard: simple heuristic search (one ply lookahead + center weighting).
  let bestCol = playable[0]
  let bestScore = -Infinity
  for (const col of playable) {
    const first = simulateDrop(board, col, 'Y')
    if (!first) continue
    let score = 10 - Math.abs(3 - col) * 1.25

    // Prefer setups that create immediate future wins.
    if (findImmediateWin(first.next, 'Y') !== null) score += 18

    // Avoid moves that allow immediate player wins.
    const oppPlayable = getPlayableColumns(first.next)
    for (const oppCol of oppPlayable) {
      const reply = simulateDrop(first.next, oppCol, 'R')
      if (reply && isWinningMove(reply.next, reply.row, oppCol, 'R')) {
        score -= 22
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestCol = col
    }
  }

  return bestCol
}

function App() {
  const [board, setBoard] = useState(() => createEmptyBoard())
  const [player, setPlayer] = useState(/** @type {'R' | 'Y'} */ ('R'))
  const [winner, setWinner] = useState(/** @type {'R' | 'Y' | null} */ (null))
  const [isDraw, setIsDraw] = useState(false)
  const [hoverCol, setHoverCol] = useState(/** @type {number | null} */ (null))
  const [moveId, setMoveId] = useState(0)
  const [lastMove, setLastMove] = useState(
    /** @type {{ row: number, col: number, id: number } | null} */ (null),
  )
  const [mode, setMode] = useState(/** @type {GameMode} */ (null))
  const [difficulty, setDifficulty] = useState(/** @type {Difficulty} */ (null))
  const [aiThinking, setAiThinking] = useState(false)

  const tokenMeta = useMemo(() => {
    return {
      R: { name: 'Red', color: '#e11d48' },
      Y: { name: 'Yellow', color: '#fbbf24' },
    }
  }, [])

  const currentToken = player
  const isOnePlayer = mode === '1P'
  const isAITurn = isOnePlayer && player === 'Y' && !winner && !isDraw && difficulty !== null

  const statusText = winner
    ? `${tokenMeta[winner].name} wins!`
    : isDraw
      ? 'Draw!'
      : isAITurn
        ? 'Computer is thinking...'
        : `Drop a piece: ${tokenMeta[currentToken].name}`

  useEffect(() => {
    if (!isAITurn || aiThinking) return

    setAiThinking(true)
    const timeoutId = setTimeout(() => {
      const col = chooseAIMove(board, difficulty)
      if (col !== null) {
        dropInColumn(col)
      }
      setAiThinking(false)
    }, 520)

    return () => {
      clearTimeout(timeoutId)
      setAiThinking(false)
    }
  }, [isAITurn, aiThinking, board, difficulty])

  function resetGame() {
    setBoard(createEmptyBoard())
    setPlayer('R')
    setWinner(null)
    setIsDraw(false)
    setHoverCol(null)
    setMoveId(0)
    setLastMove(null)
    setAiThinking(false)
  }

  function resetToMenu() {
    resetGame()
    setMode(null)
    setDifficulty(null)
  }

  function dropInColumn(col) {
    if (winner || isDraw || aiThinking) return
    const row = findNextOpenRow(board, col)
    if (row < 0) return

    const next = board.map((r) => r.slice())
    next[row][col] = player
    const nextMoveId = moveId + 1
    setMoveId(nextMoveId)
    setLastMove({ row, col, id: nextMoveId })

    if (isWinningMove(next, row, col, player)) {
      setBoard(next)
      setWinner(player)
      return
    }
    if (isBoardFull(next)) {
      setBoard(next)
      setIsDraw(true)
      return
    }

    setBoard(next)
    setPlayer((p) => (p === 'R' ? 'Y' : 'R'))
  }

  const previewRow = hoverCol === null ? -1 : findNextOpenRow(board, hoverCol)

  /**
   * @param {number} r
   * @param {number} c
   */
  function renderCell(r, c) {
    const token = board[r][c]
    const isPreview = !winner && !isDraw && hoverCol === c && r === previewRow && token === null
    const isLastPlaced = token !== null && lastMove && lastMove.row === r && lastMove.col === c

    const empty = {
      background:
        'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.0) 55%), #061b0c',
      boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.35)',
      opacity: isPreview ? 0.45 : 1,
      transform: isPreview ? 'scale(0.98)' : 'none',
      transition: 'opacity 120ms ease, transform 120ms ease',
    }

    if (!token && !isPreview) return <div key={`${r}-${c}`} className="c4Cell" style={empty} />

    const fillColor = token ? tokenMeta[token].color : tokenMeta[currentToken].color
    const filled = {
      background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 45%), ${fillColor}`,
      boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25), 0 10px 20px rgba(0,0,0,0.12)',
      opacity: isPreview ? 0.35 : 1,
      transform: isPreview ? 'scale(0.985)' : 'none',
      transition: 'opacity 120ms ease, transform 120ms ease',
    }
    return (
      <div
        key={`${r}-${c}-${isLastPlaced ? lastMove.id : ''}`}
        className={`c4Cell ${isLastPlaced ? 'c4CellDrop' : ''}`}
        style={{
          ...filled,
          '--drop-rows': r + 1,
        }}
      />
    )
  }

  return (
    <>
      <style>{`
        .c4App {
          padding: 28px 16px 34px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-sizing: border-box;
        }
        .c4Header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 14px;
        }
        .c4Status {
          font-size: 20px;
          line-height: 1.2;
          margin: 0;
        }
        .c4Sub {
          margin: 0;
          color: var(--text);
          font-size: 14px;
        }
        .c4BoardWrap {
          width: min(560px, 92vw);
          margin: 0 auto;
        }
        .c4Menu {
          width: min(560px, 92vw);
          margin: 0 auto;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: rgba(255,255,255,0.04);
          box-shadow: var(--shadow);
          padding: 22px 18px;
          display: grid;
          gap: 12px;
        }
        .c4Menu h3 {
          margin: 0;
          font-size: 22px;
          color: var(--text-h);
        }
        .c4ChoiceRow {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .c4Board {
          position: relative;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 12px;
          box-shadow: var(--shadow);
          background: rgba(0,0,0,0.08);
          overflow: hidden;
        }
        .c4Controls {
          display: grid;
          grid-template-columns: repeat(${COLS}, 1fr);
          gap: 10px;
          margin: 0 4px 12px;
        }
        .c4ColBtn {
          height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.18);
          background: rgba(255,255,255,0.08);
          color: var(--text-h);
          cursor: pointer;
          transition: transform 80ms ease, background 120ms ease, opacity 120ms ease;
          user-select: none;
          font-size: 13px;
          padding: 0;
        }
        .c4ColBtn:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.14);
        }
        .c4ColBtn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
        .c4Grid {
          display: grid;
          grid-template-columns: repeat(${COLS}, 1fr);
          grid-auto-rows: 1fr;
          gap: 10px;
          width: 100%;
          aspect-ratio: ${COLS} / ${ROWS};
          padding: 4px;
          box-sizing: border-box;
          border-radius: 12px;
          grid-area: 1 / 1;
        }
        .c4BoardLayer {
          display: grid;
          background: #1f6a2d;
          border-radius: 12px;
        }
        .c4PieceGrid {
          z-index: 1;
        }
        .c4FrameGrid {
          z-index: 2;
          pointer-events: none;
        }
        .c4FrameCell {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          background:
            radial-gradient(circle, transparent 62%, #1f6a2d 63%);
        }
        .c4Cell {
          width: 100%;
          height: 100%;
          border-radius: 999px;
        }
        .c4CellDrop {
          animation: c4Drop 500ms cubic-bezier(0.2, 0.8, 0.3, 1);
          will-change: transform;
        }
        @keyframes c4Drop {
          from {
            transform: translateY(calc(-1 * var(--drop-rows) * 108%));
          }
          80% {
            transform: translateY(4%);
          }
          to {
            transform: translateY(0);
          }
        }
        .c4Footer {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          align-items: center;
        }
        .c4Btn {
          border-radius: 10px;
          padding: 10px 14px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.06);
          color: var(--text-h);
          cursor: pointer;
          transition: box-shadow 140ms ease, background 140ms ease, transform 80ms ease;
          font-size: 14px;
        }
        .c4Btn:hover {
          box-shadow: var(--shadow);
          background: rgba(255,255,255,0.10);
          transform: translateY(-1px);
        }
        .c4Btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>

      <div className="c4App">
        <div className="c4Header">
          <h1 style={{ margin: 0 }}>Connect 4</h1>
          <p className="c4Status" aria-live="polite">
            {statusText}
          </p>
        </div>
        <p className="c4Sub">Click a column to drop a piece. First to connect {CONNECT} wins.</p>

        {mode === null ? (
          <div className="c4Menu">
            <h3>Select game mode</h3>
            <div className="c4ChoiceRow">
              <button className="c4Btn" type="button" onClick={() => setMode('1P')}>
                1 Player
              </button>
              <button className="c4Btn" type="button" onClick={() => setMode('2P')}>
                2 Player
              </button>
            </div>
          </div>
        ) : mode === '1P' && difficulty === null ? (
          <div className="c4Menu">
            <h3>Choose difficulty</h3>
            <div className="c4ChoiceRow">
              <button className="c4Btn" type="button" onClick={() => setDifficulty('easy')}>
                Easy
              </button>
              <button className="c4Btn" type="button" onClick={() => setDifficulty('medium')}>
                Medium
              </button>
              <button className="c4Btn" type="button" onClick={() => setDifficulty('hard')}>
                Hard
              </button>
              <button className="c4Btn" type="button" onClick={resetToMenu}>
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="c4BoardWrap">
            <div className="c4Board">
              <div className="c4Controls" role="group" aria-label="Drop pieces">
                {Array.from({ length: COLS }, (_, col) => {
                  const row = findNextOpenRow(board, col)
                  const disabled = winner !== null || isDraw || row < 0 || isAITurn
                  return (
                    <button
                      key={col}
                      className="c4ColBtn"
                      onClick={() => dropInColumn(col)}
                      disabled={disabled}
                      onMouseEnter={() => {
                        if (disabled) return
                        setHoverCol(col)
                      }}
                      onMouseLeave={() => setHoverCol(null)}
                      aria-label={`Drop into column ${col + 1}`}
                      type="button"
                    >
                      {col + 1}
                    </button>
                  )
                })}
              </div>

              <div className="c4BoardLayer">
                <div className="c4Grid c4PieceGrid" aria-label="Connect 4 board" role="grid">
                  {Array.from({ length: ROWS }, (_, r) =>
                    Array.from({ length: COLS }, (_, c) => renderCell(r, c)),
                  )}
                </div>
                <div className="c4Grid c4FrameGrid" aria-hidden="true">
                  {Array.from({ length: ROWS * COLS }, (_, i) => (
                    <div key={i} className="c4FrameCell" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="c4Footer">
          <button className="c4Btn" onClick={resetGame} type="button">
            Restart
          </button>
          <button className="c4Btn" onClick={resetToMenu} type="button">
            Change Mode
          </button>
        </div>
      </div>
    </>
  )
}

export default App
