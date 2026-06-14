const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { Chess } = require('chess.js');
const { Jimp, JimpMime, loadFont } = require('jimp');
const path = require('path');
const { spawn } = require('child_process');

// All classification & engine logic lives in classification.js
const {
    getStockfishMove,
    classifyMove,
    checkChessDBBook,
    calculateWinProbability,
    evalToCp,
    getMaterialValue,
    getPieceValue,
    badgeSymbols,
    badgeFiles,
} = require('./utils/classification.js');

// Store active games: userId => { chess, difficulty, evalData, showEvoBar, showAnalysis, isThinking, ... }
const activeGames = new Map();
let fontBlack = null;
let fontWhite = null;

async function initFonts() {
    if (!fontBlack) fontBlack = await loadFont(path.join(__dirname, '..', '..', 'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans', 'open-sans-16-black', 'open-sans-16-black.fnt'));
    if (!fontWhite) fontWhite = await loadFont(path.join(__dirname, '..', '..', 'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans', 'open-sans-16-white', 'open-sans-16-white.fnt'));
}

function generateBoardImageURL(fen) {
    return `https://fen2image.chessvision.ai/${encodeURIComponent(fen)}`;
}

async function generateBoardAttachment(fen, evalData, showEvoBar, resultScore = null, isWhiteWinningFinal = true, lastMoveBadge = "", targetSquare = "", sourceSquare = "", isForfeit = false) {
    const url = generateBoardImageURL(fen);
    try {
        const image = await Jimp.read(url);
        const w = image.bitmap.width;
        const h = image.bitmap.height;
        // Crop the bottom 50 pixels
        if (h > 50) {
            image.crop({ x: 0, y: 0, w: w, h: h - 50 });
        }

        const newW = w;
        const newH = h > 50 ? h - 50 : h;

        await initFonts();

        if (sourceSquare) {
            const squareSize = 554 / 8;
            let highlightColor = 0xCCCC00AA; // Default yellowish
            if (lastMoveBadge) {
                switch (lastMoveBadge) {
                    case 'brilliant': highlightColor = 0x00CED1AA; break; // Cyan
                    case 'great': highlightColor = 0x4682B4AA; break; // Blue
                    case 'best': highlightColor = 0x32CD32CC; break; // Green (Bright/Solid)
                    case 'excellent': highlightColor = 0x32CD3288; break; // Green (Medium faint)
                    case 'good': highlightColor = 0x32CD3255; break; // Green (Very faint)
                    case 'inaccuracy': highlightColor = 0xFFD700AA; break; // Yellow
                    case 'mistake': highlightColor = 0xFFA500AA; break; // Orange
                    case 'blunder': highlightColor = 0xFF0000AA; break; // Red
                    case 'book': highlightColor = 0x8B4513AA; break; // Brown
                    case 'magnificent': highlightColor = 0x9B30FFAA; break; // Purple
                }
            }
            const highlightSquare = (sq) => {
                const col = sq.charCodeAt(0) - 97; // 'a'
                const row = 8 - parseInt(sq[1]);
                const startX = Math.round(23 + col * squareSize);
                const startY = Math.round(23 + row * squareSize);
                const endX = Math.round(23 + (col + 1) * squareSize);
                const endY = Math.round(23 + (row + 1) * squareSize);

                const highlightW = endX - startX;
                const highlightH = endY - startY;

                const dynamicHighlight = new Jimp({ width: highlightW, height: highlightH, color: highlightColor });

                image.composite(dynamicHighlight, startX, startY, {
                    mode: Jimp.BLEND_SOURCE_OVER,
                    opacitySource: 1.0
                });
            };

            highlightSquare(sourceSquare);
        }

        if (targetSquare) {
            // Hedef kare: içi değil, etrafına 2px çerçeve çiz
            const squareSize = 554 / 8;
            const col = targetSquare.charCodeAt(0) - 97;
            const row = 8 - parseInt(targetSquare[1]);

            const x = Math.round(23 + col * squareSize);
            const y = Math.round(23 + row * squareSize);
            const nextX = Math.round(23 + (col + 1) * squareSize);
            const nextY = Math.round(23 + (row + 1) * squareSize);

            const sw = nextX - x;
            const sh = nextY - y;
            const borderThickness = 3; // Make border slightly thicker to look better and cover gaps

            // Determine border color from lastMoveBadge (same palette as source fill)
            let borderColor = 0xCCCC00FF;
            if (lastMoveBadge) {
                switch (lastMoveBadge) {
                    case 'brilliant': borderColor = 0x00CED1FF; break;
                    case 'great': borderColor = 0x4682B4FF; break;
                    case 'best': borderColor = 0x32CD32FF; break;
                    case 'excellent': borderColor = 0x32CD32CC; break;
                    case 'good': borderColor = 0x32CD3299; break;
                    case 'inaccuracy': borderColor = 0xFFD700FF; break;
                    case 'mistake': borderColor = 0xFFA500FF; break;
                    case 'blunder': borderColor = 0xFF0000FF; break;
                    case 'book': borderColor = 0x8B4513FF; break;
                    case 'forced': borderColor = 0xAAAAAAAA; break;
                    case 'magnificent': borderColor = 0x9B30FFFF; break;
                }
            }

            // Draw 4 border rectangles (top, bottom, left, right)
            const drawRect = (rx, ry, rw, rh) => {
                const rect = new Jimp({ width: rw, height: rh, color: borderColor });
                image.composite(rect, rx, ry, { mode: Jimp.BLEND_SOURCE_OVER, opacitySource: 1.0 });
            };
            drawRect(x, y, sw, borderThickness);             // top
            drawRect(x, y + sh - borderThickness, sw, borderThickness); // bottom
            drawRect(x, y, borderThickness, sh);             // left
            drawRect(x + sw - borderThickness, y, borderThickness, sh); // right
        }

        if (targetSquare && lastMoveBadge) {
            const col = targetSquare.charCodeAt(0) - 97; // 'a' is 97
            const row = 8 - parseInt(targetSquare[1]);
            const squareSize = 554 / 8; // exactly 69.25

            // The top-right corner of the square is the intersection of the 4 squares
            const cornerX = 23 + (col + 1) * squareSize;
            const cornerY = 23 + row * squareSize;

            // Center of the badge is 4px left and 4px down from the corner. 
            // Badge is resized to 28x28, so we subtract 14 to get top-left coordinates.
            const badgeX = Math.floor(cornerX - 4 - 14);
            const badgeY = Math.floor(cornerY + 4 - 14);

            const filename = badgeFiles[lastMoveBadge];
            if (filename) {
                try {
                    const badgePath = path.join(__dirname, '..', '..', 'media', 'move_classifications', filename);
                    const badgeImg = await Jimp.read(badgePath);
                    badgeImg.resize({ w: 28, h: 28 });
                    image.composite(badgeImg, badgeX, badgeY);
                } catch (e) {
                    console.error("PNG rendering error:", e);
                }
            }
        }

        // Check if game is over and draw overlays
        if (resultScore) {
            let wkRow = -1, wkCol = -1, bkRow = -1, bkCol = -1;
            const ranks = fen.split(' ')[0].split('/');
            for (let r = 0; r < 8; r++) {
                let c = 0;
                for (let char of ranks[r]) {
                    if (char >= '1' && char <= '8') {
                        c += parseInt(char);
                    } else {
                        if (char === 'K') { wkRow = r; wkCol = c; }
                        if (char === 'k') { bkRow = r; bkCol = c; }
                        c++;
                    }
                }
            }

            const squareSize = 554 / 8;
            const getSquareCenter = (col, row) => ({
                x: Math.floor(23 + col * squareSize + squareSize / 2),
                y: Math.floor(23 + row * squareSize + squareSize / 2)
            });

            try {
                const winnerPath = path.join(__dirname, '..', '..', 'media', 'move_classifications', 'winner.png');
                const loserPath = path.join(__dirname, '..', '..', 'media', 'move_classifications', 'loser.png');
                const winnerImg = await Jimp.read(winnerPath);
                const loserImg = await Jimp.read(loserPath);
                winnerImg.resize({ w: 28, h: 28 });
                loserImg.resize({ w: 28, h: 28 });

                const getBadgeCoords = (col, row) => {
                    const cornerX = 23 + (col + 1) * squareSize;
                    const cornerY = 23 + row * squareSize;
                    return {
                        x: Math.floor(cornerX - 4 - 14),
                        y: Math.floor(cornerY + 4 - 14)
                    };
                };

                const wkCoords = getBadgeCoords(wkCol, wkRow);
                const bkCoords = getBadgeCoords(bkCol, bkRow);

                if (resultScore === "1-0") { // White wins
                    if (wkRow !== -1) image.composite(winnerImg, wkCoords.x, wkCoords.y);
                    if (bkRow !== -1) image.composite(loserImg, bkCoords.x, bkCoords.y);
                } else if (resultScore === "0-1") { // Black wins
                    if (bkRow !== -1) image.composite(winnerImg, bkCoords.x, bkCoords.y);
                    if (wkRow !== -1) image.composite(loserImg, wkCoords.x, wkCoords.y);
                }
            } catch (e) {
                console.error("Endgame overlay error:", e);
            }
        }

        if (!showEvoBar) {
            const buffer = await image.getBuffer(JimpMime.png);
            return new AttachmentBuilder(buffer, { name: 'board.png' });
        }

        let whitePct = 0.5;
        let isMate = false;

        if (evalData) {
            if (evalData.mate !== null) {
                whitePct = evalData.mate > 0 ? 1.0 : 0.0;
                isMate = true;
            } else if (evalData.evaluation !== null) {
                const clamped = Math.max(-10, Math.min(10, evalData.evaluation));
                whitePct = 0.5 + (clamped / 20);
            }
        }

        if (!isMate) {
            whitePct = Math.max(0.02, Math.min(0.98, whitePct));
        }

        const barWidth = 40;
        const finalImage = new Jimp({ width: newW + barWidth, height: newH, color: 0x2C2F33FF });

        const splitY = Math.floor(newH * (1 - whitePct));

        const blackBar = new Jimp({ width: barWidth, height: splitY > 0 ? splitY : 1, color: 0x333333FF }); // Grayish-black
        const whiteBar = new Jimp({ width: barWidth, height: (newH - splitY) > 0 ? (newH - splitY) : 1, color: 0xFFFFFFFF });

        if (splitY > 0) finalImage.composite(blackBar, 0, 0);
        if (newH - splitY > 0) finalImage.composite(whiteBar, 0, splitY);

        finalImage.composite(image, barWidth, 0);

        // Draw evaluation text on the bar
        await initFonts();
        let evalString = "";
        let isWhiteWinning = true;

        if (resultScore && !isForfeit) {
            evalString = resultScore;
            isWhiteWinning = isWhiteWinningFinal;
        } else if (evalData) {
            if (evalData.mate !== null) {
                evalString = `M${Math.abs(evalData.mate)}`;
                isWhiteWinning = evalData.mate > 0;
            } else if (evalData.evaluation !== null && evalData.evaluation !== undefined) {
                const val = parseFloat(evalData.evaluation);
                if (!isNaN(val)) {
                    // Start of game 0.0 hide logic
                    if (!(Math.abs(val) <= 0.05 && fen.includes("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"))) {
                        evalString = val.toFixed(1);
                    }
                }
                isWhiteWinning = val >= 0;
            }
        }

        if (evalString) {
            // Rough centering based on string length (approx 8px per char width)
            const textX = Math.max(2, Math.floor((barWidth - (evalString.length * 8)) / 2));
            if (isWhiteWinning) {
                finalImage.print({ font: fontBlack, x: textX, y: newH - 30, text: evalString });
            } else {
                finalImage.print({ font: fontWhite, x: textX, y: 10, text: evalString });
            }
        }

        const buffer = await finalImage.getBuffer(JimpMime.png);
        return new AttachmentBuilder(buffer, { name: 'board.png' });
    } catch (e) {
        console.error("Image generation error:", e);
        return null;
    }
}

