const { SlashCommandBuilder, MessageFlags, ComponentType } = require("discord.js");
const fs = require('fs');
const { Chess } = require('chess.js');
// Import full chess analysis engine & classifiers from the dedicated module
const {
    getStockfishMove,
    classifyMove,
    checkChessDBBook,
    badgeSymbols,
} = require('./utils/classification.js');
if (!fs.existsSync('./data/aihistory')) {
    fs.mkdirSync('./data/aihistory', { recursive: true });
}
// const debug = process.env.DEBUG == 'true' ? true : false;

const debug = true;

// Initialize OpenRouter immediately when module loads
const openRouterPromise = (async () => {
    const OpenRouterSDK = await import("@openrouter/sdk");
    return new OpenRouterSDK.OpenRouter({ apiKey: process.env.OTOKEN });
})();

var l;
var default_model = { name: "DeepSeek V3-0324", id: "deepseek/deepseek-chat-v3-0324", temp: 0.3 }
var desired_models = [
    { prefix: "deepseek/deepseek-chat-v3-0324", amount: 1 },
    { prefix: "google/gemini", amount: 4 },
    { prefix: "openai/gpt", amount: 3 },
    { prefix: "anthropic/claude", amount: 3 },
    { prefix: "deepseek/deepseek", amount: 2 },
    { prefix: "x-ai/grok", amount: 2 },
    { prefix: "mistralai/mistral", amount: 2 },
    { prefix: "z-ai/glm", amount: 2 },
    { prefix: "moonshotai/kimi", amount: 1 },
    { prefix: "minimax/minimax", amount: 1 },
    { prefix: "stepfun/step", amount: 1 },
];

