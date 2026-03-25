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

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * @param {Cell[][]} board
 * @param {'R' | 'Y'} token
 * @returns {number[]} columns that would win immediately for `token`
 */
function getWinningMoves(board, token) {
  const winning = []
  const playable = getPlayableColumns(board)
  for (const col of playable) {
    const sim = simulateDrop(board, col, token)
    if (sim && isWinningMove(sim.next, sim.row, col, token)) winning.push(col)
  }
  return winning
}

function otherToken(token) {
  return token === 'R' ? 'Y' : 'R'
}

/**
 * Heuristic evaluation: positive favors 'Y' (AI), negative favors 'R' (human).
 * @param {Cell[][]} b
 */
function evaluateBoard(b) {
  const AI = 'Y'
  const HUMAN = 'R'

  const scoreForCount = (count, who) => {
    if (who === AI) {
      if (count === 1) return 1
      if (count === 2) return 10
      if (count === 3) return 50
      return 0
    }
    // HUMAN
    if (count === 1) return -1
    if (count === 2) return -10
    if (count === 3) return -50
    return 0
  }

  let score = 0

  // Center column preference (helps both play strength and symmetry breaking).
  const centerCol = Math.floor(COLS / 2)
  for (let r = 0; r < ROWS; r += 1) {
    const cell = b[r][centerCol]
    if (cell === AI) score += 3
    if (cell === HUMAN) score -= 3
  }

  // Score all 4-cell windows.
  const addWindowScore = (cells) => {
    const countAI = cells.filter((x) => x === AI).length
    const countH = cells.filter((x) => x === HUMAN).length
    const empty = cells.filter((x) => x === null).length

    // Mixed windows are neutral.
    if (countAI > 0 && countH > 0) return
    if (countAI === 0 && countH === 0) return
    if (empty === 4) return

    if (countAI > 0) score += scoreForCount(countAI, AI)
    if (countH > 0) score += scoreForCount(countH, HUMAN)
  }

  // Horizontal windows
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c <= COLS - 4; c += 1) {
      addWindowScore([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]])
    }
  }
  // Vertical windows
  for (let r = 0; r <= ROWS - 4; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      addWindowScore([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]])
    }
  }
  // Diagonal down-right windows
  for (let r = 0; r <= ROWS - 4; r += 1) {
    for (let c = 0; c <= COLS - 4; c += 1) {
      addWindowScore([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]])
    }
  }
  // Diagonal down-left windows
  for (let r = 0; r <= ROWS - 4; r += 1) {
    for (let c = 3; c < COLS; c += 1) {
      addWindowScore([b[r][c], b[r + 1][c - 1], b[r + 2][c - 2], b[r + 3][c - 3]])
    }
  }

  return score
}

/**
 * @param {Cell[][]} b
 * @param {number} depth
 * @param {number} alpha
 * @param {number} beta
 * @param {'R' | 'Y'} tokenToMove
 * @returns {number}
 */
function minimax(b, depth, alpha, beta, tokenToMove) {
  if (depth === 0 || isBoardFull(b)) return evaluateBoard(b)

  const maximizing = tokenToMove === 'Y'
  const playable = getPlayableColumns(b)
  if (!playable.length) return evaluateBoard(b)

  if (maximizing) {
    let best = -Infinity
    for (const col of playable) {
      const sim = simulateDrop(b, col, tokenToMove)
      if (!sim) continue
      if (isWinningMove(sim.next, sim.row, col, tokenToMove)) {
        // Encourage quicker wins.
        best = Math.max(best, 100000 + depth)
        alpha = Math.max(alpha, best)
        if (alpha >= beta) break
        continue
      }
      const val = minimax(sim.next, depth - 1, alpha, beta, otherToken(tokenToMove))
      best = Math.max(best, val)
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }

  let best = Infinity
  for (const col of playable) {
    const sim = simulateDrop(b, col, tokenToMove)
    if (!sim) continue
    if (isWinningMove(sim.next, sim.row, col, tokenToMove)) {
      best = Math.min(best, -100000 - depth)
      beta = Math.min(beta, best)
      if (alpha >= beta) break
      continue
    }
    const val = minimax(sim.next, depth - 1, alpha, beta, otherToken(tokenToMove))
    best = Math.min(best, val)
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

function chooseAIMove(board, difficulty) {
  const playable = getPlayableColumns(board)
  if (!playable.length) return null

  const aiWinningMoves = getWinningMoves(board, 'Y')
  if (aiWinningMoves.length) {
    return randomChoice(aiWinningMoves)
  }

  // If opponent has an immediate win, decide whether to block it.
  const oppWinningMoves = getWinningMoves(board, 'R')
  const hasImmediateThreat = oppWinningMoves.length > 0

  if (difficulty === 'easy') {
    return randomChoice(playable)
  }

  // Medium: only win in 1 move, or block an opponent 1-move win.
  if (difficulty === 'medium') {
    if (!hasImmediateThreat) return randomChoice(playable)

    const blockingMoves = playable.filter((col) => {
      const sim = simulateDrop(board, col, 'Y')
      if (!sim) return false
      return getWinningMoves(sim.next, 'R').length === 0
    })

    if (blockingMoves.length) return randomChoice(blockingMoves)
    // If no move fully blocks, fall back to random (rare).
    return randomChoice(playable)
  }

  // Hard: immediate win / prevention take precedence, otherwise minimax.
  if (difficulty === 'hard') {
    if (hasImmediateThreat) {
      const blockingMoves = playable.filter((col) => {
        const sim = simulateDrop(board, col, 'Y')
        if (!sim) return false
        return getWinningMoves(sim.next, 'R').length === 0
      })
      if (blockingMoves.length) return randomChoice(blockingMoves)
      return randomChoice(playable)
    }

    const HARD_DEPTH = 4
    const scored = []
    for (const col of playable) {
      const sim = simulateDrop(board, col, 'Y')
      if (!sim) continue
      // Immediate wins already handled above.
      const score = minimax(sim.next, HARD_DEPTH - 1, -Infinity, Infinity, 'R')
      scored.push({ col, score })
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, Math.min(2, scored.length))
    return randomChoice(top.map((x) => x.col))
  }

  // Shouldn't happen, but keeps behavior defined.
  return randomChoice(playable)
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
    if (!isAITurn) return

    setAiThinking(true)

    const delay = difficulty === 'easy' ? 80 : difficulty === 'medium' ? 220 : 420

    const timeoutId = setTimeout(() => {
      const col = chooseAIMove(board, difficulty)
      if (col !== null) {
        dropInColumn(col)
      }
      setAiThinking(false)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      setAiThinking(false)
    }
  }, [isAITurn, board, difficulty])

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
    if (winner || isDraw) return
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