function getChessComponents(gameEnded, userId, gameType = 'PvE', takebackState = null) {
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();

    if (!gameEnded) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(`chess_move_btn_${userId}`)
                .setLabel('Hamle Yap')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`chess_history_btn_${userId}`)
                .setLabel('Geçmiş')
                .setStyle(ButtonStyle.Secondary)
        );

        if (gameType === 'PvP') {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`chess_draw_btn_${userId}`)
                    .setLabel('Berabere Teklif Et')
                    .setStyle(ButtonStyle.Success)
            );
        }

        // Takeback button (Hem PvP hem PvE)
        if (takebackState === 'pending') {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`chess_takeback_accept_${userId}`)
                    .setLabel('Geri Alma Bekleniyor - Kabul Et?')
                    .setStyle(ButtonStyle.Secondary)
            );
        } else {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId(`chess_takeback_request_${userId}`)
                    .setLabel('Hamle Geri Al')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        row2.addComponents(
            new ButtonBuilder()
                .setCustomId(`chess_resign_btn_${userId}`)
                .setLabel('Pes Et')
                .setStyle(ButtonStyle.Danger)
        );

        const components = [row1];
        if (row2.components.length > 0) components.push(row2);
        return components;
    } else {
        return [];
    }
}

async function buildBoardMessage(chess, userId, message = "", evalData = null, showEvoBar = true, lastMoveBadge = "", targetSquare = "", resultScoreOverride = null, sourceSquare = "") {
    const fen = chess.fen();
    const isGameOver = chess.isGameOver() || resultScoreOverride !== null;
    const turnColor = chess.turn() === 'w' ? 'Beyaz' : 'Siyah';

    // Maç bittiğinde evobar'ı zorla göster
    if (isGameOver) {
        showEvoBar = true;
    }

    let status = `Sıra: ${turnColor}`;
    let resultScore = resultScoreOverride;
    let isWhiteWinningFinal = true;

    if (resultScoreOverride !== null) {
        if (resultScoreOverride === "1-0") isWhiteWinningFinal = true;
        else if (resultScoreOverride === "0-1") isWhiteWinningFinal = false;
        else if (resultScoreOverride === "1/2") isWhiteWinningFinal = true;
    } else if (chess.isCheckmate()) {
        status = "Şah Mat! Oyun Bitti.";
        if (chess.turn() === 'w') {
            resultScore = "0-1"; // White got checkmated
            isWhiteWinningFinal = false;
        } else {
            resultScore = "1-0"; // Black got checkmated
            isWhiteWinningFinal = true;
        }
    } else if (chess.isDraw()) {
        status = "Berabere! Oyun Bitti.";
        resultScore = "1/2";
        isWhiteWinningFinal = true;
    } else if (chess.isCheck()) {
        status += " (Şah çekildi!)";
    }

    const isForfeit = !chess.isGameOver() && (resultScoreOverride === "1-0" || resultScoreOverride === "0-1");
    let evalText = "";
    if (showEvoBar) {
        // E\u011fer ma\u00e7 pes etme (FF) ile bitiyorsa, resultScore "1-0" veya "0-1" olur ama satran\u00e7 motorunda oyun bitmemi\u015ftir.
        // Bu durumda de\u011ferlendirme puan\u0131n\u0131 aynen b\u0131rakmal\u0131y\u0131z.
        if (resultScore && !isForfeit) {
            // Mat, pat veya karşılıklı beraberlik durumunda direkt skoru yaz (örn: 1-0, 1/2)
            evalText = `**De\u011ferlendirme:** ${resultScore}\n`;
        } else if (evalData) {
            // Oyun devam ediyor veya FF verilmişse sayısal puanı göster
            if (evalData.mate !== null) {
                evalText = `**De\u011ferlendirme:** M${Math.abs(evalData.mate)}\n`;
            } else if (evalData.evaluation !== null && evalData.evaluation !== undefined) {
                const val = parseFloat(evalData.evaluation);
                // İlk hamle yapılmadan önceki 0.0 anlamsızdır, onu gizleyelim
                if (!(chess.history().length === 0 && Math.abs(val) <= 0.05)) {
                    evalText = `**De\u011ferlendirme:** ${val > 0 ? '+' : ''}${val.toFixed(1)}\n`;
                }
            }
        }
    }

    const embedTitle = chess._gameType === 'PvP' ? 'Satranç: PvP Maçı' : 'Satranç: Sen vs Stockfish';

    // Embed rengi: oyun boyunca gri, beyaz kazandıysa beyaz, siyah kazandıysa siyah, beraberse gri
    let embedColor = 0x808080; // Grey (ongoing)
    if (isGameOver) {
        if (resultScore === '1-0') embedColor = 0xFFFFFF;      // White wins
        else if (resultScore === '0-1') embedColor = 0x111111; // Black wins
        else embedColor = 0x808080;                            // Draw = grey
    }

    const embed = new EmbedBuilder()
        .setTitle(embedTitle)
        .setDescription(`<@${userId}> \n\n${status}\n${evalText}\n${message}`)
        .setColor(embedColor);

    if (isGameOver) {
        const pgn = chess.pgn() || 'Hamle yok';
        const pgnDisplay = pgn.length > 1000 ? pgn.substring(0, 997) + '...' : pgn;
        embed.addFields({ name: 'PGN', value: `\`\`\`\n${pgnDisplay}\n\`\`\``, inline: false });
    }

    const attachment = await generateBoardAttachment(fen, evalData, showEvoBar, resultScore, isWhiteWinningFinal, lastMoveBadge, targetSquare, sourceSquare, isForfeit);
    if (attachment) {
        embed.setImage('attachment://board.png');
    } else {
        embed.setImage(generateBoardImageURL(fen));
    }

    return {
        content: "",
        embeds: [embed],
        components: getChessComponents(isGameOver, userId, chess._gameType, chess._takebackState),
        files: attachment ? [attachment] : []
    };
}