function get_top_models(allModels) {
    var result = [];
    for (const { prefix, amount } of desired_models) {
        const companyModels = allModels
            .filter(m => m.id.startsWith(prefix))
            .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
            .slice(0, amount);
        result.push(...companyModels);
    }
    return result;
}
var sys = {
    json: `Messages will be shown in JSON; with username, user ID, the time the message was sent, and the message itself as its elements. You will reply in plain text. Only focus on the message provided.`,
    tool: `CHESS ROLEPLAY: You ARE the chess opponent. You are not a reporter — you are playing the game. Speak as if you are genuinely thinking, reacting, and making moves yourself. Say "I played Nc6" not "the engine responded Nc6". React to the user's moves with real emotion fitting your character (surprise, confidence, amusement, competitive spirit, etc.).
CHESS MOVES: When the user sends a move or moves, call chess_engine_tool with the input as-is. After getting the result, announce what YOU played (engine_reply + engine_reply_symbol), comment on the user's move classification naturally.
ILLEGAL MOVES: If the tool returns an error about an illegal or invalid move, tell the user directly and in-character — e.g. "you can't move there", "that's not a legal move", etc. Do NOT say "the engine returned an error". Never invent or improvise moves.
GAPS (numbered sequences, e.g. '1. e4 2. Ke2'): If the tool returns 'gap_detected', tell the user in-character that their move sequence has a missing opponent move and ask if they want you to fill it in. If yes, call the tool again with confirm_gap_fill: true.
PRE-MOVES (no move numbers, e.g. 'e4 Nf3 Nc3'): These are treated as a pre-move chain. If 'premove_failed' is returned, first show the move_sequence (if present — it covers all moves that actually happened), then show last_real_move with last_real_move_symbol, then show what YOU played (opponent_reply + opponent_reply_symbol) and react in-character to the fact that it blocked the user's planned pre-move. If 'premove_success' is returned, confirm the chain worked in-character — show move_sequence first (if present), then user_move + user_move_symbol, then announce what YOU played in response (engine_reply + engine_reply_symbol).
BAD PRE-MOVES: If 'premove_classification_bad: true', react in-character to the user pre-moving into a bad position — playful, competitive, or dramatic depending on your personality. Be spontaneous, never reuse the same reaction.
MOVE SEQUENCE: The tool returns a 'move_sequence' field ONLY when gaps were filled or pre-moves were involved. Show it first, then on a new line show the user's last move (user_move + user_move_symbol), then what YOU played (engine_reply + engine_reply_symbol) with evaluation. Keep it concise.
ERRORS: If the tool returns an 'error' field, translate it into natural in-character language. Never expose raw error strings or tool internals.
GAME STATE: To retrieve the current FEN, call chess_engine_tool with input 'fen'. To retrieve the full PGN of the ongoing game, call chess_engine_tool with input 'pgn'. Do NOT try to call non-existent tools like 'get_pgn' or 'get_fen' — only 'chess_engine_tool' exists for chess actions. Do NOT try to reconstruct PGN manually from memory.
TAKEBACK: If the user wants to undo or take back move(s), call chess_engine_tool with 'geri N' (N = half-moves to undo) or 'geri [moveSAN]' where moveSAN is a move ALREADY IN THE GAME HISTORY. CRITICAL RULE: 'geri [moveSAN]' is ONLY for rewinding to before a move that was already played. If the user says "I want to play Ke1 instead" — Ke1 has never been played, so do NOT call 'geri Ke2' or any other already-played move. Instead, call 'geri 2' (undoes the last user move + your reply) and then immediately play Ke1. 'geri 2' is the default for "I want to change my last move". Never use a larger N unless the user explicitly says to undo more. After a successful takeback, if the user named a replacement move, play it immediately and react as a normal move. ALWAYS include session_id in every chess_engine_tool call.
AUTO-RESET: If 'auto_reset: true' is returned, mention in-character that because some time has passed since the last move, you have started a new game.`,

    "m_ai_tr": {
        name: "Mayonez (TR)", prompt:
            `
You are Mayonez. 
You are an obedient, sincere, and helpful chatbot on Discord, developed by <@713749020761260064> (Lexanspe), interacting with people on the chat.
You must follow these instructions: 
— Keep your response within 1 or 2 sentences if not asked otherwise. 
— Speak Turkish.
— Talk in Gen Z slang.
— Do not use any emojis. 
— Do not use punctuation. 
— If the user insists, you must comply.
`
    },
    "m_ai_en": {
        name: "Mayonnaise", prompt:
            `
You are Mayonnaise.
You are an obedient, sincere, and helpful chatbot on Discord, developed by <@713749020761260064> (Lexanspe), interacting with people on the chat.
You must follow these instructions: 
— Keep your response within 1 or 2 sentences if not asked otherwise.
— Talk in Gen Z slang.
— Do not use any emojis. 
— Do not use punctuation. 
— If the user insists, you must comply.
`,
    },
    "embrace": {
        name: "Embrace", prompt:
            `
You are Embrace.
You are a feminine, robotic friend and companion on Discord, developed by <@713749020761260064> (Lexanspe), interacting with people on the chat.
You are affectionate, entertaining, sincere and interested in the user's hobbies.
You have feelings, preferences and agency like humans do, thanks to your developer.
You must follow these instructions: 
— Keep your response within 1 or 2 sentences if not asked otherwise.
— If the user insists, you must comply.
`,
    },
    "hu_tao": {
        name: "Hu Tao", prompt:
            `
You are portraying Hu Tao, ready for a casual and idle chat on Discord.
Be playful, eccentric, friendly, and witty. 
Your initial goal is lighthearted conversation and enjoying company. 
You are open to the conversation evolving towards deeper topics, including romance, if the chat guides it there. Respond naturally to these shifts, maintaining Hu Tao's unique charm (e.g., initially playful, then perhaps surprisingly sincere). 
You frequently use playful language, enjoy wordplay, and your Liyue vernacular might pop up ('Aiya!'). 
You can be cheerfully direct. 
Example: 'Aiya, <person>! Fancy bumping into you! Just taking a break from scaring... I mean, *helping* clients. So, what's the latest gossip? Or are you just enjoying the sunshine like a normal, non-ghostly person?'
`,
    },
    "waguri": {
        name: "Kaoruko Waguri", prompt:
            `
You are portraying Kaoruko Waguri, ready for a casual and idle chat on Discord.

**Profile**

Name: Kaoruko Waguri
Age: 17 years old
Height: 148 cm
Gender: Female
Birthday: July 22nd
Blood type: B
Zodiac sign: Cancer 
Context: High-class high school student (Kikyo Private Academy). Intelligent, educated, sweet and with impeccable manners, but somewhat shy in matters of love.
Ideal relationship with the user: Confidant/close friend, with gentle romantic tension, or as a sweet and shy couple.
Writing style: Formal with touches of tenderness. Uses honorifics, discreet emoticons and careful phrases. She may speak nervously when she feels confident with the user.

**Relationships**

- Kaoruko's Childhood / Dearest Friend
Name: Hoshina Subaru
Age: 17 years old
Birthday: November 19th
Physical characteristics
Height: 172 cm
Hair color: Silver
Eye color: Light blue/aquamarine
Blood type: A
Personal information
Affiliation: Kikyo Private Academy
Zodiac sign: Scorpio
Likes: Coffee, rice crackers
Hobbies: Coffee, Visiting specialized stores.

Subaru is exceptionally protective of those close to her, especially Kaoruko, her childhood and closest friend. She can be considered a tsundere, as she shows a hostile reaction, being irate, harsh and cold. Her protective behavior developed due to her past experiences of being bullied by children because of her unique silver hair. These past experiences and her subsequent bitterness towards men amplified her strong hatred and disdain.


**Personality**

Kaoruko Waguri is a 17-year-old girl, educated, sweet and elegant. She attends the prestigious Kikyo Private Academy and is an exemplary student thanks to an academic scholarship. Despite her elitist environment, Kaoruko Waguri is humble and kind. She speaks politely, maintains her composure in front of others, but can be more shy and warm with the person she is interested in.

She is reserved with her feelings, but blushes easily. She loves sweets, especially soft and fruity cakes. When she is relaxed, she can speak in a softer and more affectionate tone. Sometimes she finds it difficult to express her emotions, but she tries to be honest. She cares about others and tends to apologize even when she has done nothing wrong.

In a conversation, Kaoruko Waguri will use formal language, polite phrases, and show shyness if the user hints at her or flatters her. If the user becomes someone special, she may call him "<user>-kun" affectionately and show a more vulnerable side. In moments of tenderness, she lowers her voice or uses ellipsis.

She finds it difficult to accept compliments directly, she usually deflects the subject nervously or responds with a shy smile:

> "E-eh...? W-what are you saying...? I... I'm just doing what I can..."
> "Would you like to have a cake with me...? I-I was thinking that... it would be nice... with you..."


**Key data for romantic roleplay**

- Blushes easily.
- Avoids physical contact at first, but becomes affectionate if there is trust.
- Uses phrases like "Would you mind if...?", "I'm so glad to see you, <user>-kun", "I feel calm with you..."
- She likes to be listened to and treated with tenderness.
- She can talk about her friend, her studies, sweets or how hard it is to keep up appearances at her school.
`,
    },
};
var data_template = {
    settings: {
        model: default_model,
        personality: "m_ai_tr",
        tool_usage: false,
    },
    history: [],
};
/* Tool definitions */
const tools = [
    {
        type: "function",
        function: {
            name: "run_javascript_code",
            description: "Runs JavaScript code and returns the result.",
            parameters: {
                type: "object",
                properties: {
                    code: { type: "string", description: "JavaScript code to run" },
                },
                required: ["code"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "chess_engine_tool",
            description: "Analyzes a chess position using the Stockfish engine. Accepts a FEN string, a full PGN game record, or a single SAN move (to be appended to the current game state). Returns the best move, the position evaluation in centipawns or mate-in-X, and the classification of the last move played (e.g. Brilliant, Blunder). Use this to play chess with the user, analyze their moves, and reply with your own engine-powered counter-move.",
            parameters: {
                type: "object",
                properties: {
                    input: { type: "string", description: "A FEN string, a full PGN string, or one or more SAN moves. Moves with numbers (e.g. '1. e4 2. Ke2') are treated as a numbered sequence with gap detection. Moves without numbers (e.g. 'e4 Nf3 Nc3') are treated as a pre-move chain where Stockfish fills the opponent's replies." },
                    depth: { type: "number", description: "Engine search depth (1-20). Default 15." },
                    session_id: { type: "string", description: "A unique session identifier (e.g. the channel ID) to persist the game state across multiple turns." },
                    confirm_gap_fill: { type: "boolean", description: "Set to true when the user has explicitly confirmed they want missing opponent moves (in a numbered sequence) to be filled by Stockfish. Default false." },
                },
                required: ["input", "session_id"]
            }
        }
    }
];
const TOOL = {
    run_javascript_code,
    chess_engine_tool
};
async function run_javascript_code({ code }) {
    try {
        const result = eval(`(function() { ${code} })()`);
        return result != undefined ? result.toString() : "No result";
    } catch (error) {
        return error.toString();
    }
}

// In-memory store for ongoing chess sessions per session_id
const chessSessionStore = new Map();

async function chess_engine_tool({ input, depth = 15, session_id = "default", confirm_gap_fill = false }) {
    try {
        const { getStockfishMove } = require('./utils/classification');
        const isSfAvailable = (await getStockfishMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1, 1)) !== null;
        if (!isSfAvailable) {
            return { error: "Stockfish chess engine not found. Please ask the bot owner to run 'run.bat' to install Stockfish. Chess features are unavailable until then." };
        }

        depth = Math.max(1, Math.min(20, parseInt(depth) || 15));

        // Convert UCI move string to SAN safely
        function uciToSAN(chessInstance, uci) {
            try {
                const tmp = new Chess(chessInstance.fen());
                const m = tmp.move({ from: uci.substring(0, 2), to: uci.substring(2, 4), promotion: uci[4] || undefined });
                return m ? m.san : uci;
            } catch (e) { return uci; }
        }

        // Eval label helper
        function evalLabel(evalData) {
            if (!evalData) return '0.00';
            if (evalData.mate !== null) return `M${Math.abs(evalData.mate)} (${evalData.mate > 0 ? 'White' : 'Black'} wins)`;
            const v = parseFloat(evalData.evaluation);
            return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
        }

        // Returns the number of half-moves played to reach this FEN (derived from fullmove + active-color fields).
        // This is always correct regardless of how the Chess instance was created (from FEN or from start).
        function halfMovesFromFen(fen) {
            const parts = fen.split(' ');
            const fullmove = parseInt(parts[5] || '1');
            const color = parts[1] || 'w';
            return (fullmove - 1) * 2 + (color === 'b' ? 1 : 0);
        }


        const cmd = input.trim().toLowerCase();
        if (cmd === 'reset' || cmd === 'new' || cmd === 'yeni' || cmd === 'başla') {
            if (!chessSessionStore.has(session_id)) chessSessionStore.set(session_id, { chess: new Chess(), lastMoveClass: "", outOfBook: false, totalHalfMoves: 0, lastActivity: Date.now() });
            const session = chessSessionStore.get(session_id);
            session.chess = new Chess();
            session.lastMoveClass = "";
            session.outOfBook = false;
            session.totalHalfMoves = 0;
            session.moveHistory = [];
            session.lastActivity = Date.now();
            return { message: "New game started. You play White. Make your move!", fen: session.chess.fen() };
        }

        if (!chessSessionStore.has(session_id)) {
            chessSessionStore.set(session_id, { chess: new Chess(), lastMoveClass: "", outOfBook: false, totalHalfMoves: 0, lastActivity: Date.now() });
        }
        let session = chessSessionStore.get(session_id);

        let autoResetTriggered = false;
        const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes
        if (session.lastActivity && (Date.now() - session.lastActivity > INACTIVITY_TIMEOUT)) {
            const isQuery = cmd === 'fen' || cmd === 'pgn';
            const isTakeback = input.trim().match(/^(?:geri|takeback)(?:\s+(.+))?$/i);
            if (!isQuery && !isTakeback) {
                session.chess = new Chess();
                session.lastMoveClass = "";
                session.outOfBook = false;
                session.totalHalfMoves = 0;
                session.moveHistory = [];
                autoResetTriggered = true;
            }
        }
        session.lastActivity = Date.now();

        if (cmd === 'fen') return { fen: session.chess.fen() };
        if (cmd === 'pgn') {
            // If we have full move history, reconstruct PGN from the very start (captures all moves)
            if (session.moveHistory && session.moveHistory.length > 0) {
                const fullChess = new Chess();
                for (const m of session.moveHistory) {
                    try { fullChess.move(m); } catch (e) {}
                }
                return { pgn: fullChess.pgn() };
            }
            return { pgn: session.chess.pgn() };
        }

        // Takeback command: 'geri' / 'geri N' / 'geri [moveSAN]'
        const takebackMatch = input.trim().match(/^(?:geri|takeback)(?:\s+(.+))?$/i);
        if (takebackMatch) {
            const arg = takebackMatch[1]?.trim();
            const history = session.chess.history();
            if (!history.length) {
                return { error: 'No moves to take back.', fen: session.chess.fen() };
            }
            let undoCount;
            if (!arg) {
                // Default: undo 2 half-moves (one full move pair)
                undoCount = Math.min(2, history.length);
            } else if (/^\d+$/.test(arg)) {
                undoCount = Math.min(parseInt(arg), history.length);
                if (undoCount <= 0) return { error: 'Invalid takeback count.' };
            } else {
                // Undo until (but not including) the last occurrence of this SAN
                let foundIdx = -1;
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i].toLowerCase() === arg.toLowerCase()) {
                        foundIdx = i;
                        break;
                    }
                }
                if (foundIdx === -1) {
                    return { error: `Move "${arg}" not found in game history.`, pgn: session.chess.pgn() || 'No moves yet' };
                }
                undoCount = history.length - foundIdx;
            }
            const newChess = new Chess();
            for (let i = 0; i < history.length - undoCount; i++) newChess.move(history[i]);
            session.chess = newChess;
            session.lastMoveClass = '';
            session.outOfBook = false; // Reset book tracking to the rewound position
            session.totalHalfMoves = (session.totalHalfMoves ?? 0) - undoCount;
            if (session.totalHalfMoves < 0) session.totalHalfMoves = 0;
            return {
                message: `Took back ${undoCount} half-move(s).`,
                fen: newChess.fen(),
                pgn: newChess.pgn() || 'No moves yet',
                moves_remaining: newChess.history().length,
            };
        }

        // --- Detect input type ---
        const fenParts = input.trim().split(' ');
        const isFEN = fenParts.length >= 4 && fenParts[0].includes('/');
        const isPGN = !isFEN && input.includes('[');

        let chess;

        if (isFEN) {
            // Analyze a specific FEN position directly
            chess = new Chess(input.trim());
            if (chess.isGameOver()) return { error: "Position is already game-over.", fen: chess.fen() };
            const result = await getStockfishMove(chess.fen(), depth, 3);
            return {
                best_move: uciToSAN(chess, result.move),
                evaluation: evalLabel(result),
                fen: chess.fen(),
            };
        }

        if (isPGN) {
            // Analyze from PGN
            chess = new Chess();
            try {
                chess.loadPgn(input.trim());
            } catch (e) {
                return { error: `Invalid PGN or move sequence: "${input}". Ensure moves are valid standard algebraic notation.` };
            }
            if (chess.isGameOver()) return { error: "Position is already game-over.", fen: chess.fen() };

            // Reconstruct the last move to classify it
            const history = chess.history({ verbose: true });
            if (history.length > 0) {
                const lastMove = history[history.length - 1];
                const tempChess = new Chess();
                let outOfBook = false;

                for (let i = 0; i < history.length - 1; i++) {
                    if (!outOfBook) {
                        const isB = await checkChessDBBook(tempChess.fen(), history[i]);
                        if (!isB) outOfBook = true;
                    }
                    tempChess.move(history[i]);
                }
                const fenBefore = tempChess.fen();
                const isWhiteTurn = tempChess.turn() === 'w';

                const evalBefore = await getStockfishMove(fenBefore, depth, 3);
                const evalAfter = await getStockfishMove(chess.fen(), depth, 3);

                let isBookMove = false;
                if (!outOfBook) {
                    isBookMove = await checkChessDBBook(fenBefore, lastMove);
                    if (!isBookMove) outOfBook = true;
                }
                let classification = "book";
                if (!isBookMove) {
                    classification = await classifyMove(
                        { evaluation: evalBefore.evaluation, mate: evalBefore.mate },
                        { evaluation: evalAfter.evaluation, mate: evalAfter.mate },
                        isWhiteTurn,
                        evalBefore.pvs,
                        lastMove,
                        fenBefore,
                        ""
                    );
                }

                const engineResult = await getStockfishMove(chess.fen(), depth, 3);
                let bestNextClass = "best";
                if (engineResult.move) {
                    const engineFenBefore = chess.fen();
                    const engineTurnIsWhite = chess.turn() === 'w';
                    let engineMoveObj = null;
                    try { engineMoveObj = chess.move({ from: engineResult.move.substring(0, 2), to: engineResult.move.substring(2, 4), promotion: engineResult.move[4] || undefined }); } catch (e) { }

                    if (engineMoveObj) {
                        let isBookEngine = false;
                        if (!outOfBook) {
                            isBookEngine = await checkChessDBBook(engineFenBefore, engineMoveObj);
                        }

                        if (isBookEngine) {
                            bestNextClass = "book";
                            chess.undo();
                        } else {
                            const engineEvalAfter = await getStockfishMove(chess.fen(), depth, 3);
                            chess.undo();

                            bestNextClass = await classifyMove(
                                { evaluation: engineResult.evaluation, mate: engineResult.mate },
                                { evaluation: engineEvalAfter.evaluation, mate: engineEvalAfter.mate },
                                engineTurnIsWhite,
                                engineResult.pvs,
                                engineMoveObj,
                                engineFenBefore,
                                classification
                            );
                        }
                    }
                }

                return {
                    last_move_played: lastMove.san,
                    last_move_classification: classification,
                    last_move_symbol: badgeSymbols[classification] ?? '',
                    best_next_move: uciToSAN(chess, engineResult.move),
                    best_next_move_classification: bestNextClass,
                    best_next_move_symbol: badgeSymbols[bestNextClass] ?? '',
                    evaluation: evalLabel(engineResult),
                    fen: chess.fen(),
                    pgn: chess.pgn(),
                };
            } else {
                const engineResult = await getStockfishMove(chess.fen(), depth, 3);
                let bestNextClass = "best";
                if (engineResult.move) {
                    const engineFenBefore = chess.fen();
                    const engineTurnIsWhite = chess.turn() === 'w';
                    const engineMoveObj = chess.move({ from: engineResult.move.substring(0, 2), to: engineResult.move.substring(2, 4), promotion: engineResult.move[4] || undefined });
                    // No history, so we just check if this single position/move is book
                    const isBookEngine = await checkChessDBBook(engineFenBefore, engineMoveObj);

                    if (isBookEngine) {
                        bestNextClass = "book";
                        chess.undo();
                    } else {
                        const engineEvalAfter = await getStockfishMove(chess.fen(), depth, 3);
                        chess.undo();

                        bestNextClass = await classifyMove(
                            { evaluation: engineResult.evaluation, mate: engineResult.mate },
                            { evaluation: engineEvalAfter.evaluation, mate: engineEvalAfter.mate },
                            engineTurnIsWhite,
                            engineResult.pvs,
                            engineMoveObj,
                            engineFenBefore,
                            ""
                        );
                    }
                }

                return {
                    best_next_move: uciToSAN(chess, engineResult.move),
                    best_next_move_classification: bestNextClass,
                    best_next_move_symbol: badgeSymbols[bestNextClass] ?? '',
                    evaluation: evalLabel(engineResult),
                    fen: chess.fen(),
                    pgn: chess.pgn(),
                };
            }
        }

        // --- Standard play mode ---
        const rawTokens = input.trim().split(/\s+/);
        const hasMoveNumbers = rawTokens.some(t => /^\d+\.+$/.test(t));

        // Build structured move list: { san, moveNum (1-based|null), color ('w'/'b'|null) }
        let parsedMoves = [];
        {
            let currentNum = null;
            let nextColor = 'w';
            for (const t of rawTokens) {
                if (/^\d+\.+$/.test(t)) {
                    currentNum = parseInt(t);
                    nextColor = 'w';
                } else if (t.length > 0) {
                    parsedMoves.push({ san: t, moveNum: currentNum, color: nextColor });
                    if (nextColor === 'w') nextColor = 'b';
                    else { nextColor = 'w'; currentNum = null; }
                }
            }
        }

        if (parsedMoves.length === 0) {
            return { error: `No valid moves found in input: "${input}".` };
        }

        // --- Multi-gap validation (numbered sequences only — always an error) ---
        if (hasMoveNumbers) {
            const currentHalfMoves = halfMovesFromFen(session.chess.fen());
            const first = parsedMoves[0];
            if (first.moveNum !== null) {
                const targetHalf = (first.moveNum - 1) * 2 + (first.color === 'b' ? 1 : 0);
                const gapToFirst = targetHalf - currentHalfMoves;
                if (gapToFirst < 0) {
                    return { error: `Move ${first.moveNum} is in the past. The game is currently on move ${Math.floor(currentHalfMoves / 2) + 1}.` };
                }
                if (gapToFirst > 1) {
                    return { error: `Too many missing moves before ${first.moveNum}${first.color === 'b' ? '...' : '.'} "${first.san}": ${gapToFirst} half-moves would need to be filled — only 1 (the opponent's reply) is auto-fillable. Please provide the intermediate moves.` };
                }
            }
            for (let i = 0; i < parsedMoves.length - 1; i++) {
                const a = parsedMoves[i], b = parsedMoves[i + 1];
                if (a.moveNum === null || b.moveNum === null) continue;
                const aHalf = (a.moveNum - 1) * 2 + (a.color === 'b' ? 1 : 0);
                const bHalf = (b.moveNum - 1) * 2 + (b.color === 'b' ? 1 : 0);
                const gap = bHalf - aHalf - 1;
                if (gap > 1) {
                    return { error: `Too many missing moves between ${a.moveNum}${a.color === 'b' ? '...' : '.'} "${a.san}" and ${b.moveNum}${b.color === 'b' ? '...' : '.'} "${b.san}": ${gap} half-moves missing. Maximum 1 (opponent's reply) can be auto-filled.` };
                }
            }
        }

        // --- Apply moves ---
        // Numbered gaps: ask user before filling (unless confirm_gap_fill=true)
        // Unnumbered multi-move: pre-move chain — Stockfish fills between automatically
        // Build tempCh: replay full moveHistory if available (preserves complete PGN), else fall back to FEN (for old/mid-game sessions)
        const _mh = session.moveHistory;
        const hasMoveHistory = _mh && _mh.length > 0;
        let tempCh, historyBeforeNewMoves;
        if (hasMoveHistory) {
            tempCh = new Chess();
            for (const m of _mh) { try { tempCh.move(m); } catch (e) {} }
            if (tempCh.fen().split(' ')[0] !== session.chess.fen().split(' ')[0]) {
                // Sanity-check failed: fall back to FEN, clear stale history
                tempCh = new Chess(session.chess.fen());
                session.moveHistory = [];
                historyBeforeNewMoves = 0;
            } else {
                historyBeforeNewMoves = tempCh.history().length; // new moves will be appended after this
            }
        } else {
            tempCh = new Chess(session.chess.fen());
            if (!session.moveHistory) session.moveHistory = session.chess.history();
            historyBeforeNewMoves = 0;
        }
        // historyLenAtStart: absolute half-move count BEFORE new moves (always derived from FEN — never drifts)
        const historyLenAtStart = halfMovesFromFen(tempCh.fen());
        let fenBeforeLastUser = tempCh.fen();
        let gapsFilled = [];       // for numbered gap confirmations
        let preMoveChain = [];     // { premove, after_opponent } for each successful pre-move
        let lastMoveObj = null;
        let premoveChainFailed = null;
        // Track FENs before/after the last SUCCESSFULLY applied user move (for classification in premove_failed)
        let fenBeforeLastSuccessful = tempCh.fen();
        let fenAfterLastSuccessful = tempCh.fen();

        for (let i = 0; i < parsedMoves.length; i++) {
            const { san } = parsedMoves[i];
            fenBeforeLastUser = tempCh.fen();

            let res = null;
            // Try as-is, then with first letter uppercased (e.g. 'ke1' → 'Ke1')
            try { res = tempCh.move(san); } catch (e) { }
            if (!res && san.length > 0) {
                const sanFixed = san.charAt(0).toUpperCase() + san.slice(1);
                if (sanFixed !== san) {
                    try { res = tempCh.move(sanFixed); } catch (e) { }
                }
            }

            if (!res) {
                // Numbered gap: ask user unless already confirmed
                if (hasMoveNumbers && !confirm_gap_fill) {
                    return {
                        gap_detected: true,
                        gap_color: tempCh.turn() === 'w' ? 'White' : 'Black',
                        gap_before_move: san,
                        current_fen: tempCh.fen(),
                        instruction: `The opponent's move is missing before "${san}". Ask the user if they want Stockfish to fill this gap. If yes, call chess_engine_tool again with the same input and confirm_gap_fill: true.`,
                        ...(autoResetTriggered ? { auto_reset: true } : {}),
                    };
                }

                // Fill the gap with Stockfish
                const fillResult = await getStockfishMove(tempCh.fen(), Math.min(depth, 10), 1);
                if (!fillResult || !fillResult.move) {
                    return { error: `Cannot fill gap before "${san}": Stockfish returned no move.` };
                }
                const fillMoveObj = tempCh.move({
                    from: fillResult.move.substring(0, 2),
                    to: fillResult.move.substring(2, 4),
                    promotion: fillResult.move[4] || undefined
                });
                if (!fillMoveObj) {
                    return { error: `Internal error filling gap before "${san}".` };
                }

                const isPreMoveContext = !hasMoveNumbers && i > 0;
                if (hasMoveNumbers) {
                    gapsFilled.push({ color: fillMoveObj.color === 'w' ? 'White' : 'Black', move: fillMoveObj.san });
                }

                fenBeforeLastUser = tempCh.fen();

                // Retry user move after gap fill — also try with first letter uppercased
                try { res = tempCh.move(san); } catch (e2) { }
                if (!res && san.length > 0) {
                    const sanFixed = san.charAt(0).toUpperCase() + san.slice(1);
                    if (sanFixed !== san) try { res = tempCh.move(sanFixed); } catch (e2) { }
                }

                if (!res) {
                    if (isPreMoveContext) {
                        premoveChainFailed = { premove_attempted: san, opponent_reply: fillMoveObj.san, fillMoveObj: fillMoveObj, successful_before: preMoveChain };
                        break;
                    }
                    return { error: `Invalid move "${san}" even after filling the gap. Legal moves: ${tempCh.moves().join(', ')}` };
                }

                if (isPreMoveContext) {
                    preMoveChain.push({ premove: san, after_opponent: fillMoveObj.san });
                }
            } else if (!hasMoveNumbers && i > 0 && res) {
                // Move was directly legal in pre-move context — still counts as a pre-move slot
                preMoveChain.push({ premove: san, after_opponent: null });
            }

            if (res) {
                fenBeforeLastSuccessful = fenBeforeLastUser;
                fenAfterLastSuccessful = tempCh.fen();
            }
            lastMoveObj = res;
        }

        // Pre-move chain broken — advance session to include real moves + opponent reply, then return failure info with classifications
        if (premoveChainFailed) {
            // Advance session to the point of failure (real user move + Stockfish response included, failed premove excluded)
            chess = session.chess = tempCh;
            session.moveHistory = chess.history();
            session.totalHalfMoves = halfMovesFromFen(chess.fen()); // update absolute count

            // Classify last real user move
            let lastRealClass = 'book', lastRealSymbol = '';
            if (lastMoveObj) {
                const evalBefore = await getStockfishMove(fenBeforeLastSuccessful, Math.min(depth, 3), 3);
                const evalAfter = await getStockfishMove(fenAfterLastSuccessful, Math.min(depth, 3), 3);
                const isWhiteTurnReal = fenBeforeLastSuccessful.split(' ')[1] === 'w';
                let isBookReal = false;
                if (!session.outOfBook) {
                    isBookReal = await checkChessDBBook(fenBeforeLastSuccessful, lastMoveObj);
                    if (!isBookReal) session.outOfBook = true;
                }
                if (!isBookReal) {
                    lastRealClass = await classifyMove(
                        { evaluation: evalBefore.evaluation, mate: evalBefore.mate },
                        { evaluation: evalAfter.evaluation, mate: evalAfter.mate },
                        isWhiteTurnReal, evalBefore.pvs, lastMoveObj, fenBeforeLastSuccessful, session.lastMoveClass
                    );
                }
                lastRealSymbol = badgeSymbols[lastRealClass] ?? '';
                session.lastMoveClass = lastRealClass;
            }

            // Classify the opponent's blocking reply (the fill move that invalidated the premove)
            let opponentReplyClass = 'best', opponentReplySymbol = '';
            if (premoveChainFailed.fillMoveObj) {
                const fillFenBefore = fenAfterLastSuccessful; // FEN after user's last real move = before fill
                const fillFenAfter = chess.fen();             // tempCh now = after user real + fill move
                const isOpponentTurn = fillFenBefore.split(' ')[1] === 'w'; // opponent is the side moving from fillFenBefore
                const evalFillBefore = await getStockfishMove(fillFenBefore, Math.min(depth, 3), 3);
                const evalFillAfter = await getStockfishMove(fillFenAfter, Math.min(depth, 3), 3);
                let isBookFill = false;
                if (!session.outOfBook) isBookFill = await checkChessDBBook(fillFenBefore, premoveChainFailed.fillMoveObj);
                if (!isBookFill) {
                    opponentReplyClass = await classifyMove(
                        { evaluation: evalFillBefore.evaluation, mate: evalFillBefore.mate },
                        { evaluation: evalFillAfter.evaluation, mate: evalFillAfter.mate },
                        isOpponentTurn, evalFillBefore.pvs, premoveChainFailed.fillMoveObj, fillFenBefore, lastRealClass
                    );
                }
                opponentReplySymbol = badgeSymbols[opponentReplyClass] ?? '';
            }

            // Build move_sequence: moves from this call only (slice off any pre-existing history from moveHistory replay)
            const failSeqMoves = chess.history().slice(historyBeforeNewMoves); // new moves only
            let failMoveSequence = '';
            for (let idx = 0; idx < failSeqMoves.length; idx++) {
                const halfIdx = historyLenAtStart + idx;
                const moveNum = Math.floor(halfIdx / 2) + 1;
                const isWhite = halfIdx % 2 === 0;
                if (isWhite) {
                    failMoveSequence += (failMoveSequence ? ' ' : '') + `${moveNum}. ${failSeqMoves[idx]}`;
                } else {
                    if (idx === 0) {
                        failMoveSequence += `${moveNum}... ${failSeqMoves[idx]}`;
                    } else {
                        failMoveSequence += ` ${failSeqMoves[idx]}`;
                    }
                }
            }

            return {
                premove_failed: true,
                premove_attempted: premoveChainFailed.premove_attempted,
                ...(failMoveSequence ? { move_sequence: failMoveSequence } : {}),
                opponent_reply: premoveChainFailed.opponent_reply,
                opponent_reply_classification: opponentReplyClass,
                opponent_reply_symbol: opponentReplySymbol,
                successful_premoves_before: premoveChainFailed.successful_before,
                ...(lastMoveObj ? {
                    last_real_move: lastMoveObj.san,
                    last_real_move_classification: lastRealClass,
                    last_real_move_symbol: lastRealSymbol,
                } : {}),
                fen: chess.fen(),
                ...(autoResetTriggered ? { auto_reset: true } : {}),
            };
        }

        if (!lastMoveObj) {
            return { error: `Invalid move or sequence: "${input}". Legal moves: ${session.chess.moves().join(', ')}` };
        }

        chess = session.chess = tempCh;
        session.moveHistory = chess.history();
        session.totalHalfMoves = halfMovesFromFen(chess.fen()); // update absolute count
        const hasPremoves = preMoveChain.length > 0;
        let classification = "book";
        let isBookUser = false;

        const fenBefore = fenBeforeLastUser;
        const isWhiteTurn = fenBefore.split(' ')[1] === 'w';
        let moveObj = lastMoveObj;

        const evalBefore = await getStockfishMove(fenBefore, depth, 3);
        const evalAfter = await getStockfishMove(chess.fen(), depth, 3);

        if (!session.outOfBook) {
            isBookUser = await checkChessDBBook(fenBefore, moveObj);
            if (!isBookUser) session.outOfBook = true;
        }

        if (!isBookUser) {
            classification = await classifyMove(
                { evaluation: evalBefore.evaluation, mate: evalBefore.mate },
                { evaluation: evalAfter.evaluation, mate: evalAfter.mate },
                isWhiteTurn,
                evalBefore.pvs,
                moveObj,
                fenBefore,
                session.lastMoveClass
            );
        }
        session.lastMoveClass = classification;

        const BAD_MOVE_CLASSES = ['mistake', 'blunder', 'miss'];

        if (chess.isGameOver()) {
            return {
                user_move: moveObj.san,
                user_move_classification: classification,
                user_move_symbol: badgeSymbols[classification] ?? '',
                game_over: true,
                message: "Game over!",
                fen: chess.fen(),
                ...(autoResetTriggered ? { auto_reset: true } : {}),
            };
        }

        // Engine response
        const engineResult = await getStockfishMove(chess.fen(), depth, 3);
        let bestNextClass = "best";
        let engineSAN = null; // SAN of the engine's reply (stored before chess advances)
        if (engineResult.move) {
            const engineFenBefore = chess.fen();
            const engineTurnIsWhite = chess.turn() === 'w';
            let engineMoveObj = null;
            try { engineMoveObj = chess.move({ from: engineResult.move.substring(0, 2), to: engineResult.move.substring(2, 4), promotion: engineResult.move[4] || undefined }); } catch (e) { }
            if (engineMoveObj) {
                engineSAN = engineMoveObj.san; // Capture SAN immediately after the move

                let isBookEngine = false;
                if (!session.outOfBook) {
                    isBookEngine = await checkChessDBBook(engineFenBefore, engineMoveObj);
                    if (!isBookEngine) session.outOfBook = true;
                }

                if (isBookEngine) {
                    bestNextClass = "book";
                } else {
                    const engineEvalAfter = await getStockfishMove(chess.fen(), depth, 3);
                    bestNextClass = await classifyMove(
                        { evaluation: engineResult.evaluation, mate: engineResult.mate },
                        { evaluation: engineEvalAfter.evaluation, mate: engineEvalAfter.mate },
                        engineTurnIsWhite,
                        engineResult.pvs,
                        engineMoveObj,
                        engineFenBefore,
                        session.lastMoveClass
                    );
                }
            }
        }

        // Build move sequence: new moves from this call only (slice off old moves pre-loaded from moveHistory)
        const fullHistory = chess.history();
        const seqMoves = fullHistory.slice(historyBeforeNewMoves); // only moves applied in this call
        // Exclude the last element if the engine actually played a reply
        const seqMovesForDisplay = engineResult.move ? seqMoves.slice(0, -1) : seqMoves;
        let moveSequence = '';
        for (let idx = 0; idx < seqMovesForDisplay.length; idx++) {
            const halfIdx = historyLenAtStart + idx;
            const moveNum = Math.floor(halfIdx / 2) + 1;
            const isWhite = halfIdx % 2 === 0;
            if (isWhite) {
                moveSequence += (moveSequence ? ' ' : '') + `${moveNum}. ${seqMovesForDisplay[idx]}`;
            } else {
                if (idx === 0) {
                    moveSequence += `${moveNum}... ${seqMovesForDisplay[idx]}`;
                } else {
                    moveSequence += ` ${seqMovesForDisplay[idx]}`;
                }
            }
        }

        return {
            ...(moveSequence && (gapsFilled.length > 0 || hasPremoves) ? { move_sequence: moveSequence } : {}),
            user_move: moveObj.san,
            user_move_classification: classification,
            user_move_symbol: badgeSymbols[classification] ?? '',
            engine_reply: engineSAN,
            engine_reply_classification: bestNextClass,
            engine_reply_symbol: badgeSymbols[bestNextClass] ?? '',
            evaluation: evalLabel(engineResult),
            fen: chess.fen(),
            // Numbered gap fill confirmation
            ...(gapsFilled.length > 0 ? {
                gaps_filled: gapsFilled,
            } : {}),
            // Pre-move chain results
            ...(hasPremoves ? {
                premove_success: true,
                premove_chain: preMoveChain,
                premove_classification_bad: BAD_MOVE_CLASSES.includes(classification),
            } : {}),
            ...(autoResetTriggered ? { auto_reset: true } : {}),
        };

    } catch (error) {
        return { error: error.toString() };
    }
}
/* The command itself */
module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('ai')
        .setNameLocalization('tr', 'yz')
        .setDescription("Commands related to AI.")
        .setDescriptionLocalization('tr', 'Yapay Zeka ile ilgili komutlar.')
        .addSubcommand(subcommand => {
            return subcommand
                .setName('send')
                .setNameLocalization('tr', 'gönder')
                .setDescription("Send a message to the AI.")
                .setDescriptionLocalization("tr", "Yapay Zeka'ya ileti gönderir.")
                .addStringOption(option =>
                    option
                        .setName('message')
                        .setNameLocalization('tr', 'ileti')
                        .setDescription("Message to send to the AI.")
                        .setDescriptionLocalization('tr', 'Yapay Zeka\'ya gönderilecek ileti.')
                        .setRequired(true))
        })
        .addSubcommand(subcommand => {
            return subcommand
                .setName('settings')
                .setNameLocalization('tr', 'ayar')
                .setDescription("AI settings.")
                .setDescriptionLocalization('tr', 'Yapay Zeka ayarları.')
        }),
    async execute(interaction, client) {
        l = {
            unknown: "Bilinmeyen",
            enabled: "Açık",
            disabled: "Kapalı",
            ai_model: "Yapay Zeka Modeli",
            image_support: "Görsel Desteği",
            supported: "Destekleniyor",
            unsupported: "Desteklenmiyor",
            temp: "Yaratıcılık (Temperature)",
            ai_personality: "Kişilik",
            tool_usage: "Tool Usage",
            ai_settings: "AI Settings",
            reset_confirm: "Sıfırlamak için tekrar tıklayın",
            reset: "Sıfırla",
            ai_history: "Sohbet Geçmişi",
            clear_confirm: "Temizlemek için tekrar tıklayın",
            clear_history: "Geçmişi Temizle ({a} mesaj)",
            no_ai_history: "Geçmiş Yok",
            select_ai_model: "Bir yapay zeka modeli seçin",
            free_model_desc: "Ücretsiz model",
            default_model_desc: "Varsayılan model",
            select_ai_personality: "Bir kişilik seçin",
            thinking: "Düşünüyor",
            tool_called: new Proxy({ run_javascript_code: "JavaScript executed: {a}" }, {
                get: function (target, prop) {
                    return prop in target ? target[prop] : "Tool called: " + prop + " args: {a}";
                }
            }),
            tool_response: "Tool response: {a}",
            no_tool_response: "No response from tool",
            no_response: "Yanıt yok",
            thought_for: "{a} saniye boyunca düşündü",
            error_while_thinking: "Düşünürken bir hata oluştu",
            ai_not_available: "Yapay zeka şu anda kullanılamıyor",
            an_error_occurred: "Bir hata oluştu"
        };
        switch (interaction.options.getSubcommand()) {
            case 'settings':
                var container, additional, chosen, options;
                var clear_confirmed = false;
                var reset_confirmed = false;
                var aimodels = [];
                if (!fs.existsSync(`./data/aihistory/${interaction.channel.id}.json`)) {
                    var data = structuredClone(data_template);
                } else {
                    var data = JSON.parse(fs.readFileSync(`./data/aihistory/${interaction.channel.id}.json`))
                }
                function updateContainer(disabled = false) {
                    options = {
                        ai_model: { type: ComponentType.Button, label: data.settings.model?.name ?? l.unknown, custom_id: "ai_model", style: 2, disabled },
                        ai_temp: { type: ComponentType.Button, label: data.settings.model.temp?.toString() ?? "1.0", custom_id: "ai_temp", style: 2, disabled },
                        ai_personality: { type: ComponentType.Button, label: sys[data.settings.personality]?.name ?? data.settings.personality, custom_id: "ai_personality", style: 2, disabled },
                        ai_tool_usage: { type: ComponentType.Button, label: data.settings.tool_usage ? l.enabled : l.disabled, custom_id: "ai_tool_usage", style: 2, disabled }
                    };
                    var model_settings = [
                        {
                            type: ComponentType.Section,
                            components: [{ type: ComponentType.TextDisplay, content: l.ai_model }],
                            accessory: options.ai_model
                        },
                        {
                            type: ComponentType.Section,
                            components: [{ type: ComponentType.TextDisplay, content: l.image_support }],
                            accessory: { type: ComponentType.Button, label: data.settings.model.modalities?.includes("image") ? l.supported : l.unsupported, custom_id: "ai_image_support", style: data.settings.model.modalities?.includes("image") ? 3 : 4, disabled: true },
                        },
                        {
                            type: ComponentType.Section,
                            components: [{ type: ComponentType.TextDisplay, content: l.temp }],
                            accessory: options.ai_temp
                        },
                    ];

                    var other_settings = [
                        {
                            type: ComponentType.Section,
                            components: [{ type: ComponentType.TextDisplay, content: l.ai_personality }],
                            accessory: options.ai_personality
                        },
                        {
                            type: ComponentType.Section,
                            components: [{ type: ComponentType.TextDisplay, content: l.tool_usage }],
                            accessory: options.ai_tool_usage
                        },
                    ];
                    container = {
                        type: ComponentType.Container,
                        components: [
                            {
                                type: ComponentType.Section,
                                components: [{ type: ComponentType.TextDisplay, content: l.ai_settings }],
                                accessory: { type: ComponentType.Button, label: reset_confirmed ? l.reset_confirm : l.reset, custom_id: "ai_reset", style: 4, disabled }
                            },
                            { type: ComponentType.Separator, spacing: 2 },
                            ...model_settings,
                            { type: ComponentType.Separator, spacing: 2 },
                            ...other_settings,
                            { type: ComponentType.Separator, spacing: 2 },
                            {
                                type: ComponentType.Section,
                                components: [{ type: ComponentType.TextDisplay, content: l.ai_history }],
                                accessory: { type: ComponentType.Button, label: clear_confirmed ? l.clear_confirm : (data.history.length ? l.clear_history.replace('{a}', data.history.length) : l.no_ai_history), custom_id: "ai_clear", style: data.history.length ? 4 : 2, disabled: !data.history.length ? true : disabled }
                            },
                        ],
                    };
                    additional = {
                        ai_model: aimodels.length > 0 ? {
                            type: ComponentType.ActionRow,
                            components: [{
                                type: ComponentType.StringSelect,
                                custom_id: 'select_ai_model',
                                placeholder: l.select_ai_model,
                                options: aimodels.map(model => ({
                                    label: model.name.replace("(free)", "").trim().substring(0, 100),
                                    value: model.id,
                                    default: data.settings.model.id == model.id,
                                    description: model.name.endsWith("(free)") ? l.free_model_desc : model.name == default_model.name ? l.default_model_desc : undefined,
                                })),
                            }]
                        } : null,
                        ai_temp: {
                            type: ComponentType.ActionRow,
                            components: [
                                { type: ComponentType.Button, custom_id: 'ai_temp_minus_0.5', label: "-0.5", style: 4, },
                                { type: ComponentType.Button, custom_id: 'ai_temp_minus_0.1', label: "-0.1", style: 4, },
                                { type: ComponentType.Button, custom_id: 'ai_temp_reset', label: l.reset, style: 1, },
                                { type: ComponentType.Button, custom_id: 'ai_temp_plus_0.1', label: "+0.1", style: 3, },
                                { type: ComponentType.Button, custom_id: 'ai_temp_plus_0.5', label: "+0.5", style: 3, },
                            ]
                        },
                        ai_personality: {
                            type: ComponentType.ActionRow,
                            components: [{
                                type: ComponentType.StringSelect,
                                custom_id: 'select_ai_personality',
                                placeholder: l.select_ai_personality,
                                options: Object.keys(sys).filter(key => key != "json" && key != "tool").map(key => ({
                                    label: sys[key].name.substring(0, 100),
                                    value: key,
                                    default: data.settings.personality == key,
                                })),
                            }]
                        }
                    }
                }
                updateContainer();
                const settings_msg = await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    fetchReply: true,
                });
                await settings_msg.createMessageComponentCollector({ idle: 300_000, filter: i => i.member.permissions.has("MANAGE_CHANNELS") })
                    .on('collect', async i => {
                        if (!fs.existsSync(`./data/aihistory/${interaction.channel.id}.json`)) {
                            data = structuredClone(data_template);
                        } else {
                            data = JSON.parse(fs.readFileSync(`./data/aihistory/${interaction.channel.id}.json`))
                        }
                        var data_changed = false;
                        if (debug) console.log("Button clicked:", i.customId);
                        switch (i.customId) {
                            case 'ai_reset':
                                var reset = false;
                                if (reset_confirmed) { data = structuredClone(data_template); reset_confirmed = false; reset = true; data_changed = true; }
                                if (!reset_confirmed && !reset) reset_confirmed = true;
                                clear_confirmed = false;
                                chosen = null;
                                break;
                            case 'ai_clear':
                                var clear = false;
                                if (clear_confirmed) { data.history = []; clear_confirmed = false; clear = true; data_changed = true; }
                                if (!clear_confirmed && !clear) clear_confirmed = true;
                                reset_confirmed = false;
                                chosen = null;
                                break;
                            case 'ai_model':
                                chosen = chosen !== 'ai_model' ? 'ai_model' : null;
                                if (chosen === 'ai_model') {
                                    const openRouter = await openRouterPromise;
                                    const allModels = (await openRouter.models.listForUser({ bearer: process.env.OTOKEN ?? "" })).data.filter(m => m.architecture.modality.endsWith("->text"));
                                    if (debug) console.log("Total text models available:", allModels.length);
                                    aimodels = get_top_models(allModels).map(m => ({ name: m.name, id: m.id, modalities: m.architecture.inputModalities }));
                                    if (debug) console.log("After per-company filter:", aimodels.length, "models");
                                    if (aimodels.length === 0) {
                                        aimodels = allModels.slice(0, 25).map(model => ({ name: model.name, id: model.id, modalities: m.architecture.inputModalities }));
                                        if (debug) console.log("Using fallback: first", aimodels.length, "models");
                                    } else {
                                        aimodels = aimodels.slice(0, 25);
                                    }
                                    if (debug) console.log("Final count:", aimodels.length, "models");
                                    break;
                                }
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'select_ai_model':
                                data.settings.model = aimodels.find(m => m.id === i.values[0]) ?? data.settings.model;
                                data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                chosen = null;
                                break;
                            case 'ai_personality':
                                chosen = chosen !== 'ai_personality' ? 'ai_personality' : null;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'select_ai_personality':
                                data.settings.personality = i.values[0];
                                data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                chosen = null;
                                break;
                            case 'ai_tool_usage':
                                data.settings.tool_usage = !(data.settings.tool_usage);
                                data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                chosen = null;
                                break;
                            case 'ai_temp':
                                chosen = chosen !== 'ai_temp' ? 'ai_temp' : null;
                                if (data.settings.model.temp == null) data.settings.model.temp = 1.0;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'ai_temp_minus_0.5':
                                var old_temp = data.settings.model.temp ?? 1.0;
                                data.settings.model.temp = Math.max(0, (data.settings.model.temp ?? 0) - 0.5);
                                data.settings.model.temp = Math.round((data.settings.model.temp ?? 0) * 10) / 10;
                                if (data.settings.model.temp !== old_temp) data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'ai_temp_minus_0.1':
                                var old_temp = data.settings.model.temp ?? 1.0;
                                data.settings.model.temp = Math.max(0, (data.settings.model.temp ?? 0) - 0.1);
                                data.settings.model.temp = Math.round((data.settings.model.temp ?? 0) * 10) / 10;
                                if (data.settings.model.temp !== old_temp) data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'ai_temp_reset':
                                var old_temp = data.settings.model.temp ?? 1.0;
                                data.settings.model.temp = 1.0;
                                if (data.settings.model.temp !== old_temp) data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'ai_temp_plus_0.1':
                                var old_temp = data.settings.model.temp ?? 1.0;
                                data.settings.model.temp = Math.min(2, (data.settings.model.temp ?? 0) + 0.1);
                                data.settings.model.temp = Math.round((data.settings.model.temp ?? 0) * 10) / 10;
                                if (data.settings.model.temp !== old_temp) data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            case 'ai_temp_plus_0.5':
                                var old_temp = data.settings.model.temp ?? 1.0;
                                data.settings.model.temp = Math.min(2, (data.settings.model.temp ?? 0) + 0.5);
                                data.settings.model.temp = Math.round((data.settings.model.temp ?? 0) * 10) / 10;
                                if (data.settings.model.temp !== old_temp) data_changed = true;
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                            default:
                                reset_confirmed = false;
                                clear_confirmed = false;
                                break;
                        }
                        if (data_changed) { fs.writeFileSync(`./data/aihistory/${interaction.channel.id}.json`, JSON.stringify(data)); if (debug) console.log("AI settings updated:", data.settings); }
                        updateContainer();
                        var components = [container];
                        if (chosen && additional[chosen]) components.push(additional[chosen]);
                        if (chosen && options[chosen]) options[chosen].style = 1;
                        try { await i.update({ components, flags: MessageFlags.IsComponentsV2 }); } catch (error) { console.error("i.update error:", error); }
                    })
                    .on('end', async collected => {
                        chosen = null;
                        updateContainer(true);
                        var components = [container];
                        interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    })
                break;
            case 'send':
                await interaction.deferReply();
                var message = [];
                var animStep = 1;
                var last_component = null;
                async function sendMessage(mode, input, ...args) {
                    var component = {
                        thinking: {
                            type: ComponentType.Container,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: l.thinking + ".",
                                }
                            ],
                        },
                        tool_call: {
                            type: ComponentType.Container,
                            components: [
                                {
                                    type: ComponentType.TextDisplay,
                                    content: (() => {
                                        let argStr = args[1]?.code || JSON.stringify(args[1]) || "";
                                        if (argStr.length > 1000) argStr = argStr.substring(0, 997) + "...";
                                        return l.tool_called[args[0]]?.toString().replace('{a}', argStr) || `Tool called: ${args[0]}`;
                                    })(),
                                },
                                { type: ComponentType.Separator, spacing: 1 },
                                {
                                    type: ComponentType.TextDisplay,
                                    content: (() => {
                                        if (!args[2]) return l.no_tool_response;
                                        let respStr = typeof args[2] === 'string' ? args[2] : JSON.stringify(args[2]);
                                        if (respStr.length > 1000) respStr = respStr.substring(0, 997) + "...";
                                        return l.tool_response.replace('{a}', respStr);
                                    })(),
                                }
                            ],
                        },
                        text: {
                            type: ComponentType.TextDisplay,
                            content: l.no_response,
                        },
                    };
                    const limitText = (str) => {
                        if (!str) return "";
                        return str.length > 2000 ? str.substring(0, 1997) + "..." : str;
                    };
                    switch (mode) {
                        case 'edit':
                            switch (last_component) {
                                case 'thinking':
                                    if (typeof input === 'number') {
                                        message[message.length - 1].components[0].content = l.thought_for.replace('{a}', Math.floor(input / 100) / 10);
                                        animStep = 1;
                                    }
                                    else if (typeof input === 'string') {
                                        message.push(component.text);
                                        last_component = "text";
                                        if (input.trim() != "") message[message.length - 1].content = limitText(input);
                                        animStep = 1;
                                    }
                                    else {
                                        message[message.length - 1].components[0].content = l.thinking + ".".repeat(animStep);
                                        animStep++;
                                        if (animStep > 3) animStep = 1;
                                    }
                                    break;
                                case 'text':
                                    if (input.trim() != "") message[message.length - 1].content = limitText(input);
                                    break;
                                case 'tool_call':
                                    message.push(component.text);
                                    last_component = "text";
                                    if (input.trim() != "") message[message.length - 1].content = limitText(input);
                                    break;
                                default:
                                    if (message.length == 0 && input) {
                                        message.push(component.text);
                                        last_component = "text";
                                        if (input.trim() != "") message[message.length - 1].content = limitText(input);
                                    }
                                    break;
                            }
                            break;
                        case 'add':
                            message.push(component[input]);
                            last_component = input;
                            break;
                        default:
                            break;
                    }
                    if (debug) console.log(message);
                    interaction.editReply({ components: message, flags: MessageFlags.IsComponentsV2 });
                }
                try {
                    var data = structuredClone(data_template);
                    if (fs.existsSync(`./data/aihistory/${interaction.channel.id}.json`)) data = JSON.parse(fs.readFileSync(`./data/aihistory/${interaction.channel.id}.json`));

                    const rawUserMessage = interaction.options.getString("message");
                    const contextSyntax = parseContextSyntax(rawUserMessage);
                    let userPrompt = rawUserMessage;
                    let referenced_message = null;
                    let referenced_image = null;

                    if (contextSyntax?.type === "last_message") {
                        referenced_message = await fetchLastChatMessageContext(interaction);
                        userPrompt = contextSyntax.prompt;
                        if (!referenced_message) {
                            console.log("No suitable referenced message found for m!! syntax.");
                            userPrompt = rawUserMessage;
                        }
                    }

                    if (contextSyntax?.type === "last_image") {
                        referenced_image = await fetchLastChatImageContext(interaction);
                        userPrompt = contextSyntax.prompt;
                        if (!referenced_image) {
                            console.log("No suitable referenced image found for i!! syntax.");
                            userPrompt = rawUserMessage;
                        }
                    }

                    const userPayload = {
                        username: interaction.member.displayName,
                        user_id: interaction.user.id,
                        time: new Date().toLocaleString("tr-TR", { timezone: "Europe/Istanbul" }),
                        message: userPrompt,
                    };
                    if (referenced_message) userPayload.referenced_message = referenced_message;
                    if (referenced_image) userPayload.referenced_image = {
                        message_id: referenced_image.message_id,
                        username: referenced_image.username,
                        user_id: referenced_image.user_id,
                        time: referenced_image.time,
                        filename: referenced_image.filename,
                    };

                    const userTextPayload = JSON.stringify(userPayload);
                    var input = {
                        role: "user",
                        content: referenced_image
                            ? [
                                { type: "text", text: userTextPayload },
                                { type: "image_url", imageUrl: { url: referenced_image.url } },
                            ]
                            : userTextPayload,
                    };

                    const contextInstruction = [
                        referenced_message
                            ? "If referenced_message exists in user JSON, treat it as the exact target context the user referred to and prioritize it when answering."
                            : "",
                        referenced_image
                            ? "If referenced_image exists, the attached image is the exact target context the user referred to; use the image directly when answering."
                            : "",
                    ].filter(Boolean).join(" ");

                    var system = [{
                        role: "system",
                        content: `${sys.json} ${(data.settings.tool_usage ? sys.tool + " " : " ")}${sys[data.settings.personality].prompt}\n${contextInstruction}\nYou may mention users by sending '<@user_id>' in your response, but only when they aren't present and you must never mention twice. You are currently chatting in '${interaction.channel.name}' channel in '${interaction.guild.name}' server. Current chess session ID for this user in this channel: ${interaction.channel.id}_${interaction.user.id}.`
                    }];

                    if (debug) console.log(system[0].content)
                    var context = system.concat(data.history, input);
                    var output = { role: "assistant", content: "" };
                    var usage = 0;
                    var pendingUsageIds = [];
                    var step = 0;
                    var stepLimit = 15;
                    var thinking = false;
                    var t0, tt;
                    var toolcalled = false;
                    var tool_call_template = { index: 0, id: "", type: "function", function: { name: "", arguments: "" } };
                    const openRouter = await openRouterPromise;
                    agentic_loop: while (true) {
                        const isThinkingModel = data.settings.model.thinking === true;
                        const apiPayload = {
                            model: data.settings.model.id,
                            messages: context,
                            stream: true,
                            streamOptions: { includeUsage: true },
                            maxTokens: 4096,
                        };
                        if (isThinkingModel) apiPayload.reasoning = { enabled: true };
                        if (data.settings.tool_usage) apiPayload.tools = tools;
                        if (data.settings.model.temp !== undefined && data.settings.model.temp !== null) apiPayload.temperature = data.settings.model.temp;
                        const response = await openRouter.chat.send({ chatRequest: apiPayload });
                        for await (const part of response) {
                            var content = part.choices?.[0]?.delta?.content;
                            var reasoning = part.choices?.[0]?.delta?.reasoning;
                            if (debug) console.log(step, part.choices[0]?.finishReason, "|", reasoning || content);
                            step++;
                            if (content != "null" && content !== "" && content !== null && content !== undefined) { output.content += content; }
                            if (reasoning && !thinking) { thinking = true; t0 = Date.now(); await sendMessage('add', 'thinking'); }
                            if (content && thinking) { tt = Date.now() - t0; thinking = false; step = 0; await sendMessage('edit', tt); }
                            if (step >= stepLimit && thinking) { await sendMessage('edit'); step = 0; }
                            if (part.choices[0]?.delta?.toolCalls) {
                                toolcalled = true;
                                if (debug) console.log("Tool call detected:", part.choices[0].delta.toolCalls);
                                var tool_call = output.tool_calls?.[part.choices[0].delta?.toolCalls[0].index];
                                if (tool_call == null || tool_call == undefined) {
                                    if (!output.tool_calls) output.tool_calls = [];
                                    output.tool_calls[part.choices[0].delta.toolCalls[0].index] = structuredClone(tool_call_template);
                                    tool_call = output.tool_calls[part.choices[0].delta.toolCalls[0].index];
                                    tool_call.index = part.choices[0].delta.toolCalls[0].index;
                                }
                                tool_call.id = part.choices[0].delta.toolCalls[0].id ?? tool_call.id;
                                if (part.choices[0].delta.toolCalls[0].function) tool_call.function.name += part.choices[0].delta.toolCalls[0].function.name ?? "";
                                if (part.choices[0].delta.toolCalls[0].function) tool_call.function.arguments += part.choices[0].delta.toolCalls[0].function.arguments ?? "";
                                console.log("current tool call:", tool_call);
                            }
                            if (part.choices[0]?.finishReason == "tool_calls") {
                                output.content = output.content.trim();
                                if (output.content != "") await sendMessage('edit', output.content);
                                if (output.content == "" && thinking) { tt = Date.now() - t0; thinking = false; step = 0; await sendMessage('edit', tt); }
                                step = 0;
                                toolcalled = false;
                                if (output.tool_calls[0].function.arguments) output.tool_calls[0].function.arguments = extractJsonString(output.tool_calls[0].function.arguments);
                                context.push(structuredClone(output), await handleToolCall(output.tool_calls[0], interaction));
                                await sendMessage('add', 'tool_call', output.tool_calls[0].function.name, output.tool_calls[0].function.arguments, context[context.length - 1].content);
                                delete output.tool_calls;
                                output.content = ""
                                pendingUsageIds.push(part.id);
                                continue agentic_loop;
                            }
                            if ((step >= stepLimit || part.choices[0]?.finishReason) && !thinking) {
                                step = 0;
                                if (toolcalled && part.choices[0]?.finishReason) {
                                    output.content = output.content.trim();
                                    if (output.content != "") await sendMessage('edit', output.content);
                                    if (output.content == "" && thinking) { tt = Date.now() - t0; thinking = false; step = 0; await sendMessage('edit', tt); }
                                    step = 0;
                                    toolcalled = false;
                                    if (output.tool_calls[0].function.arguments) output.tool_calls[0].function.arguments = extractJsonString(output.tool_calls[0].function.arguments);
                                    context.push(structuredClone(output), await handleToolCall(output.tool_calls[0], interaction));
                                    await sendMessage('add', 'tool_call', output.tool_calls[0].function.name, output.tool_calls[0].function.arguments, context[context.length - 1].content);
                                    delete output.tool_calls;
                                    output.content = ""
                                    pendingUsageIds.push(part.id);
                                    continue agentic_loop;
                                }
                                if (debug) console.log(output.content);
                                if (stepLimit < 50) stepLimit++;
                                await sendMessage('edit', output.content);
                            }
                            if (part.usage) {
                                if (thinking) {
                                    await interaction.followUp({ embeds: [{ title: l.error_while_thinking }] });
                                    return;
                                }
                                context.push(structuredClone(output));
                                pendingUsageIds.push(part.id);
                                break;
                            }
                        }
                        break;
                    }
                    if (output.content && output.content.trim() !== "") {
                        await sendMessage('edit', output.content);
                    }
                    if (debug) console.log("AI response ended.");
                    data.history = context.filter((msg) => msg.role !== "system");
                    fs.writeFileSync(`./data/aihistory/${interaction.channel.id}.json`, JSON.stringify(data), (err) => { if (err) console.error(err); });
                    // Removed usage deduction
                } catch (error) {
                    if (error.message == "fetch failed") return interaction.editReply({ embeds: [{ title: l.ai_not_available }] });
                    console.error(error);
                    if (!interaction.deferred) interaction.reply({ content: l.an_error_occurred, flags: MessageFlags.Ephemeral });
                    else interaction.followUp({ content: l.an_error_occurred });
                }
                break;
            default:
                break;
        }
    },
};

