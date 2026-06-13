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
const debug = process.env.DEBUG == 'true' ? true : false;

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
    tool: `You can use tools to help the user. You also have access to the chess_engine_tool. CHESS RULES: If the user sends a single chess move, call chess_engine_tool with that move as 'input'. If the user asks about a hypothetical sequence or PGN (e.g. '1. e4 e5 ...'), you MUST pass the FULL PGN sequence as the 'input' to the tool so it can analyze the board. Do NOT guess the next move and pass it alone, always pass what the user provided. When you receive the engine's response, react organically! If a move is a Mistake or Blunder, you can playfully mock or warn the user. If it's a Brilliant or Great move, be amazed and praise them. Be sure to naturally include the classification emoji returned by the tool (e.g., <:brilliant:1142557780843184128>) in your response next to the move.`,
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
                    input: { type: "string", description: "A FEN string, a full PGN string, or a single SAN move (e.g. 'e4', 'Nf3', 'O-O'). If a SAN move is provided, it is applied to the current session game state." },
                    depth: { type: "number", description: "Engine search depth (1-20). Default 15. Higher = stronger but slower." },
                    session_id: { type: "string", description: "A unique session identifier (e.g. the channel ID) to persist the game state across multiple turns." },
                },
                required: ["input"]
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

async function chess_engine_tool({ input, depth = 15, session_id = "default" }) {
    try {
        const { getStockfishMove } = require('./utils/classification');
        const isSfAvailable = (await getStockfishMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1, 1)) !== null;
        if (!isSfAvailable) {
            return { error: "Stockfish satranc motoru sistemde bulunamadi. Lutfen bot sahibine 'run.bat' dosyasini calistirarak Stockfish kurulumunu yapmasini soyleyin. Su anda satranc oynamaniz veya analiz yapmaniz mumkun degil." };
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

        // --- Handle special commands first ---
        const cmd = input.trim().toLowerCase();
        if (cmd === 'reset' || cmd === 'new' || cmd === 'yeni' || cmd === 'başla') {
            if (!chessSessionStore.has(session_id)) chessSessionStore.set(session_id, { chess: new Chess(), lastMoveClass: "", outOfBook: false });
            const session = chessSessionStore.get(session_id);
            session.chess = new Chess();
            session.lastMoveClass = "";
            session.outOfBook = false;
            return { message: "New game started. You play White. Make your move!", fen: session.chess.fen() };
        }

        if (!chessSessionStore.has(session_id)) {
            chessSessionStore.set(session_id, { chess: new Chess(), lastMoveClass: "", outOfBook: false });
        }
        let session = chessSessionStore.get(session_id);

        if (cmd === 'fen') return { fen: session.chess.fen() };
        if (cmd === 'pgn') return { pgn: session.chess.pgn() };

        // --- Detect input type ---
        const fenParts = input.trim().split(' ');
        const isFEN = fenParts.length >= 4 && fenParts[0].includes('/');
        const isPGN = !isFEN && (input.includes('[') || /^\d+\./.test(input.trim()) || fenParts.length > 1);

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
                    const engineMoveObj = chess.move({ from: engineResult.move.substring(0, 2), to: engineResult.move.substring(2, 4), promotion: engineResult.move[4] || undefined });
                    let isBookEngine = false;
                    if (!outOfBook) {
                        isBookEngine = await checkChessDBBook(engineFenBefore, engineMoveObj);
                    }

                    if (isBookEngine) {
                        bestNextClass = "book";
                        chess.undo();
                    } else {
                        const engineEvalAfter = await getStockfishMove(chess.fen(), depth, 3);
                        chess.undo(); // Revert back to the position before the engine move

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
        chess = session.chess;
        let classification = "book";
        let isBookUser = false;

        const fenBefore = chess.fen();
        const isWhiteTurn = chess.turn() === 'w';

        let moveObj;
        try {
            moveObj = chess.move(input.trim());
        } catch (e) {
            return { error: `Invalid move: "${input}". Legal moves: ${chess.moves().join(', ')}` };
        }

        if (!moveObj) return { error: `Invalid move: "${input}". Legal moves: ${chess.moves().join(', ')}` };

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

        if (chess.isGameOver()) {
            return {
                user_move: moveObj.san,
                user_move_classification: classification,
                user_move_symbol: badgeSymbols[classification] ?? '',
                game_over: true,
                message: "Game over!",
                fen: chess.fen(),
            };
        }

        // Engine response
        const engineResult = await getStockfishMove(chess.fen(), depth, 3);
        let bestNextClass = "best";
        if (engineResult.move) {
            const engineFenBefore = chess.fen();
            const engineTurnIsWhite = chess.turn() === 'w';
            const engineMoveObj = chess.move({ from: engineResult.move.substring(0, 2), to: engineResult.move.substring(2, 4), promotion: engineResult.move[4] || undefined });

            let isBookEngine = false;
            if (!session.outOfBook) {
                isBookEngine = await checkChessDBBook(engineFenBefore, engineMoveObj);
                if (!isBookEngine) session.outOfBook = true;
            }

            if (isBookEngine) {
                bestNextClass = "book";
                // Keep the move applied for the ongoing game session!
            } else {
                const engineEvalAfter = await getStockfishMove(chess.fen(), depth, 3);
                // Keep the move applied for the ongoing game session!

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

        return {
            user_move: moveObj.san,
            user_move_classification: classification,
            user_move_symbol: badgeSymbols[classification] ?? '',
            engine_reply: uciToSAN(chess, engineResult.move), // The move is already applied to chess
            engine_reply_classification: bestNextClass,
            engine_reply_symbol: badgeSymbols[bestNextClass] ?? '',
            evaluation: evalLabel(engineResult),
            fen: chess.fen(),
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
            tool_usage: "Araç Kullanımı",
            ai_settings: "Yapay Zeka Ayarları",
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
            tool_called: new Proxy({ run_javascript_code: "JavaScript çalıştırıldı: {a}" }, {
                get: function (target, prop) {
                    return prop in target ? target[prop] : "Araç çağrıldı: " + prop + " argümanlar: {a}";
                }
            }),
            tool_response: "Araç yanıtı: {a}",
            no_tool_response: "Araçtan yanıt alınamadı",
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
                                    content: l.tool_called[args[0]].toString().replace('{a}', args[1]?.code || JSON.stringify(args[1])),
                                },
                                { type: ComponentType.Separator, spacing: 1 },
                                {
                                    type: ComponentType.TextDisplay,
                                    content: args[2] ? l.tool_response.replace('{a}', args[2]) : l.no_tool_response,
                                }
                            ],
                        },
                        text: {
                            type: ComponentType.TextDisplay,
                            content: l.no_response,
                        },
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
                                        if (input.trim() != "") message[message.length - 1].content = input;
                                        animStep = 1;
                                    }
                                    else {
                                        message[message.length - 1].components[0].content = l.thinking + ".".repeat(animStep);
                                        animStep++;
                                        if (animStep > 3) animStep = 1;
                                    }
                                    break;
                                case 'text':
                                    if (input.trim() != "") message[message.length - 1].content = input;
                                    break;
                                case 'tool_call':
                                    message.push(component.text);
                                    last_component = "text";
                                    if (input.trim() != "") message[message.length - 1].content = input;
                                    break;
                                default:
                                    if (message.length == 0 && input) {
                                        message.push(component.text);
                                        last_component = "text";
                                        if (input.trim() != "") message[message.length - 1].content = input;
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
                        content: `${sys.json} ${(data.settings.tool_usage ? sys.tool + " " : " ")}${sys[data.settings.personality].prompt}\n${contextInstruction}\nYou may mention users by sending '<@user_id>' in your response, but only when they aren't present and you must never mention twice. You are currently chatting in '${interaction.channel.name}' channel in '${interaction.guild.name}' server. Current channel ID for chess sessions: ${interaction.channel.id}.`
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
                            maxTokens: 2048,
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
                                context.push(structuredClone(output), await handleToolCall(output.tool_calls[0]));
                                await sendMessage('add', 'tool_call', output.tool_calls[0].function.name, output.tool_calls[0].function.arguments, context[context.length - 1].content);
                                delete output.tool_calls;
                                output.content = ""
                                pendingUsageIds.push(part.id);
                                continue agentic_loop;
                            }
                            if ((step >= stepLimit | part.choices[0]?.finishReason == "stop") & !thinking) {
                                step = 0;
                                if (toolcalled && part.choices[0]?.finishReason == "stop") {
                                    output.content = output.content.trim();
                                    if (output.content != "") await sendMessage('edit', output.content);
                                    if (output.content == "" && thinking) { tt = Date.now() - t0; thinking = false; step = 0; await sendMessage('edit', tt); }
                                    step = 0;
                                    toolcalled = false;
                                    if (output.tool_calls[0].function.arguments) output.tool_calls[0].function.arguments = extractJsonString(output.tool_calls[0].function.arguments);
                                    context.push(structuredClone(output), await handleToolCall(output.tool_calls[0]));
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

async function handleToolCall(toolCall) {
    toolCall.function.arguments ? toolCall.function.arguments = JSON.parse(extractJsonString(toolCall.function.arguments)) : toolCall.function.arguments = {};
    var toolResponse = await TOOL[toolCall.function.name](toolCall.function.arguments);
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