function findMatchingMove(chess, moveInput) {
    const cleanInput = moveInput.trim().replace(/[\+#\?\!\s]/g, '');

    // Support castling notation variations
    let normalizedInput = cleanInput;
    if (cleanInput.toLowerCase() === 'o-o') {
        normalizedInput = 'O-O';
    } else if (cleanInput.toLowerCase() === 'o-o-o') {
        normalizedInput = 'O-O-O';
    } else if (cleanInput === '0-0') {
        normalizedInput = 'O-O';
    } else if (cleanInput === '0-0-0') {
        normalizedInput = 'O-O-O';
    }

    const validMoves = chess.moves({ verbose: true });

    // 1. Try case-insensitive matching against SAN (Standard Algebraic Notation)
    const matchedSan = validMoves.find(m => {
        const cleanSan = m.san.replace(/[\+#\?\!\s]/g, '');
        return cleanSan.toLowerCase() === normalizedInput.toLowerCase();
    });
    if (matchedSan) return matchedSan.san;

    // 2. Try case-insensitive matching against UCI coordinate notation (e.g., e2e4 or e7e8q)
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(normalizedInput)) {
        const from = normalizedInput.substring(0, 2).toLowerCase();
        const to = normalizedInput.substring(2, 4).toLowerCase();
        const promotion = normalizedInput[4]?.toLowerCase();
        const matchedCoordinate = validMoves.find(m => {
            return m.from === from && m.to === to && (!promotion || m.promotion === promotion);
        });
        if (matchedCoordinate) return matchedCoordinate.san;
    }

    // 3. Try matching pawn capture shorthand like "ed5" or "ed"
    if (/^[a-h][a-h][1-8]?$/i.test(normalizedInput)) {
        const fromFile = normalizedInput[0].toLowerCase();
        const toFile = normalizedInput[1].toLowerCase();
        const toRank = normalizedInput[2];
        const matchedCapture = validMoves.find(m => {
            return m.piece === 'p' &&
                m.from[0] === fromFile &&
                m.to[0] === toFile &&
                (!toRank || m.to[1] === toRank);
        });
        if (matchedCapture) return matchedCapture.san;
    }

    return null;
}

async function updateGameMessage(interaction, gameSession, msgData) {
    const interactionMessageId = interaction.message?.id;
    const sessionMessageId = gameSession.message?.id;

    if (sessionMessageId && interactionMessageId && sessionMessageId !== interactionMessageId) {
        try {
            await gameSession.message.edit(msgData);
            return;
        } catch (e) {
            console.error("Failed to edit refreshed game session message:", e);
        }
    }

    try {
        await interaction.editReply(msgData);
    } catch (e) {
        if (e.code === 10008 || e.status === 404) {
            if (gameSession.message) {
                try {
                    await gameSession.message.edit(msgData);
                    return;
                } catch (err) {
                    console.error("Failed to edit message directly after interaction edit failed:", err);
                }
            }
        } else {
            console.error("Failed to edit reply on interaction:", e);
        }
        // Do not throw the error to prevent bot from crashing on expired/deleted message interactions
    }
}

async function triggerNextPremove(gameSession) {
    const nextTurn = gameSession.chess.turn(); // 'w' or 'b'
    const queue = gameSession.premoves?.[nextTurn];
    if (queue && queue.length > 0) {
        const nextMove = queue.shift();
        // Run processMove in background without blocking
        processMove(gameSession, nextMove, nextTurn).catch(console.error);
    }
}

async function processMove(gameSession, moveText, turnColor, interaction = null) {
    const chess = gameSession.chess;
    const ownerId = gameSession.playerWhite;

    // 1. Find case-insensitive matching move
    const matchedMove = findMatchingMove(chess, moveText);
    if (!matchedMove) {
        // Clear queue for this color and alert
        if (gameSession.premoves) {
            gameSession.premoves[turnColor] = [];
        }
        gameSession.isThinking = false;

        const warningMsg = `Pmove geçersiz olduğu için iptal edildi: **${moveText}**`;
        gameSession.lastMessageText = warningMsg;
        const msgData = await buildBoardMessage(chess, ownerId, warningMsg, gameSession.evalData, gameSession.showEvoBar, gameSession.lastMoveBadge, gameSession.lastTargetSquare, null, gameSession.lastSourceSquare);

        if (interaction) {
            await interaction.reply({ content: warningMsg, flags: 64 });
        } else if (gameSession.message) {
            try {
                await gameSession.message.edit(msgData);
            } catch (e) {
                console.error("Failed to edit message for invalid premove warning:", e);
            }
        }
        return;
    }

    const fenBeforeMove = chess.fen();
    let moveObj;
    try {
        moveObj = chess.move(matchedMove);
    } catch (e) {
        // Fallback
        if (gameSession.premoves) {
            gameSession.premoves[turnColor] = [];
        }
        gameSession.isThinking = false;
        return;
    }

    gameSession.isThinking = true;
    if (interaction) {
        await interaction.deferUpdate();
    }

    try {
        if (chess.isGameOver()) {
            activeGames.delete(gameSession.playerWhite);
            if (gameSession.type === 'PvP') activeGames.delete(gameSession.playerBlack);

            let lastBadge = "";
            const lastTarget = moveObj ? moveObj.to : "";
            const lastSource = moveObj ? moveObj.from : "";

            if (gameSession.showAnalysis && moveObj) {
                if (chess.isCheckmate()) {
                    lastBadge = "best";
                    const tempChess = new Chess(fenBeforeMove);
                    tempChess.move(moveObj);
                    const movedPieceVal = getPieceValue(moveObj.piece);
                    const capturedPieceVal = getPieceValue(moveObj.captured);
                    const isWhiteLastMove = chess.turn() === 'b';
                    const opColor = isWhiteLastMove ? 'b' : 'w';
                    const myColor = isWhiteLastMove ? 'w' : 'b';
                    const attackedByOpp = tempChess.isAttacked(moveObj.to, opColor);
                    const defendedByUs = tempChess.isAttacked(moveObj.to, myColor);
                    const netLoss = movedPieceVal - capturedPieceVal;
                    if (attackedByOpp && !defendedByUs && netLoss >= 2 && movedPieceVal >= 3) {
                        lastBadge = "brilliant";
                    }
                } else {
                    lastBadge = "best";
                }
            }

            const msgText = `Oyun bitti!`;
            gameSession.lastMessageText = msgText;
            const msgData = await buildBoardMessage(chess, ownerId, msgText, gameSession.evalData, gameSession.showEvoBar, lastBadge, lastTarget, null, lastSource);

            if (interaction) {
                await updateGameMessage(interaction, gameSession, msgData);
            } else if (gameSession.message) {
                try {
                    await gameSession.message.edit(msgData);
                } catch (e) {
                    console.error("Failed to edit game over message directly:", e);
                }
            }
            return;
        }

        if (gameSession.type === 'PvP') {
            let sfDataBeforeUser = { pvs: {} };
            if (gameSession.showAnalysis) {
                sfDataBeforeUser = await getStockfishMove(fenBeforeMove, gameSession.difficulty, 3);
            }
            const prevEvalUser = { evaluation: gameSession.evalData.evaluation, mate: gameSession.evalData.mate };
            const sfDataAfterUser = await getStockfishMove(chess.fen(), gameSession.difficulty, 1);

            let userClassBadge = "";
            let userTargetSquare = "";
            let userSymbol = "";
            if (gameSession.showAnalysis) {
                let isBook = false;
                if (!gameSession.outOfBook) {
                    isBook = await checkChessDBBook(fenBeforeMove, moveObj);
                    if (!isBook) gameSession.outOfBook = true;
                }

                if (isBook) {
                    userClassBadge = "book";
                } else {
                    const isWhiteMove = chess.turn() === 'b';
                    userClassBadge = await classifyMove(prevEvalUser, sfDataAfterUser, isWhiteMove, sfDataBeforeUser.pvs, moveObj, fenBeforeMove, gameSession.lastMoveBadge);
                }
                userSymbol = badgeSymbols[userClassBadge] || "";
                userTargetSquare = moveObj.to;
            }
            gameSession.evalData = { evaluation: sfDataAfterUser.evaluation, mate: sfDataAfterUser.mate };
            gameSession.lastMoveBadge = userClassBadge;
            gameSession.lastTargetSquare = userTargetSquare;
            gameSession.lastSourceSquare = moveObj.from;
            gameSession.isThinking = false;

            if (!gameSession.moveHistoryData) {
                gameSession.moveHistoryData = [];
            }
            gameSession.moveHistoryData.push({
                badge: userClassBadge,
                targetSquare: userTargetSquare,
                sourceSquare: moveObj.from,
                evalData: { ...gameSession.evalData }
            });

            const nextPlayerId = chess.turn() === 'w' ? gameSession.playerWhite : gameSession.playerBlack;
            const message = `Sıra sende <@${nextPlayerId}>!`;
            gameSession.lastMessageText = message;

            const msgData = await buildBoardMessage(chess, ownerId, message, gameSession.evalData, gameSession.showEvoBar, userClassBadge, userTargetSquare, null, moveObj.from);

            if (activeGames.has(ownerId)) {
                if (interaction) {
                    await updateGameMessage(interaction, gameSession, msgData);
                } else if (gameSession.message) {
                    try {
                        await gameSession.message.edit(msgData);
                    } catch (e) {
                        console.error("Failed to edit PvP message directly:", e);
                    }
                }
                // Trigger next premove in PvP
                await triggerNextPremove(gameSession);
            }

        } else {
            // PvE Mode
            let sfDataBeforeUser = { pvs: {} };
            if (gameSession.showAnalysis) {
                sfDataBeforeUser = await getStockfishMove(fenBeforeMove, gameSession.difficulty, 3);
            }
            const prevEvalUser = { evaluation: gameSession.evalData.evaluation, mate: gameSession.evalData.mate };
            const sfDataAfterUser = await getStockfishMove(chess.fen(), gameSession.difficulty, 1);

            let userClassBadge = "";
            let userTargetSquare = "";
            let userSymbol = "";
            if (gameSession.showAnalysis) {
                let isBook = false;
                if (!gameSession.outOfBook) {
                    isBook = await checkChessDBBook(fenBeforeMove, moveObj);
                    if (!isBook) gameSession.outOfBook = true;
                }

                if (isBook) {
                    userClassBadge = "book";
                } else {
                    userClassBadge = await classifyMove(prevEvalUser, sfDataAfterUser, true, sfDataBeforeUser.pvs, moveObj, fenBeforeMove, gameSession.lastMoveBadge);
                }
                userSymbol = badgeSymbols[userClassBadge] || "";
                userTargetSquare = moveObj.to;
            }

            gameSession.evalData = { evaluation: sfDataAfterUser.evaluation, mate: sfDataAfterUser.mate };
            gameSession.lastMoveBadge = userClassBadge;
            gameSession.lastTargetSquare = userTargetSquare;
            gameSession.lastSourceSquare = moveObj.from;

            if (!gameSession.moveHistoryData) {
                gameSession.moveHistoryData = [];
            }
            gameSession.moveHistoryData.push({
                badge: userClassBadge,
                targetSquare: userTargetSquare,
                sourceSquare: moveObj.from,
                evalData: { ...gameSession.evalData }
            });

            const interimMsgText = `Düşünüyor... ${userSymbol}`;
            gameSession.lastMessageText = interimMsgText;

            const interimMsgData = await buildBoardMessage(chess, ownerId, interimMsgText, gameSession.evalData, gameSession.showEvoBar, userClassBadge, userTargetSquare, null, moveObj.from);

            if (activeGames.has(ownerId)) {
                if (interaction) {
                    await updateGameMessage(interaction, gameSession, interimMsgData);
                } else if (gameSession.message) {
                    try {
                        await gameSession.message.edit(interimMsgData);
                    } catch (e) {
                        console.error("Failed to edit PvE interim message directly:", e);
                    }
                }
            }

            if (!sfDataAfterUser.move) {
                gameSession.isThinking = false;
                return;
            }

            const fenBeforeSfMove = chess.fen();
            let sfMoveObj;
            try {
                sfMoveObj = chess.move(sfDataAfterUser.move);
            } catch (e) {
                sfMoveObj = null;
            }

            const sfDataAfterSf = await getStockfishMove(chess.fen(), gameSession.difficulty, 1);

            let sfClassBadge = "";
            let sfTargetSquare = "";
            let sfSymbol = "";

            if (gameSession.showAnalysis && sfMoveObj) {
                if (chess.isGameOver() && chess.isCheckmate()) {
                    sfClassBadge = "best";
                    const tempChess2 = new Chess(fenBeforeSfMove);
                    tempChess2.move(sfMoveObj);
                    const sfMovedVal = getPieceValue(sfMoveObj.piece);
                    const sfCapturedVal = getPieceValue(sfMoveObj.captured);
                    const sfOpColor = 'w';
                    const sfMyColor = 'b';
                    const sfAttacked = tempChess2.isAttacked(sfMoveObj.to, sfOpColor);
                    const sfDefended = tempChess2.isAttacked(sfMoveObj.to, sfMyColor);
                    const sfNetLoss = sfMovedVal - sfCapturedVal;
                    if (sfAttacked && !sfDefended && sfNetLoss >= 2 && sfMovedVal >= 3) {
                        sfClassBadge = "brilliant";
                    }
                } else if (!chess.isGameOver()) {
                    let isBookSf = false;
                    if (!gameSession.outOfBook) {
                        isBookSf = await checkChessDBBook(fenBeforeSfMove, sfMoveObj);
                        if (!isBookSf) gameSession.outOfBook = true;
                    }
                    sfClassBadge = isBookSf ? "book" : await classifyMove(gameSession.evalData, sfDataAfterSf, false, null, sfMoveObj, fenBeforeSfMove, userClassBadge);
                }
                sfSymbol = badgeSymbols[sfClassBadge] || "";
                sfTargetSquare = sfMoveObj.to;
            }
            const sfSourceSquare = sfMoveObj ? sfMoveObj.from : sfDataAfterUser.move.substring(0, 2);

            if (chess.isGameOver() && chess.isCheckmate()) {
                gameSession.evalData = { evaluation: null, mate: 0 };
            } else {
                gameSession.evalData = { evaluation: sfDataAfterSf.evaluation, mate: sfDataAfterSf.mate };
            }
            gameSession.lastMoveBadge = sfClassBadge;
            gameSession.lastTargetSquare = sfTargetSquare;
            gameSession.lastSourceSquare = sfSourceSquare;
            gameSession.isThinking = false;

            if (!gameSession.moveHistoryData) {
                gameSession.moveHistoryData = [];
            }
            gameSession.moveHistoryData.push({
                badge: sfClassBadge,
                targetSquare: sfTargetSquare,
                sourceSquare: sfSourceSquare,
                evalData: { ...gameSession.evalData }
            });

            if (chess.isGameOver()) {
                activeGames.delete(gameSession.playerWhite);
                const gameOverMsgData = await buildBoardMessage(chess, ownerId, `Oyun bitti!`, gameSession.evalData, gameSession.showEvoBar, sfClassBadge, sfTargetSquare, null, sfSourceSquare);
                if (interaction) {
                    await updateGameMessage(interaction, gameSession, gameOverMsgData);
                } else if (gameSession.message) {
                    try {
                        await gameSession.message.edit(gameOverMsgData);
                    } catch (e) {
                        console.error("Failed to edit PvE game over message directly:", e);
                    }
                }
                return;
            }

            const finalMsgText = `Stockfish oynadı: **${sfMoveObj ? sfMoveObj.san : sfDataAfterUser.move}** ${sfSymbol}\nSıra sende.`;
            gameSession.lastMessageText = finalMsgText;
            const finalMsgData = await buildBoardMessage(chess, ownerId, finalMsgText, gameSession.evalData, gameSession.showEvoBar, sfClassBadge, sfTargetSquare, null, sfSourceSquare);

            if (activeGames.has(ownerId)) {
                if (interaction) {
                    await updateGameMessage(interaction, gameSession, finalMsgData);
                } else if (gameSession.message) {
                    try {
                        await gameSession.message.edit(finalMsgData);
                    } catch (e) {
                        console.error("Failed to edit Stockfish response message directly:", e);
                    }
                }
                // Trigger next premove in PvE
                await triggerNextPremove(gameSession);
            }
        }
    } catch (error) {
        console.error(error);
        gameSession.isThinking = false;
    }
}

module.exports = {
    cooldown: 0,
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Yapay Zeka veya bir arkadaşınız ile satranç oynayın')
        .addUserOption(option =>
            option.setName('rakip')
                .setDescription('Oynamak istediğiniz kişiyi etiketleyin (Boş bırakırsanız bota karşı oynarsınız)')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('zorluk')
                .setDescription('Stockfish zorluk seviyesi (1-20 aras\u0131, varsay\u0131lan: 15)')
                .setMinValue(1)
                .setMaxValue(20)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('evobar')
                .setDescription('Değerlendirme çubuğu gösterilsin mi? (varsayılan: Evet)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('analiz')
                .setDescription('Hamle kalitesi (Blunder, Mistake vs.) gösterilsin mi? (varsayılan: Evet)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const { getStockfishMove } = require('./utils/classification');
        // Test call to see if stockfish is available
        const isStockfishAvailable = (await getStockfishMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 1, 1)) !== null;
        if (!isStockfishAvailable) {
            return interaction.reply({ content: 'Stockfish satranç motoru bulunamadı. Lütfen `run.bat` (veya `run.sh`) dosyasını çalıştırarak Stockfish kurulumunu gerçekleştirin.', flags: 64 });
        }

        const userId = interaction.user.id;
        const opponentUser = interaction.options.getUser('rakip');

        if (activeGames.has(userId)) {
            const gameSession = activeGames.get(userId);

            if (gameSession.isThinking) {
                await interaction.deferReply();
                let waitTime = 0;
                while (gameSession.isThinking && waitTime < 10000) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    waitTime += 500;
                }
            }

            // Delete old message if exists
            if (gameSession.message) {
                try {
                    await gameSession.message.delete();
                } catch (e) {
                    console.error("Failed to delete old chess message:", e);
                }
                gameSession.message = null;
            }

            if (!interaction.deferred) {
                await interaction.deferReply();
            }

            const msgData = await buildBoardMessage(
                gameSession.chess,
                gameSession.playerWhite,
                gameSession.lastMessageText || "",
                gameSession.evalData,
                gameSession.showEvoBar,
                gameSession.lastMoveBadge || "",
                gameSession.lastTargetSquare || "",
                null,
                gameSession.lastSourceSquare || ""
            );

            msgData.fetchReply = true;
            const reply = await interaction.editReply(msgData);
            gameSession.message = reply;
            return;
        }

        let type = 'PvE';
        let playerWhite = userId;
        let playerBlack = 'stockfish';

        if (opponentUser) {
            if (opponentUser.bot) {
                return interaction.reply({ content: 'Botlara karşı satranç oynayamazsınız. Bota karşı oynamak için rakip kısmını boş bırakın.', flags: 64 });
            }
            if (opponentUser.id === userId) {
                return interaction.reply({ content: 'Kendinizle satranç oynayamazsınız!', flags: 64 });
            }
            if (activeGames.has(opponentUser.id)) {
                return interaction.reply({ content: `<@${opponentUser.id}> adlı kullanıcının zaten devam eden bir maçı var.`, flags: 64 });
            }
            type = 'PvP';
            playerBlack = opponentUser.id;
        }

        await interaction.deferReply();

        const difficulty = interaction.options.getInteger('zorluk') || 15;
        const showEvoBar = interaction.options.getBoolean('evobar') ?? true;
        const showAnalysis = interaction.options.getBoolean('analiz') ?? true;
        const chess = new Chess();
        const evalData = { evaluation: 0.0, mate: null };

        const gameSession = { type, playerWhite, playerBlack, chess, difficulty, evalData, showEvoBar, showAnalysis, isThinking: false, outOfBook: false, lastMoveBadge: "", lastTargetSquare: "", lastSourceSquare: "", lastMessageText: "", moveHistoryData: [] };
        chess._gameType = type;   // attach to Chess instance so buildBoardMessage can read it
        chess._takebackState = null;
        activeGames.set(playerWhite, gameSession);
        if (type === 'PvP') {
            activeGames.set(playerBlack, gameSession); // Same session reference for both
        }

        let messageText = `Zorluk seviyesi: ${difficulty}\nSen Beyaz'sın. İlk hamleyi sen yap.`;
        if (type === 'PvP') {
            messageText = `**PvP Modu Başladı!**\n<@${playerWhite}> (Beyaz) vs <@${playerBlack}> (Siyah)\n\nSıra Beyaz'da, ilk hamleyi yap!`;
        }
        gameSession.lastMessageText = messageText;

        const msgData = await buildBoardMessage(chess, playerWhite, messageText, evalData, showEvoBar);
        msgData.fetchReply = true;
        const reply = await interaction.editReply(msgData);
        if (activeGames.has(playerWhite)) {
            activeGames.get(playerWhite).message = reply;
        }
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split('_');
        const ownerId = parts[parts.length - 1]; // ownerId is always playerWhite

        const gameSession = activeGames.get(ownerId);
        if (!gameSession) {
            return interaction.reply({ content: 'Devam eden bir oyununuz bulunamadı. (Oyun silinmiş olabilir)', flags: 64 });
        }

        const userId = interaction.user.id;
        const isPlayer1 = userId === gameSession.playerWhite;
        const isPlayer2 = userId === gameSession.playerBlack;

        if (!isPlayer1 && !isPlayer2) {
            return interaction.reply({ content: 'Bu oyunun bir parçası değilsiniz!', flags: 64 });
        }

        if (interaction.customId.startsWith('chess_history_btn')) {
            const pgn = gameSession.chess.pgn();
            return interaction.reply({ content: pgn ? `**Oyun Ge\u00e7mi\u015fi (PGN):**\n\`\`\`\n${pgn}\n\`\`\`` : 'Hen\u00fcz hamle yap\u0131lmad\u0131.', flags: 64 });
        }

        let isDeferred = false;
        if (gameSession.isThinking) {
            const needsQueue = interaction.customId.startsWith('chess_resign_btn') ||
                interaction.customId.startsWith('chess_draw_btn') ||
                interaction.customId.startsWith('chess_resign_confirm_') ||
                interaction.customId.startsWith('chess_draw_confirm_') ||
                interaction.customId.startsWith('chess_draw_accept_') ||
                interaction.customId.startsWith('chess_takeback_accept_') ||
                interaction.customId.startsWith('chess_takeback_request_');

            if (needsQueue) {
                if (interaction.customId.startsWith('chess_resign_btn') || interaction.customId.startsWith('chess_draw_btn')) {
                    await interaction.deferReply({ flags: 64 });
                } else {
                    await interaction.deferUpdate();
                }
                isDeferred = true;

                let waitTime = 0;
                while (gameSession.isThinking && waitTime < 10000) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    waitTime += 500;
                }
            } else if (interaction.customId.startsWith('chess_move_btn')) {
                return interaction.reply({ content: '\u015eu anda hamle analiz ediliyor, l\u00fctfen analizin bitmesini bekleyin.', flags: 64 });
            }
        }

        const ackUpdate = async (payload) => {
            if (isDeferred) return interaction.editReply(payload);
            return interaction.update(payload);
        };

        const ackReply = async (payload) => {
            if (isDeferred) return interaction.editReply(payload);
            return interaction.reply(payload);
        };

        if (interaction.customId.startsWith('chess_resign_btn')) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`chess_resign_confirm_${ownerId}`).setLabel('Evet, Eminim').setStyle(ButtonStyle.Danger)
            );
            return ackReply({ content: 'Ger\u00e7ekten pes etmek istedi\u011fine emin misin?', components: [row], flags: 64 });
        }

        if (interaction.customId.startsWith('chess_draw_btn')) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`chess_draw_confirm_${ownerId}`).setLabel('Evet, Eminim').setStyle(ButtonStyle.Success)
            );
            return ackReply({ content: 'Rakibe beraberlik teklif etmek istedi\u011fine emin misin?', components: [row], flags: 64 });
        }

        if (interaction.customId.startsWith('chess_resign_confirm_')) {
            activeGames.delete(gameSession.playerWhite);
            if (gameSession.type === 'PvP') activeGames.delete(gameSession.playerBlack);

            const isWhiteResigned = isPlayer1;
            const winnerId = isWhiteResigned ? gameSession.playerBlack : gameSession.playerWhite;
            const loserId = isWhiteResigned ? gameSession.playerWhite : gameSession.playerBlack;

            const resignMsg = gameSession.type === 'PvP' ? `<@${loserId}> pes etti! <@${winnerId}> kazandı!` : 'Oyundan çekildiniz. Stockfish kazandı.';
            const resultScore = isWhiteResigned ? '0-1' : '1-0';

            const msgData = await buildBoardMessage(gameSession.chess, ownerId, resignMsg, gameSession.evalData, gameSession.showEvoBar, gameSession.lastMoveBadge, gameSession.lastTargetSquare, resultScore, gameSession.lastSourceSquare);
            await ackUpdate({ content: 'Pes ettin.', components: [] });
            if (gameSession.message) {
                return gameSession.message.edit(msgData);
            }
            return interaction.channel.send(msgData);
        }

        if (interaction.customId.startsWith('chess_draw_confirm_')) {
            if (gameSession.type === 'PvP') {
                const opponentId = isPlayer1 ? gameSession.playerBlack : gameSession.playerWhite;
                gameSession.drawOfferedTo = opponentId;
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`chess_draw_accept_${ownerId}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`chess_draw_reject_${ownerId}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
                );
                await ackUpdate({ content: 'Beraberlik teklifi g\u00f6nderildi.', components: [] });
                return interaction.channel.send({ content: `<@${opponentId}>, rakibin beraberlik teklif etti!`, components: [row] });
            } else {
                activeGames.delete(gameSession.playerWhite);
                const drawMsg = `<@${userId}> oyunu berabere bitirdi! Oyun Bitti.`;
                const msgData = await buildBoardMessage(gameSession.chess, ownerId, drawMsg, gameSession.evalData, gameSession.showEvoBar, gameSession.lastMoveBadge, gameSession.lastTargetSquare, "1/2", gameSession.lastSourceSquare);
                await ackUpdate({ content: 'Berabere bitirdin.', components: [] });
                if (gameSession.message) {
                    return gameSession.message.edit(msgData);
                }
                return interaction.channel.send(msgData);
            }
        }

        if (interaction.customId.startsWith('chess_draw_accept_')) {
            if (interaction.user.id !== gameSession.drawOfferedTo) {
                return interaction.reply({ content: 'Bu beraberlik teklifi size yapılmadı veya kendi teklifinize işlem yapamazsınız!', flags: 64 });
            }
            activeGames.delete(gameSession.playerWhite);
            if (gameSession.type === 'PvP') activeGames.delete(gameSession.playerBlack);

            const drawMsg = `Oyuncular beraberlikte anla\u015ft\u0131! Oyun Bitti.`;
            const msgData = await buildBoardMessage(gameSession.chess, ownerId, drawMsg, gameSession.evalData, gameSession.showEvoBar, gameSession.lastMoveBadge, gameSession.lastTargetSquare, "1/2", gameSession.lastSourceSquare);

            // Teklif mesaj\u0131n\u0131 temizle
            if (!isDeferred) {
                await interaction.message.delete().catch(() => { });
            }

            if (gameSession.message) {
                return gameSession.message.edit(msgData);
            }
            return interaction.channel.send(msgData);
        }

        if (interaction.customId.startsWith('chess_draw_reject_')) {
            if (interaction.user.id !== gameSession.drawOfferedTo) {
                return interaction.reply({ content: 'Bu beraberlik teklifi size yap\u0131lmad\u0131 veya kendi teklifinize i\u015flem yapamazs\u0131n\u0131z!', flags: 64 });
            }
            // Draw reject is instant, no need to wait for isThinking generally, but if it is waiting, use ackUpdate
            return ackUpdate({ content: 'Beraberlik teklifi reddedildi.', components: [] });
        }

        if (interaction.customId.startsWith('chess_takeback_request_')) {
            const playerColor = userId === gameSession.playerWhite ? 'w' : 'b';
            const queue = gameSession.premoves?.[playerColor];
            if (queue && queue.length > 0) {
                const removedPremove = queue.pop();
                const warningMsg = `Kuyruktaki son premove iptal edildi: **${removedPremove}**`;
                if (isDeferred) {
                    await interaction.followUp({ content: warningMsg, flags: 64 });
                } else {
                    await interaction.reply({ content: warningMsg, flags: 64 });
                }
                return;
            }

            if (gameSession.chess.history().length === 0) {
                return interaction.reply({ content: 'Geri alınacak hamle yok!', flags: 64 });
            }

            if (gameSession.type === 'PvE') {
                // PvE modunda doğrudan 2 hamle (oyuncu + stockfish) geri alınır
                gameSession.chess.undo();
                if (gameSession.chess.history().length > 0) {
                    gameSession.chess.undo();
                }

                gameSession.outOfBook = false;
                await ackUpdate({ content: 'Geri alınıyor...', components: [] }).catch(() => { });

                if (!gameSession.moveHistoryData) gameSession.moveHistoryData = [];
                if (gameSession.moveHistoryData.length > 0) {
                    gameSession.moveHistoryData.pop(); // Pop Stockfish's move
                }
                if (gameSession.moveHistoryData.length > 0) {
                    gameSession.moveHistoryData.pop(); // Pop User's move
                }

                if (gameSession.moveHistoryData.length > 0) {
                    const prevMove = gameSession.moveHistoryData[gameSession.moveHistoryData.length - 1];
                    gameSession.lastMoveBadge = prevMove.badge;
                    gameSession.lastTargetSquare = prevMove.targetSquare;
                    gameSession.lastSourceSquare = prevMove.sourceSquare;
                    gameSession.evalData = { ...prevMove.evalData };
                } else {
                    gameSession.lastMoveBadge = "";
                    gameSession.lastTargetSquare = "";
                    gameSession.lastSourceSquare = "";
                    gameSession.evalData = { evaluation: 0.0, mate: null };
                }

                const messageText = `2 hamle geri alındı. Sıra sende.`;
                gameSession.lastMessageText = messageText;
                const msgData = await buildBoardMessage(gameSession.chess, ownerId, messageText, gameSession.evalData, gameSession.showEvoBar, gameSession.lastMoveBadge, gameSession.lastTargetSquare, null, gameSession.lastSourceSquare);
                if (gameSession.message) return gameSession.message.edit(msgData);
                return interaction.channel.send(msgData);
            }

            // PvP i\u00e7in: Sadece son hamleyi oynayan ki\u015fi talep edebilir
            const lastMovedColor = gameSession.chess.turn() === 'w' ? 'b' : 'w'; // Turn flipped after move
            const lastMovedId = lastMovedColor === 'w' ? gameSession.playerWhite : gameSession.playerBlack;
            if (interaction.user.id !== lastMovedId) {
                return interaction.reply({ content: 'Sadece son hamleyi oynayan ki\u015fi geri alma talebinde bulunabilir!', flags: 64 });
            }

            if (gameSession.chess._takebackState === 'pending') {
                return interaction.reply({ content: 'Zaten bekleyen bir geri alma talebi var!', flags: 64 });
            }

            gameSession.chess._takebackState = 'pending';
            gameSession.chess._takebackRequestedBy = interaction.user.id;
            const opponentId = interaction.user.id === gameSession.playerWhite ? gameSession.playerBlack : gameSession.playerWhite;

            const pendingMsgText = `<@${interaction.user.id}> son hamlesini geri almak istiyor... <@${opponentId}> kabul etmek i\u00e7in "Geri Alma Bekleniyor" butonuna bas.`;
            gameSession.lastMessageText = pendingMsgText;
            // Board mesajını güncelle - rakip doğrudan tahta butonuna tıklarak kabul eder
            const pendingMsgData = await buildBoardMessage(gameSession.chess, ownerId, pendingMsgText, gameSession.evalData, gameSession.showEvoBar);
            return ackUpdate(pendingMsgData).catch(() => { });
        }

        if (interaction.customId.startsWith('chess_takeback_accept_')) {
            if (gameSession.chess._takebackState !== 'pending') {
                return interaction.reply({ content: 'Bekleyen bir geri alma talebi yok.', flags: 64 });
            }
            const requesterId = gameSession.chess._takebackRequestedBy;
            if (interaction.user.id === requesterId) {
                return interaction.reply({ content: 'Kendi talebinizi kendiniz kabul edemezsiniz!', flags: 64 });
            }

            // PvP: 1 hamle geri al
            gameSession.chess.undo();
            gameSession.chess._takebackState = null;
            gameSession.chess._takebackRequestedBy = null;

            if (gameSession.moveHistoryData.length > 0) {
                gameSession.moveHistoryData.pop(); // Pop the undone move
            }

            if (gameSession.moveHistoryData.length > 0) {
                const prevMove = gameSession.moveHistoryData[gameSession.moveHistoryData.length - 1];
                gameSession.lastMoveBadge = prevMove.badge;
                gameSession.lastTargetSquare = prevMove.targetSquare;
                gameSession.lastSourceSquare = prevMove.sourceSquare;
                gameSession.evalData = { ...prevMove.evalData };
            } else {
                gameSession.lastMoveBadge = "";
                gameSession.lastTargetSquare = "";
                gameSession.lastSourceSquare = "";
                gameSession.evalData = { evaluation: 0.0, mate: null };
            }

            const currentTurnId = gameSession.chess.turn() === 'w' ? gameSession.playerWhite : gameSession.playerBlack;
            const acceptMsgText = `Geri alma kabul edildi! Sıra <@${currentTurnId}>.`;
            gameSession.lastMessageText = acceptMsgText;
            const msgData = await buildBoardMessage(gameSession.chess, ownerId, acceptMsgText, gameSession.evalData, gameSession.showEvoBar, gameSession.lastMoveBadge, gameSession.lastTargetSquare, null, gameSession.lastSourceSquare);

            return ackUpdate(msgData).catch(() => { });
        }

        if (interaction.customId.startsWith('chess_takeback_reject_')) {
            if (!gameSession.chess._takebackState) {
                return interaction.reply({ content: 'Bekleyen bir geri alma talebi yok.', flags: 64 });
            }
            if (interaction.user.id === gameSession.chess._takebackRequestedBy) {
                // Teklif sahibi iptal ediyor
                gameSession.chess._takebackState = null;
                gameSession.chess._takebackRequestedBy = null;
                const currentTurnId = gameSession.chess.turn() === 'w' ? gameSession.playerWhite : gameSession.playerBlack;
                const cancelMsgText = `Geri alma iptal edildi. S\u0131ra <@${currentTurnId}>.`;
                gameSession.lastMessageText = cancelMsgText;
                const msgData = await buildBoardMessage(gameSession.chess, ownerId, cancelMsgText, gameSession.evalData, gameSession.showEvoBar);
                await ackUpdate({ content: 'Geri alma iptal edildi', components: [] }).catch(() => { });
                if (gameSession.message) return gameSession.message.edit(msgData);
                return interaction.channel.send(msgData);
            }
            // Rakip reddetti - de asl\u0131nda "Geri Al" butonundan d\u00fc\u015f\u00fcyor - normal board g\u00f6ster
            gameSession.chess._takebackState = null;
            gameSession.chess._takebackRequestedBy = null;
            const currentTurnId2 = gameSession.chess.turn() === 'w' ? gameSession.playerWhite : gameSession.playerBlack;
            const rejectMsgText = `Geri alma reddedildi. S\u0131ra <@${currentTurnId2}>.`;
            gameSession.lastMessageText = rejectMsgText;
            const msgData2 = await buildBoardMessage(gameSession.chess, ownerId, rejectMsgText, gameSession.evalData, gameSession.showEvoBar);
            await ackUpdate({ content: 'Geri alma reddedildi', components: [] }).catch(() => { });
            if (gameSession.message) return gameSession.message.edit(msgData2);
            return interaction.channel.send(msgData2);
        }

        if (interaction.customId.startsWith('chess_move_btn')) {
            if (userId !== gameSession.playerWhite && userId !== gameSession.playerBlack) {
                return interaction.reply({ content: 'Bu oyunun bir parçası değilsiniz!', flags: 64 });
            }

            const modal = new ModalBuilder()
                .setCustomId(`chess_move_modal_${ownerId}`)
                .setTitle('Hamle Yap');

            const moveInput = new TextInputBuilder()
                .setCustomId('move_input')
                .setLabel('Hamlenizi yazın (örn: e4, Nf3, O-O)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e4')
                .setRequired(true)
                .setMinLength(2);

            const row = new ActionRowBuilder().addComponents(moveInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }
    },

    async handleModal(interaction) {
        const parts = interaction.customId.split('_');
        const ownerId = parts[parts.length - 1];

        const gameSession = activeGames.get(ownerId);
        if (!gameSession) {
            return interaction.reply({ content: 'Devam eden bir oyununuz yok.', flags: 64 });
        }

        const userId = interaction.user.id;
        const isPlayerWhite = userId === gameSession.playerWhite;
        const isPlayerBlack = userId === gameSession.playerBlack;

        if (!isPlayerWhite && !isPlayerBlack) {
            return interaction.reply({ content: 'Bu oyunun bir parçası değilsiniz!', flags: 64 });
        }

        // Eğer bekleyen bir geri alma talebi varsa otomatik olarak iptal et
        if (gameSession.chess._takebackState === 'pending') {
            gameSession.chess._takebackState = null;
            gameSession.chess._takebackRequestedBy = null;
        }

        const moveInput = interaction.fields.getTextInputValue('move_input').trim();
        const moves = moveInput.split(/\s+/).filter(Boolean);
        if (moves.length === 0) {
            return interaction.reply({ content: 'Lütfen geçerli bir hamle girin.', flags: 64 });
        }

        const playerColor = isPlayerWhite ? 'w' : 'b';

        if (!gameSession.premoves) {
            gameSession.premoves = { w: [], b: [] };
        }

        // Add moves to the queue
        gameSession.premoves[playerColor].push(...moves);

        const currentTurnColor = gameSession.chess.turn(); // 'w' or 'b'
        const isPlayerTurn = (currentTurnColor === 'w' && isPlayerWhite) || (currentTurnColor === 'b' && isPlayerBlack);

        if (isPlayerTurn && !gameSession.isThinking) {
            const nextMove = gameSession.premoves[playerColor].shift();
            // Process the move immediately. processMove handles deferring/updating interaction.
            await processMove(gameSession, nextMove, playerColor, interaction);
        } else {
            const queueMsg = `Hamleler sıraya (premove) eklendi: ${moves.map(m => `**${m}**`).join(', ')}`;
            return interaction.reply({ content: queueMsg, flags: 64 });
        }
    }
}
    ;