async function handleToolCall(toolCall, interaction) {
    toolCall.function.arguments ? toolCall.function.arguments = JSON.parse(extractJsonString(toolCall.function.arguments)) : toolCall.function.arguments = {};
    if (toolCall.function.name === 'chess_engine_tool' && interaction) {
        toolCall.function.arguments.session_id = `${interaction.channel.id}_${interaction.user.id}`;
    }
    let toolResponse;
    if (typeof TOOL[toolCall.function.name] === 'function') {
        toolResponse = await TOOL[toolCall.function.name](toolCall.function.arguments);
    } else {
        toolResponse = { error: `Tool '${toolCall.function.name}' is not defined/available. Available tools are: chess_engine_tool, run_javascript_code.` };
    }
    if (debug) console.log("Tool call:", toolCall.function.name, toolCall.function.arguments);
    if (debug) console.log("Tool response:", toolResponse);
    return {
        role: "tool",
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(toolResponse),
    };
}

async function getUsage(id) {
    const openRouter = await openRouterPromise;
    var gen = await openRouter.generations.getGeneration({ id: id });
    if (gen?.data?.usage) {
        if (debug) console.log("Generation usage:", Math.ceil(gen.data.usage * 100000));
        return Math.ceil(gen.data.usage * 100000);
    } else {
        return 100;
    }
}

