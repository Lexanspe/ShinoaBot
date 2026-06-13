/**
 * classification.js
 * Reusable chess move classification engine.
 * Exports: getStockfishMove, classifyMove, checkChessDBBook,
 *          calculateWinProbability, evalToCp, getMaterialValue, getPieceValue,
 *          badgeSymbols, badgeFiles
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Chess } = require('chess.js');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const badgeFiles = {
    'best': 'best.png',
    'blunder': 'blunder.png',
    'mistake': 'mistake.png',
    'inaccuracy': 'inaccuracy.png',
    'brilliant': 'brilliant.png',
    'book': 'book.png',
    'excellent': 'excellent.png',
    'good': 'good.png',
    'great': 'great.png',
    'forced': 'forced.png',
    'miss': 'miss.png',
    'magnificent': 'magnificent.png'
};

const badgeSymbols = {
    'best': '<:bestmove:1142557786270605344>',
    'blunder': '<:blunder:1142557851974381628>',
    'mistake': '<:mistake:1142557842314903613>',
    'inaccuracy': '<:inaccuracy:1142557817065197568>',
    'brilliant': '<:brilliant:1142557780843184128>',
    'book': '<:bookmove:1142557808206815242>',
    'excellent': '<:excellent:1142557827102167120>',
    'good': '<:good:1142557799910477914>',
    'great': '<:greatmove:1142567767501971526>',
    'forced': '<:forcedmove:1145357874780971078>',
    'miss': '<:miss:1142567777002065930>',
    'magnificent': '<:magnificentmove:1145729516443017306>'
};

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

function evalToCp(evalData) {
    if (!evalData) return 0;
    if (evalData.mate !== null) {
        return evalData.mate > 0 ? 10000 - evalData.mate * 10 : -10000 - evalData.mate * 10;
    }
    if (evalData.evaluation !== null) {
        return parseFloat(evalData.evaluation) * 100;
    }
    return 0;
}

function getMaterialValue(fen) {
    const pieces = fen.split(' ')[0];
    let score = 0;
    for (let char of pieces) {
        switch (char) {
            case 'Q': score += 9; break;
            case 'R': score += 5; break;
            case 'B': score += 3; break;
            case 'N': score += 3; break;
            case 'P': score += 1; break;
            case 'q': score -= 9; break;
            case 'r': score -= 5; break;
            case 'b': score -= 3; break;
            case 'n': score -= 3; break;
            case 'p': score -= 1; break;
        }
    }
    return score;
}

function getPieceValue(piece) {
    if (!piece) return 0;
    const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    return vals[piece.toLowerCase()] || 0;
}

function calculateWinProbability(evalData) {
    if (!evalData) return 0.5;
    if (evalData.mate !== null) {
        if (evalData.mate > 0) return 1.0;
        if (evalData.mate < 0) return 0.0;
        return 0.5;
    }
    if (evalData.evaluation !== null && evalData.evaluation !== undefined) {
        const cp = parseFloat(evalData.evaluation) * 100;
        return 1 / (1 + Math.pow(10, -cp / 400));
    }
    return 0.5;
}

// ---------------------------------------------------------------------------
// Stockfish engine
// ---------------------------------------------------------------------------

const STOCKFISH_DIR = path.join(__dirname, '..', '..', 'stockfish');
let STOCKFISH_PATH = null;

if (fs.existsSync(STOCKFISH_DIR)) {
    // Klasör içindeki çalıştırılabilir dosyayı dinamik bul (Windows .exe, Mac/Linux uzantısız)
    function findStockfish(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = findStockfish(fullPath);
                if (found) return found;
            } else if (file.toLowerCase().includes('stockfish') && (file.endsWith('.exe') || !file.includes('.'))) {
                return fullPath;
            }
        }
        return null;
    }
    STOCKFISH_PATH = findStockfish(STOCKFISH_DIR);
}
async function getStockfishMove(fen, depth, multiPv = 1) {
    if (!STOCKFISH_PATH) return null;
    
    return new Promise((resolve) => {
        const safeDepth = Math.max(5, parseInt(depth) || 5);
        const engine = spawn(STOCKFISH_PATH);
        let bestmove = null;
        const pvs = {};
        const isWhiteToMove = fen.includes(' w ');

        engine.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('info depth')) {
                    const depthMatch = line.match(/depth (\d+)/);
                    const mpvMatch = line.match(/multipv (\d+)/);
                    const cpMatch = line.match(/score cp (-?\d+)/);
                    const mateMatch = line.match(/score mate (-?\d+)/);
                    const pvMatch = line.match(/ pv (.*)/);

                    if (depthMatch && mpvMatch && (cpMatch || mateMatch) && pvMatch) {
                        const d = parseInt(depthMatch[1]);
                        if (d === safeDepth) {
                            const rank = parseInt(mpvMatch[1]);
                            pvs[rank] = {
                                cp: cpMatch ? parseInt(cpMatch[1]) : null,
                                mate: mateMatch ? parseInt(mateMatch[1]) : null,
                                move: pvMatch[1].split(' ')[0]
                            };
                        }
                    }
                } else if (line.startsWith('bestmove')) {
                    const parts = line.split(' ');
                    if (parts.length > 1) bestmove = parts[1];
                    engine.kill();

                    let evalNum = 0.0;
                    let mateVal = null;
                    if (pvs[1]) {
                        if (pvs[1].mate !== null) {
                            mateVal = pvs[1].mate;
                            if (!isWhiteToMove) mateVal = -mateVal;
                        } else if (pvs[1].cp !== null) {
                            evalNum = pvs[1].cp / 100;
                            if (!isWhiteToMove) evalNum = -evalNum;
                        }
                    }

                    resolve({ move: bestmove, evaluation: evalNum, mate: mateVal, pvs });
                }
            }
        });

        engine.on('error', (err) => {
            console.error('Failed to start engine:', err);
            resolve({ move: null, evaluation: 0.0, mate: null, pvs: {} });
        });

        engine.stdin.write('uci\n');
        engine.stdin.write(`setoption name MultiPV value ${multiPv}\n`);
        engine.stdin.write('setoption name Threads value 8\n');
        engine.stdin.write('setoption name Hash value 128\n');
        engine.stdin.write(`position fen ${fen}\n`);
        engine.stdin.write(`go depth ${safeDepth}\n`);
    });
}

// ---------------------------------------------------------------------------
// ChessDB book-move check
// ---------------------------------------------------------------------------

async function checkChessDBBook(fen, moveObj) {
    try {
        const url = `http://www.chessdb.cn/cdb.php?action=queryall&board=${encodeURIComponent(fen)}`;
        const response = await fetch(url);

        if (!response.ok) return false;

        const text = await response.text();
        if (text.includes('unknown') || text.trim() === '') return false;

        const uci = moveObj.from + moveObj.to + (moveObj.promotion || '');
        const moves = text.split('|');

        for (let m of moves) {
            if (m.startsWith(`move:${uci}`)) {
                const rankMatch = m.match(/rank:(\d+)/);
                if (rankMatch && parseInt(rankMatch[1]) > 0) {
                    return true;
                }
            }
        }
    } catch (e) {
        console.error('ChessDB API error:', e.message);
    }
    return false;
}

// ---------------------------------------------------------------------------
// Full move classifier (Brilliant / Great / Best / Miss / Book / Blunder …)
// ---------------------------------------------------------------------------

async function classifyMove(evalBefore, evalAfter, isWhiteMove, pvs = null, moveObj = null, fenBefore = null, previousMoveClass = '') {
    const pBefore = calculateWinProbability(evalBefore);
    const pAfter = calculateWinProbability(evalAfter);

    const myPBefore = isWhiteMove ? pBefore : (1 - pBefore);
    const myPAfter = isWhiteMove ? pAfter : (1 - pAfter);

    let deltaP = myPBefore - myPAfter;
    if (deltaP < 0) deltaP = 0;

    // Easter Egg: Bongcloud (King moves on the 2nd full move of the game for either side)
    if (fenBefore && moveObj) {
        const parts = fenBefore.split(' ');
        const fullmove = parts[5];
        // If it's move 2 (meaning 1. e4 e5 has been played, we are on move 2)
        if (fullmove === '2' && moveObj.piece === 'k') {
            return 'magnificent';
        }
    }

    // Forced move
    if (fenBefore) {
        const preFen = new Chess(fenBefore);
        if (preFen.moves().length === 1) return 'forced';
    }

    let isBestMove = false;
    let isGreatCandidate = false;

    // Best / Great candidate check
    if (pvs && pvs[1] && moveObj) {
        const uciMove = moveObj.from + moveObj.to + (moveObj.promotion || '');
        if (pvs[1].move === uciMove) {
            isBestMove = true;
            if (pvs[2]) {
                const cp1 = pvs[1].cp !== null ? pvs[1].cp / 100 : null;
                const mate1 = pvs[1].mate !== null ? pvs[1].mate : null;
                const cp2 = pvs[2].cp !== null ? pvs[2].cp / 100 : null;
                const mate2 = pvs[2].mate !== null ? pvs[2].mate : null;

                const p1 = calculateWinProbability({ evaluation: cp1, mate: mate1 });
                const p2 = calculateWinProbability({ evaluation: cp2, mate: mate2 });
                const myP1 = isWhiteMove ? p1 : (1 - p1);
                const myP2 = isWhiteMove ? p2 : (1 - p2);

                if ((myP1 - myP2) >= 0.15) {
                    isGreatCandidate = true;
                } else if (pvs[1].cp !== null && pvs[2].cp !== null) {
                    const cpDiff = isWhiteMove ? (pvs[1].cp - pvs[2].cp) : (pvs[2].cp - pvs[1].cp);
                    if (cpDiff >= 150) isGreatCandidate = true;
                }
            }
        }
    }

    // Brilliant check (sacrifice that works)
    if (moveObj && fenBefore) {
        const myColor = isWhiteMove ? 'w' : 'b';
        const opColor = isWhiteMove ? 'b' : 'w';

        const tempChess = new Chess(fenBefore);
        tempChess.move(moveObj);
        let maxLoss = 0;
        let hangingPieceVal = 0;
        const oppMoves = tempChess.moves({ verbose: true });
        for (let oppMove of oppMoves) {
            if (oppMove.captured) {
                const capVal = getPieceValue(oppMove.captured);
                if (capVal >= 3) {
                    const capngVal = getPieceValue(oppMove.piece);
                    const isDefended = tempChess.isAttacked(oppMove.to, myColor);
                    const nL = isDefended ? (capVal - capngVal) : capVal;
                    if (nL > maxLoss) {
                        maxLoss = nL;
                        hangingPieceVal = capVal;
                    }
                }
            }
        }

        // Zwischenzug filter
        let maxCounterAttackVal = 0;
        const board = tempChess.board();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] && board[r][c].color === opColor) {
                    const sq = board[r][c].square;
                    if (tempChess.isAttacked(sq, myColor)) {
                        const val = getPieceValue(board[r][c].type);
                        if (val > maxCounterAttackVal) maxCounterAttackVal = val;
                    }
                }
            }
        }

        const ourGain = moveObj.captured ? getPieceValue(moveObj.captured) : 0;
        const netSacrifice = maxLoss - ourGain;

        if (netSacrifice >= 2 && maxCounterAttackVal < hangingPieceVal) {
            let couldSave = false;
            const preFen = new Chess(fenBefore);
            for (let myMove of preFen.moves({ verbose: true })) {
                if (myMove.from === moveObj.from && myMove.to === moveObj.to) continue;

                const testChess = new Chess(fenBefore);
                testChess.move(myMove);

                let thisMaxLoss = 0;
                for (let testOppMove of testChess.moves({ verbose: true })) {
                    if (testOppMove.captured) {
                        const capVal = getPieceValue(testOppMove.captured);
                        if (capVal >= 3) {
                            const capngVal = getPieceValue(testOppMove.piece);
                            const def = testChess.isAttacked(testOppMove.to, myColor);
                            const nL = def ? (capVal - capngVal) : capVal;
                            if (nL > thisMaxLoss) thisMaxLoss = nL;
                        }
                    }
                }

                const thisGain = myMove.captured ? getPieceValue(myMove.captured) : 0;
                const thisNetSacrifice = thisMaxLoss - thisGain;

                if (thisNetSacrifice < 2) {
                    let altLoses = false;
                    if (pvs) {
                        const myUci = myMove.from + myMove.to + (myMove.promotion || '');
                        const altPv = Object.values(pvs).find(p => p.move === myUci);
                        if (altPv) {
                            const altEval = { evaluation: altPv.cp !== null ? altPv.cp / 100 : null, mate: altPv.mate };
                            const pAlt = calculateWinProbability(altEval);
                            const myPAlt = isWhiteMove ? pAlt : (1 - pAlt);
                            const altDeltaP = myPBefore - myPAlt;
                            if (altDeltaP >= 0.30 || (altPv.mate !== null && ((isWhiteMove && altPv.mate < 0) || (!isWhiteMove && altPv.mate > 0)))) {
                                altLoses = true;
                            }
                        }
                    }
                    if (!altLoses) {
                        couldSave = true;
                        break;
                    }
                }
            }

            if (couldSave) {
                if (deltaP <= 0.02) {
                    return 'brilliant';
                } else {
                    // Deep verification
                    const deepEval = await getStockfishMove(tempChess.fen(), 20, 1);
                    const deepPAfter = calculateWinProbability(deepEval);
                    const myDeepPAfter = isWhiteMove ? deepPAfter : (1 - deepPAfter);
                    let newDeltaP = myPBefore - myDeepPAfter;
                    if (newDeltaP < 0) newDeltaP = 0;
                    if (newDeltaP <= 0.02) return 'brilliant';
                }
            }
        }
    }

    // Great check
    if (isGreatCandidate && moveObj && fenBefore) {
        if (previousMoveClass === 'blunder') return 'great'; // Blunder Punishment Override

        const movingVal = getPieceValue(moveObj.piece);
        const capturedVal = getPieceValue(moveObj.captured);
        const isTrade = moveObj.captured && Math.abs(movingVal - capturedVal) <= 1;
        const preFen = new Chess(fenBefore);
        const pieceWasUnderAttack = preFen.isAttacked(moveObj.from, isWhiteMove ? 'b' : 'w');
        const isDefensiveRetreat = pieceWasUnderAttack && !moveObj.captured;
        if (!isTrade && !isDefensiveRetreat) return 'great';
    }

    // Miss check
    if (evalBefore && evalAfter) {
        if ((evalBefore.mate > 0 && isWhiteMove) || (evalBefore.mate < 0 && !isWhiteMove)) {
            if (evalAfter.mate === null && deltaP > 0.10) return 'miss';
        }
    }

    if ((previousMoveClass === 'blunder' || previousMoveClass === 'mistake') && deltaP >= 0.15) {
        return 'miss';
    }

    if (isBestMove) return 'best';
    if (deltaP >= 0.30) return 'blunder';
    if (deltaP >= 0.15) return 'mistake';
    if (deltaP >= 0.05) return 'inaccuracy';
    if (deltaP >= 0.02) return 'good';
    if (deltaP >= 0.01) return 'excellent';

    return 'best';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    getStockfishMove,
    classifyMove,
    checkChessDBBook,
    calculateWinProbability,
    evalToCp,
    getMaterialValue,
    getPieceValue,
    badgeSymbols,
    badgeFiles,
};