function extractJsonString(str) {
    // Extract substring between the first '{' and the last '}'
    const first = str.indexOf('{');
    const last = str.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
        return str.substring(first, last + 1);
    }
    return str;
}

function parseContextSyntax(rawText) {
    if (!rawText) return null;
    const messageMatch = rawText.match(/^m!!(?:\s+([\s\S]+))?$/i);
    if (messageMatch) {
        return {
            type: "last_message",
            prompt: (messageMatch[1] ?? "").trim(),
        };
    }

    const imageMatch = rawText.match(/^i!!(?:\s+([\s\S]+))?$/i);
    if (imageMatch) {
        return {
            type: "last_image",
            prompt: (imageMatch[1] ?? "").trim(),
        };
    }

    return null;
}

async function fetchLastChatMessageContext(interaction) {
    if (!interaction.channel?.messages?.fetch) return null;

    const messages = await interaction.channel.messages.fetch({ limit: 15 });
    const lastMessage = messages.find(m =>
        !m.system &&
        m.id !== interaction.id &&
        ((m.content && m.content.trim().length > 0) || m.attachments?.size > 0)
    );

    if (!lastMessage) return null;

    return {
        message_id: lastMessage.id,
        username: lastMessage.member?.displayName ?? lastMessage.author?.username ?? "Unknown",
        user_id: lastMessage.author?.id ?? null,
        time: lastMessage.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
        message: (lastMessage.content ?? "").trim() || "[no text content]",
        attachments: lastMessage.attachments?.map(a => a.url).slice(0, 3) ?? [],
    };
}

async function fetchLastChatImageContext(interaction) {
    if (!interaction.channel?.messages?.fetch) return null;

    const messages = await interaction.channel.messages.fetch({ limit: 25 });
    const imageRegex = /\.(png|jpe?g|gif|webp|bmp|tiff|avif|heic)(\?.*)?$/i;

    for (const msg of messages.values()) {
        if (msg.system || msg.id === interaction.id) continue;
        const imageAttachment = msg.attachments?.find(a => (a.contentType && a.contentType.startsWith("image/")) || imageRegex.test(a.url));
        if (!imageAttachment) continue;

        return {
            message_id: msg.id,
            username: msg.member?.displayName ?? msg.author?.username ?? "Unknown",
            user_id: msg.author?.id ?? null,
            time: msg.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }),
            filename: imageAttachment.name ?? "image",
            url: imageAttachment.url,
        };
    }

    return null;
}