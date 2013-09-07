var g_startOffset = null;
var g_selectedPiece = null;
var moveNumber = 1;
var suggestMoves = new Array();

var g_changingFen = false;
var g_analyzing = false;

var g_uiBoard;
var g_cellSize = 45;

var g_debug = true;
var g_timeout = 40;

// 
// Board code
//

// This somewhat funky scheme means that a piece is indexed by it's lower 4 bits when accessing in arrays.  The fifth bit (black bit)
// is used to allow quick edge testing on the board.
var colorBlack = 0x10;
var colorWhite = 0x08;

var pieceEmpty = 0x00;
var piecePawn = 0x01;
var pieceKnight = 0x02;
var pieceBishop = 0x03;
var pieceRook = 0x04;
var pieceQueen = 0x05;
var pieceKing = 0x06;

var g_vectorDelta = new Array(256);

var g_bishopDeltas = [-15, -17, 15, 17];
var g_knightDeltas = [31, 33, 14, -14, -31, -33, 18, -18];
var g_rookDeltas = [-1, +1, -16, +16];
var g_queenDeltas = [-1, +1, -15, +15, -17, +17, -16, +16];

var g_castleRightsMask = [
0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
0, 0, 0, 0, 7,15,15,15, 3,15,15,11, 0, 0, 0, 0,
0, 0, 0, 0,15,15,15,15,15,15,15,15, 0, 0, 0, 0,
0, 0, 0, 0,15,15,15,15,15,15,15,15, 0, 0, 0, 0,
0, 0, 0, 0,15,15,15,15,15,15,15,15, 0, 0, 0, 0,
0, 0, 0, 0,15,15,15,15,15,15,15,15, 0, 0, 0, 0,
0, 0, 0, 0,15,15,15,15,15,15,15,15, 0, 0, 0, 0,
0, 0, 0, 0,15,15,15,15,15,15,15,15, 0, 0, 0, 0,
0, 0, 0, 0,13,15,15,15,12,15,15,14, 0, 0, 0, 0,
0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

var moveflagEPC = 0x2 << 16;
var moveflagCastleKing = 0x4 << 16;
var moveflagCastleQueen = 0x8 << 16;
var moveflagPromotion = 0x10 << 16;
var moveflagPromoteKnight = 0x20 << 16;
var moveflagPromoteQueen = 0x40 << 16;
var moveflagPromoteBishop = 0x80 << 16;

//
// Searching code
//

var g_startTime;

var g_nodeCount;
var g_qNodeCount;
var g_searchValid;
var g_globalPly = 0;

var minEval = -2000000;
var maxEval = +2000000;

var minMateBuffer = minEval + 2000;
var maxMateBuffer = maxEval - 2000;

var materialTable = [0, 800, 3350, 3450, 5000, 9750, 600000];

var pawnAdj =
[
  0, 0, 0, 0, 0, 0, 0, 0,
  -25, 105, 135, 270, 270, 135, 105, -25,
  -80, 0, 30, 176, 176, 30, 0, -80,
  -85, -5, 25, 175, 175, 25, -5, -85,
  -90, -10, 20, 125, 125, 20, -10, -90,
  -95, -15, 15, 75, 75, 15, -15, -95, 
  -100, -20, 10, 70, 70, 10, -20, -100, 
  0, 0, 0, 0, 0, 0, 0, 0
];

var knightAdj =
    [-200, -100, -50, -50, -50, -50, -100, -200,
      -100, 0, 0, 0, 0, 0, 0, -100,
      -50, 0, 60, 60, 60, 60, 0, -50,
      -50, 0, 30, 60, 60, 30, 0, -50,
      -50, 0, 30, 60, 60, 30, 0, -50,
      -50, 0, 30, 30, 30, 30, 0, -50,
      -100, 0, 0, 0, 0, 0, 0, -100,
      -200, -50, -25, -25, -25, -25, -50, -200
     ];

var bishopAdj =
    [ -50,-50,-25,-10,-10,-25,-50,-50,
      -50,-25,-10,  0,  0,-10,-25,-50,
      -25,-10,  0, 25, 25,  0,-10,-25,
      -10,  0, 25, 40, 40, 25,  0,-10,
      -10,  0, 25, 40, 40, 25,  0,-10,
      -25,-10,  0, 25, 25,  0,-10,-25,
      -50,-25,-10,  0,  0,-10,-25,-50,
      -50,-50,-25,-10,-10,-25,-50,-50
     ];

var rookAdj =
    [ -60, -30, -10, 20, 20, -10, -30, -60,
       40,  70,  90,120,120,  90,  70,  40,
      -60, -30, -10, 20, 20, -10, -30, -60,
      -60, -30, -10, 20, 20, -10, -30, -60,
      -60, -30, -10, 20, 20, -10, -30, -60,
      -60, -30, -10, 20, 20, -10, -30, -60,
      -60, -30, -10, 20, 20, -10, -30, -60,
      -60, -30, -10, 20, 20, -10, -30, -60
     ];

var kingAdj =
    [  50, 150, -25, -125, -125, -25, 150, 50,
       50, 150, -25, -125, -125, -25, 150, 50,
       50, 150, -25, -125, -125, -25, 150, 50,
       50, 150, -25, -125, -125, -25, 150, 50,
       50, 150, -25, -125, -125, -25, 150, 50,
       50, 150, -25, -125, -125, -25, 150, 50,
       50, 150, -25, -125, -125, -25, 150, 50,
      150, 250,  75,  -25,  -25,  75, 250, 150
     ];

var emptyAdj =
    [0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
        0, 0, 0, 0, 0, 0, 0, 0, 
     ];

var pieceSquareAdj = new Array(8);

// Returns the square flipped
var flipTable = new Array(256);

// Position variables
var g_board = new Array(256); // Sentinel 0x80, pieces are in low 4 bits, 0x8 for color, 0x7 bits for piece type
var g_toMove; // side to move, 0 or 8, 0 = black, 8 = white
var g_castleRights; // bitmask representing castling rights, 1 = wk, 2 = wq, 4 = bk, 8 = bq
var g_enPassentSquare;
var g_baseEval;
var g_hashKeyLow, g_hashKeyHigh;
var g_inCheck;

// Utility variables
var g_moveCount = 0;
var g_moveUndoStack = new Array();

var g_move50 = 0;
var g_repMoveStack = new Array();

var g_hashSize = 1 << 22;
var g_hashMask = g_hashSize - 1;
var g_hashTable;

var g_killers;
var historyTable = new Array(32);

var g_zobristLow;
var g_zobristHigh;
var g_zobristBlackLow;
var g_zobristBlackHigh;

// Evaulation variables
var g_mobUnit;

var hashflagAlpha = 1;
var hashflagBeta = 2;
var hashflagExact = 3;

var g_pieceIndex = new Array(256);
var g_pieceList = new Array(2 * 8 * 16);
var g_pieceCount = new Array(2 * 8);

var g_seeValues = [0, 1, 3, 3, 5, 9, 900, 0,
                    0, 1, 3, 3, 5, 9, 900, 0];

function ResetGame() {
    g_killers = new Array(128);
    for (var i = 0; i < 128; i++) {
        g_killers[i] = [0, 0];
    }

    g_hashTable = new Array(g_hashSize);

    for (var i = 0; i < 32; i++) {
        historyTable[i] = new Array(256);
        for (var j = 0; j < 256; j++)
            historyTable[i][j] = 0;
    }

    var mt = new MT(0x1badf00d);

    g_zobristLow = new Array(256);
    g_zobristHigh = new Array(256);
    for (var i = 0; i < 256; i++) {
        g_zobristLow[i] = new Array(16);
        g_zobristHigh[i] = new Array(16);
        for (var j = 0; j < 16; j++) {
            g_zobristLow[i][j] = mt.next(32);
            g_zobristHigh[i][j] = mt.next(32);
        }
    }
    g_zobristBlackLow = mt.next(32);
    g_zobristBlackHigh = mt.next(32);

    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            var square = MakeSquare(row, col);
            flipTable[square] = MakeSquare(7 - row, col);
        }
    }

    pieceSquareAdj[piecePawn] = MakeTable(pawnAdj);
    pieceSquareAdj[pieceKnight] = MakeTable(knightAdj);
    pieceSquareAdj[pieceBishop] = MakeTable(bishopAdj);
    pieceSquareAdj[pieceRook] = MakeTable(rookAdj);
    pieceSquareAdj[pieceQueen] = MakeTable(emptyAdj);
    pieceSquareAdj[pieceKing] = MakeTable(kingAdj);

    var pieceDeltas = [[], [], g_knightDeltas, g_bishopDeltas, g_rookDeltas, g_queenDeltas, g_queenDeltas];

    for (var i = 0; i < 256; i++) {
        g_vectorDelta[i] = new Object();
        g_vectorDelta[i].delta = 0;
        g_vectorDelta[i].pieceMask = new Array(2);
        g_vectorDelta[i].pieceMask[0] = 0;
        g_vectorDelta[i].pieceMask[1] = 0;
    }
    
    // Initialize the vector delta table    
    for (var row = 0; row < 0x80; row += 0x10) { 
        for (var col = 0; col < 0x8; col++) {
            var square = row | col;
            
            // Pawn moves
            var index = square - (square - 17) + 128;
            g_vectorDelta[index].pieceMask[colorWhite >> 3] |= (1 << piecePawn);
            index = square - (square - 15) + 128;
            g_vectorDelta[index].pieceMask[colorWhite >> 3] |= (1 << piecePawn);
            
            index = square - (square + 17) + 128;
            g_vectorDelta[index].pieceMask[0] |= (1 << piecePawn);
            index = square - (square + 15) + 128;
            g_vectorDelta[index].pieceMask[0] |= (1 << piecePawn);
            
            for (var i = pieceKnight; i <= pieceKing; i++) {
                for (var dir = 0; dir < pieceDeltas[i].length; dir++) {
                    var target = square + pieceDeltas[i][dir];
                    while (!(target & 0x88)) {
                        index = square - target + 128;
                        
                        g_vectorDelta[index].pieceMask[colorWhite >> 3] |= (1 << i);
                        g_vectorDelta[index].pieceMask[0] |= (1 << i);
                        
                        var flip = -1;
                        if (square < target) 
                            flip = 1;
                        
                        if ((square & 0xF0) == (target & 0xF0)) {
                            // On the same row
                            g_vectorDelta[index].delta = flip * 1;
                        } else if ((square & 0x0F) == (target & 0x0F)) {
                            // On the same column
                            g_vectorDelta[index].delta = flip * 16;
                        } else if ((square % 15) == (target % 15)) {
                            g_vectorDelta[index].delta = flip * 15;
                        } else if ((square % 17) == (target % 17)) {
                            g_vectorDelta[index].delta = flip * 17;
                        }

                        if (i == pieceKnight) {
                            g_vectorDelta[index].delta = pieceDeltas[i][dir];
                            break;
                        }

                        if (i == pieceKing)
                            break;

                        target += pieceDeltas[i][dir];
                    }
                }
            }
        }
    }    

    InitializeEval();
//    InitializeFromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    InitializeFromFen(g_fen); 
}

function MT() {
 	var N = 624;
	var M = 397;
	var MAG01 = [0x0, 0x9908b0df];
    
    this.mt = new Array(N);
    this.mti = N + 1;

    this.setSeed = function()
	{
		var a = arguments;
		switch (a.length) {
		case 1:
			if (a[0].constructor === Number) {
				this.mt[0]= a[0];
				for (var i = 1; i < N; ++i) {
					var s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
					this.mt[i] = ((1812433253 * ((s & 0xffff0000) >>> 16))
							<< 16)
						+ 1812433253 * (s & 0x0000ffff)
						+ i;
				}
				this.mti = N;
				return;
			}

			this.setSeed(19650218);

			var l = a[0].length;
			var i = 1;
			var j = 0;

			for (var k = N > l ? N : l; k != 0; --k) {
				var s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30)
				this.mt[i] = (this.mt[i]
						^ (((1664525 * ((s & 0xffff0000) >>> 16)) << 16)
							+ 1664525 * (s & 0x0000ffff)))
					+ a[0][j]
					+ j;
				if (++i >= N) {
					this.mt[0] = this.mt[N - 1];
					i = 1;
				}
				if (++j >= l) {
					j = 0;
				}
			}

			for (var k = N - 1; k != 0; --k) {
				var s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
				this.mt[i] = (this.mt[i]
						^ (((1566083941 * ((s & 0xffff0000) >>> 16)) << 16)
							+ 1566083941 * (s & 0x0000ffff)))
					- i;
				if (++i >= N) {
					this.mt[0] = this.mt[N-1];
					i = 1;
				}
			}

			this.mt[0] = 0x80000000;
			return;
		default:
			var seeds = new Array();
			for (var i = 0; i < a.length; ++i) {
				seeds.push(a[i]);
			}
			this.setSeed(seeds);
			return;
		}
	}

    this.setSeed(0x1BADF00D);

    this.next = function (bits)
	{
		if (this.mti >= N) {
			var x = 0;

			for (var k = 0; k < N - M; ++k) {
				x = (this.mt[k] & 0x80000000) | (this.mt[k + 1] & 0x7fffffff);
				this.mt[k] = this.mt[k + M] ^ (x >>> 1) ^ MAG01[x & 0x1];
			}
			for (var k = N - M; k < N - 1; ++k) {
				x = (this.mt[k] & 0x80000000) | (this.mt[k + 1] & 0x7fffffff);
				this.mt[k] = this.mt[k + (M - N)] ^ (x >>> 1) ^ MAG01[x & 0x1];
			}
			x = (this.mt[N - 1] & 0x80000000) | (this.mt[0] & 0x7fffffff);
			this.mt[N - 1] = this.mt[M - 1] ^ (x >>> 1) ^ MAG01[x & 0x1];

			this.mti = 0;
		}

		var y = this.mt[this.mti++];
		y ^= y >>> 11;
		y ^= (y << 7) & 0x9d2c5680;
		y ^= (y << 15) & 0xefc60000;
		y ^= y >>> 18;
		return (y >>> (32 - bits)) & 0xFFFFFFFF;
	}
}

function MakeSquare(row, column) {
    return ((row + 2) << 4) | (column + 4);
}

function MakeTable(table) {
    var result = new Array(256);
    for (var i = 0; i < 256; i++) {
        result[i] = 0;
    }
    for (var row = 0; row < 8; row++) {
        for (var col = 0; col < 8; col++) {
            result[MakeSquare(row, col)] = table[row * 8 + col];
        }
    }
    return result;
}

//Инициализация оценки позиции
function InitializeEval() {
    g_mobUnit = new Array(2);
    // Единицы подвижности фигур
    for (var i = 0; i < 2; i++) {
        g_mobUnit[i] = new Array();
        var enemy = i == 0 ? 0x10 : 8; // Цвет фигур противника
        var friend = i == 0 ? 8 : 0x10; // Цвет своих фигур
        g_mobUnit[i][0] = 1;
        g_mobUnit[i][0x80] = 0;
        g_mobUnit[i][enemy | piecePawn] = 1;
        g_mobUnit[i][enemy | pieceBishop] = 2;
        g_mobUnit[i][enemy | pieceKnight] = 2;
        g_mobUnit[i][enemy | pieceRook] = 4;
        g_mobUnit[i][enemy | pieceQueen] = 6;
        g_mobUnit[i][enemy | pieceKing] = 6;
        g_mobUnit[i][friend | piecePawn] = 0;
        g_mobUnit[i][friend | pieceBishop] = 0;
        g_mobUnit[i][friend | pieceKnight] = 0;
        g_mobUnit[i][friend | pieceRook] = 0;
        g_mobUnit[i][friend | pieceQueen] = 0;
        g_mobUnit[i][friend | pieceKing] = 0;
    }
}

function InitializeFromFen(fen) {
    //Разделение fen на отдельные части (символ-разделитель: пробел)
    var chunks = fen.split(' ');
    
    for (var i = 0; i < 256; i++) 
        g_board[i] = 0x80;
    
    var row = 0;
    var col = 0;
    
    var pieces = chunks[0];
    for (var i = 0; i < pieces.length; i++) {
        var c = pieces.charAt(i);
        
        if (c == '/') {
            row++;
            col = 0;
        }
        else {
            if (c >= '0' && c <= '9') {
                for (var j = 0; j < parseInt(c); j++) {
                    g_board[MakeSquare(row, col)] = 0;
                    col++;
                }
            }
            else {
                var isBlack = c >= 'a' && c <= 'z';
                var piece = isBlack ? colorBlack : colorWhite;
                if (!isBlack) 
                    c = pieces.toLowerCase().charAt(i);
                switch (c) {
                    case 'p':
                        piece |= piecePawn;
                        break;
                    case 'b':
                        piece |= pieceBishop;
                        break;
                    case 'n':
                        piece |= pieceKnight;
                        break;
                    case 'r':
                        piece |= pieceRook;
                        break;
                    case 'q':
                        piece |= pieceQueen;
                        break;
                    case 'k':
                        piece |= pieceKing;
                        break;
                }
                
                g_board[MakeSquare(row, col)] = piece;
                col++;
            }
        }
    }
   
    InitializePieceList();
    
    g_toMove = chunks[1].charAt(0) == 'w' ? colorWhite : 0;
    var them = 8 - g_toMove;
    
    g_castleRights = 0;
    if (chunks[2].indexOf('K') != -1) { 
        if (g_board[MakeSquare(7, 4)] != (pieceKing | colorWhite) ||
            g_board[MakeSquare(7, 7)] != (pieceRook | colorWhite)) {
            return 'Invalid FEN: White kingside castling not allowed';
        }
        g_castleRights |= 1;
    }
    if (chunks[2].indexOf('Q') != -1) {
        if (g_board[MakeSquare(7, 4)] != (pieceKing | colorWhite) ||
            g_board[MakeSquare(7, 0)] != (pieceRook | colorWhite)) {
            return 'Invalid FEN: White queenside castling not allowed';
        }
        g_castleRights |= 2;
    }
    if (chunks[2].indexOf('k') != -1) {
        if (g_board[MakeSquare(0, 4)] != (pieceKing | colorBlack) ||
            g_board[MakeSquare(0, 7)] != (pieceRook | colorBlack)) {
            return 'Invalid FEN: Black kingside castling not allowed';
        }
        g_castleRights |= 4;
    }
    if (chunks[2].indexOf('q') != -1) {
        if (g_board[MakeSquare(0, 4)] != (pieceKing | colorBlack) ||
            g_board[MakeSquare(0, 0)] != (pieceRook | colorBlack)) {
            return 'Invalid FEN: Black queenside castling not allowed';
        }
        g_castleRights |= 8;
    }
   
    g_enPassentSquare = -1;
    if (chunks[3].indexOf('-') == -1) {
	var col = chunks[3].charAt(0).charCodeAt() - 'a'.charCodeAt();
	var row = 8 - (chunks[3].charAt(1).charCodeAt() - '0'.charCodeAt());
	g_enPassentSquare = MakeSquare(row, col);
    }
  
    var hashResult = SetHash();
    g_hashKeyLow = hashResult.hashKeyLow;
    g_hashKeyHigh = hashResult.hashKeyHigh;

    g_baseEval = 0;
    for (var i = 0; i < 256; i++) {
        if (g_board[i] & colorWhite) {
            g_baseEval += pieceSquareAdj[g_board[i] & 0x7][i];
            g_baseEval += materialTable[g_board[i] & 0x7];
        } else if (g_board[i] & colorBlack) {
            g_baseEval -= pieceSquareAdj[g_board[i] & 0x7][flipTable[i]];
            g_baseEval -= materialTable[g_board[i] & 0x7];
        }
    }
    if (!g_toMove) g_baseEval = -g_baseEval;

    g_move50 = 0;
    g_inCheck = IsSquareAttackable(g_pieceList[(g_toMove | pieceKing) << 4], them);

    // Check for king capture (invalid FEN)
    if (IsSquareAttackable(g_pieceList[(them | pieceKing) << 4], g_toMove)) {
        return 'Invalid FEN: Can capture king';
    }
    // Checkmate/stalemate
    if (GenerateValidMoves().length == 0) {
        return g_inCheck ? 'Checkmate' : 'Stalemate';
    } 
 
    return '';
}

function InitializePieceList() {
    for (var i = 0; i < 16; i++) {
        g_pieceCount[i] = 0;
        for (var j = 0; j < 16; j++) {
            // 0 is used as the terminator for piece lists
            g_pieceList[(i << 4) | j] = 0;
        }
    }

    for (var i = 0; i < 256; i++) {
        g_pieceIndex[i] = 0;
        if (g_board[i] & (colorWhite | colorBlack)) {
			var piece = g_board[i] & 0xF;

			g_pieceList[(piece << 4) | g_pieceCount[piece]] = i;
			g_pieceIndex[i] = g_pieceCount[piece];
			g_pieceCount[piece]++;
        }
    }
}

function SetHash() {
    var result = new Object();
    result.hashKeyLow = 0;
    result.hashKeyHigh = 0;

    for (var i = 0; i < 256; i++) {
        var piece = g_board[i];
        if (piece & 0x18) {
            result.hashKeyLow ^= g_zobristLow[i][piece & 0xF]
            result.hashKeyHigh ^= g_zobristHigh[i][piece & 0xF]
        }
    }

    if (!g_toMove) {
        result.hashKeyLow ^= g_zobristBlackLow;
        result.hashKeyHigh ^= g_zobristBlackHigh;
    }

    return result;
}

function IsSquareAttackable(target, color) {
	// Attackable by pawns? (Нападение пешками?)
	var inc = color ? -16 : 16;
	var pawn = (color ? colorWhite : colorBlack) | 1;
	if (g_board[target - (inc - 1)] == pawn)
		return true;
	if (g_board[target - (inc + 1)] == pawn)
		return true;
	
	// Attackable by pieces? (Нападение фигурами?)
	for (var i = 2; i <= 6; i++) {
        var index = (color | i) << 4;
        var square = g_pieceList[index];
		while (square != 0) {
			if (IsSquareAttackableFrom(target, square))
				return true;
			square = g_pieceList[++index];
		}
    }
    return false;
}

function IsSquareAttackableFrom(target, from){
    var index = from - target + 128;
    var piece = g_board[from];
    if (g_vectorDelta[index].pieceMask[(piece >> 3) & 1] & (1 << (piece & 0x7))) {
        // Yes, this square is pseudo-attackable.  Now, check for real attack
        //(Да, это поле является псевдо-уязвимым. Теперь проверьте реальность атаки)
		var inc = g_vectorDelta[index].delta;
        do {
			from += inc;
			if (from == target)
				return true;
		} while (g_board[from] == 0);
    }
    
    return false;
}

function GenerateValidMoves() {
    var moveList = new Array();
    var allMoves = new Array();
    GenerateCaptureMoves(allMoves, null);
    GenerateAllMoves(allMoves);
   
    for (var i = allMoves.length - 1; i >= 0; i--) {
        if (MakeMove(allMoves[i])) {  
            moveList[moveList.length] = allMoves[i];
            UnmakeMove(allMoves[i]);
        }
    }
    
    return moveList;
}

function GenerateCaptureMoves(moveStack, moveScores) {
    var from, to, piece, pieceIdx;
    var inc = (g_toMove == 8) ? -16 : 16;
    var enemy = g_toMove == 8 ? 0x10 : 0x8;

    // Pawn captures (Взятия пешками)
    pieceIdx = (g_toMove | 1) << 4;
    from = g_pieceList[pieceIdx++];
    while (from != 0) {
        to = from + inc - 1;
        if (g_board[to] & enemy) {
            MovePawnTo(moveStack, from, to);
        }

        to = from + inc + 1;
        if (g_board[to] & enemy) {
            MovePawnTo(moveStack, from, to);
        }

        from = g_pieceList[pieceIdx++];
    }

    if (g_enPassentSquare != -1) {
        var inc = (g_toMove == colorWhite) ? -16 : 16;
        var pawn = g_toMove | piecePawn;

        var from = g_enPassentSquare - (inc + 1);
        if ((g_board[from] & 0xF) == pawn) {
            moveStack[moveStack.length] = GenerateMove(from, g_enPassentSquare, moveflagEPC);
        }

        from = g_enPassentSquare - (inc - 1);
        if ((g_board[from] & 0xF) == pawn) {
            moveStack[moveStack.length] = GenerateMove(from, g_enPassentSquare, moveflagEPC);
        }
    }

    // Knight captures (Взятия конями)
	pieceIdx = (g_toMove | 2) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from + 31; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 33; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 14; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 14; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 31; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 33; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 18; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 18; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		from = g_pieceList[pieceIdx++];
	}
	
	// Bishop captures (Взятия слонами)
	pieceIdx = (g_toMove | 3) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from; do { to -= 15; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to -= 17; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to += 15; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to += 17; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		from = g_pieceList[pieceIdx++];
	}
	
	// Rook captures (Взятия ладьями)
	pieceIdx = (g_toMove | 4) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from; do { to--; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to++; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to -= 16; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to += 16; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		from = g_pieceList[pieceIdx++];
	}
	
	// Queen captures (Взятия ферзем)
	pieceIdx = (g_toMove | 5) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from; do { to -= 15; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to -= 17; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to += 15; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to += 17; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to--; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to++; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to -= 16; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from; do { to += 16; } while (g_board[to] == 0); if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		from = g_pieceList[pieceIdx++];
	}
	
	// King captures (Взятия королем)
	{
		pieceIdx = (g_toMove | 6) << 4;
		from = g_pieceList[pieceIdx];
		to = from - 15; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 17; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 15; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 17; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 1; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 1; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 16; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 16; if (g_board[to] & enemy) moveStack[moveStack.length] = GenerateMove(from, to);
	}
}

function MovePawnTo(moveStack, start, square) {
	var row = square & 0xF0;
    if ((row == 0x90) || (row == 0x20)) {
        moveStack[moveStack.length] = GenerateMove(start, square, moveflagPromotion | moveflagPromoteQueen);
        moveStack[moveStack.length] = GenerateMove(start, square, moveflagPromotion | moveflagPromoteKnight);
        moveStack[moveStack.length] = GenerateMove(start, square, moveflagPromotion | moveflagPromoteBishop);
        moveStack[moveStack.length] = GenerateMove(start, square, moveflagPromotion);
    }
    else {
        moveStack[moveStack.length] = GenerateMove(start, square, 0);
    }
}

function GenerateMove(from, to) {
    return from | (to << 8);
}

function GenerateMove(from, to, flags){
    return from | (to << 8) | flags;
}

function GenerateAllMoves(moveStack) {
    var from, to, piece, pieceIdx;

	// Pawn quiet moves (тихие ходы пешкой)
    pieceIdx = (g_toMove | 1) << 4;
    from = g_pieceList[pieceIdx++];
    while (from != 0) {
        GeneratePawnMoves(moveStack, from);
        from = g_pieceList[pieceIdx++];
    }

    // Knight quiet moves (тихие ходы коня)
	pieceIdx = (g_toMove | 2) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from + 31; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from + 33; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from + 14; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from - 14; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from - 31; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from - 33; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from + 18; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		to = from - 18; if (g_board[to] == 0) {moveStack[moveStack.length] = GenerateMove(from, to);}
		from = g_pieceList[pieceIdx++];
	}

	// Bishop quiet moves (тихие ходы слона)
	pieceIdx = (g_toMove | 3) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from - 15; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to -= 15; }
		to = from - 17; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to -= 17; }
		to = from + 15; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to += 15; }
		to = from + 17; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to += 17; }
		from = g_pieceList[pieceIdx++];
	}

	// Rook quiet moves (тихие ходы ладьи)
	pieceIdx = (g_toMove | 4) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from - 1; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to--; }
		to = from + 1; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to++; }
		to = from + 16; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to += 16; }
		to = from - 16; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to -= 16; }
		from = g_pieceList[pieceIdx++];
	}
	
	// Queen quiet moves (тихие ходы ферзя)
	pieceIdx = (g_toMove | 5) << 4;
	from = g_pieceList[pieceIdx++];
	while (from != 0) {
		to = from - 15; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to -= 15; }
		to = from - 17; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to -= 17; }
		to = from + 15; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to += 15; }
		to = from + 17; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to += 17; }
		to = from - 1; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to--; }
		to = from + 1; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to++; }
		to = from + 16; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to += 16; }
		to = from - 16; while (g_board[to] == 0) { moveStack[moveStack.length] = GenerateMove(from, to); to -= 16; }
		from = g_pieceList[pieceIdx++];
	}
	
	// King quiet moves (тихие ходы короля)
	{
		pieceIdx = (g_toMove | 6) << 4;
		from = g_pieceList[pieceIdx];
		to = from - 15; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 17; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 15; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 17; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 1; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 1; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from - 16; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		to = from + 16; if (g_board[to] == 0) moveStack[moveStack.length] = GenerateMove(from, to);
		
        if (!g_inCheck) {
            var castleRights = g_castleRights;
            if (!g_toMove) 
                castleRights >>= 2;
            if (castleRights & 1) {
                // Kingside castle (Короткая рокировка)
                if (g_board[from + 1] == pieceEmpty && g_board[from + 2] == pieceEmpty) {
                    moveStack[moveStack.length] = GenerateMove(from, from + 0x02, moveflagCastleKing);
                }
            }
            if (castleRights & 2) {
                // Queenside castle (Длинная рокировка)
                if (g_board[from - 1] == pieceEmpty && g_board[from - 2] == pieceEmpty && g_board[from - 3] == pieceEmpty) {
                    moveStack[moveStack.length] = GenerateMove(from, from - 0x02, moveflagCastleQueen);
                }
            }
        }
	}
    for(var k=0;k<suggestMoves.length;k++){
        for(var i=0;i<moveStack.length;i++){
            if(moveStack[i]==suggestMoves[k]){
                for(var j=i;j<moveStack.length-1;j++){
                    moveStack[j]=moveStack[j+1];
                }
            break;
            } 
        }
        --moveStack.length;
    }
}

function GeneratePawnMoves(moveStack, from) {
    var piece = g_board[from];
    var color = piece & colorWhite;
    var inc = (color == colorWhite) ? -16 : 16;
    
	// Quiet pawn moves
	var to = from + inc;
	if (g_board[to] == 0) {
		MovePawnTo(moveStack, from, to, pieceEmpty);
		
		// Check if we can do a 2 square jump
		if ((((from & 0xF0) == 0x30) && color != colorWhite) ||
		    (((from & 0xF0) == 0x80) && color == colorWhite)) {
			to += inc;
			if (g_board[to] == 0) {
				moveStack[moveStack.length] = GenerateMove(from, to);
			}				
		}
	}
}

function MakeMove(move){
    var me = g_toMove >> 3;
	var otherColor = 8 - g_toMove; //Цвет фигур противника 
    
    var flags = move & 0xFF0000;
    var to = (move >> 8) & 0xFF;
    var from = move & 0xFF;
    var captured = g_board[to];
    var piece = g_board[from];
    var epcEnd = to;

    if (flags & moveflagEPC) {
        epcEnd = me ? (to + 0x10) : (to - 0x10);
        captured = g_board[epcEnd];
        g_board[epcEnd] = pieceEmpty;
    }

    g_moveUndoStack[g_moveCount] = new UndoHistory(g_enPassentSquare, g_castleRights, g_inCheck, g_baseEval, g_hashKeyLow, g_hashKeyHigh, g_move50, captured);
    g_moveCount++; //Увеличение на 1 счетчика ходов

    g_enPassentSquare = -1; //Бойного поля нет

    if (flags) {
        if (flags & moveflagCastleKing) { //Если короткая рокировка
            if (IsSquareAttackable(from + 1, otherColor) ||
            	IsSquareAttackable(from + 2, otherColor)) {
                g_moveCount--; //Уменьшение на 1 счетчика ходов
                return false;
            }
            
            var rook = g_board[to + 1];
            
            g_hashKeyLow ^= g_zobristLow[to + 1][rook & 0xF];
            g_hashKeyHigh ^= g_zobristHigh[to + 1][rook & 0xF];
            g_hashKeyLow ^= g_zobristLow[to - 1][rook & 0xF];
            g_hashKeyHigh ^= g_zobristHigh[to - 1][rook & 0xF];
            
            g_board[to - 1] = rook;
            g_board[to + 1] = pieceEmpty;
            
            g_baseEval -= pieceSquareAdj[rook & 0x7][me == 0 ? flipTable[to + 1] : (to + 1)];
            g_baseEval += pieceSquareAdj[rook & 0x7][me == 0 ? flipTable[to - 1] : (to - 1)];

            var rookIndex = g_pieceIndex[to + 1];
            g_pieceIndex[to - 1] = rookIndex;
            g_pieceList[((rook & 0xF) << 4) | rookIndex] = to - 1;
        } else if (flags & moveflagCastleQueen) {
            if (IsSquareAttackable(from - 1, otherColor) ||
            	IsSquareAttackable(from - 2, otherColor)) {
                g_moveCount--;
                return false;
            }
            
            var rook = g_board[to - 2];

            g_hashKeyLow ^= g_zobristLow[to -2][rook & 0xF];
            g_hashKeyHigh ^= g_zobristHigh[to - 2][rook & 0xF];
            g_hashKeyLow ^= g_zobristLow[to + 1][rook & 0xF];
            g_hashKeyHigh ^= g_zobristHigh[to + 1][rook & 0xF];
            
            g_board[to + 1] = rook;
            g_board[to - 2] = pieceEmpty;
            
            g_baseEval -= pieceSquareAdj[rook & 0x7][me == 0 ? flipTable[to - 2] : (to - 2)];
            g_baseEval += pieceSquareAdj[rook & 0x7][me == 0 ? flipTable[to + 1] : (to + 1)];

            var rookIndex = g_pieceIndex[to - 2];
            g_pieceIndex[to + 1] = rookIndex;
            g_pieceList[((rook & 0xF) << 4) | rookIndex] = to + 1;
        }
    }

    if (captured) { //Если ход со взятием фигуры
        // Remove our piece from the piece list (Удаление своей фигуры из списка фигур)
        var capturedType = captured & 0xF;
        g_pieceCount[capturedType]--;
        var lastPieceSquare = g_pieceList[(capturedType << 4) | g_pieceCount[capturedType]];
        g_pieceIndex[lastPieceSquare] = g_pieceIndex[epcEnd];
        g_pieceList[(capturedType << 4) | g_pieceIndex[lastPieceSquare]] = lastPieceSquare;
        g_pieceList[(capturedType << 4) | g_pieceCount[capturedType]] = 0;

        g_baseEval += materialTable[captured & 0x7];
        g_baseEval += pieceSquareAdj[captured & 0x7][me ? flipTable[epcEnd] : epcEnd];

        g_hashKeyLow ^= g_zobristLow[epcEnd][capturedType];
        g_hashKeyHigh ^= g_zobristHigh[epcEnd][capturedType];
        g_move50 = 0;
    } else if ((piece & 0x7) == piecePawn) {
        var diff = to - from;
        if (diff < 0) diff = -diff;
        if (diff > 16) {
            g_enPassentSquare = me ? (to + 0x10) : (to - 0x10);
        }
        g_move50 = 0;
    }

    g_hashKeyLow ^= g_zobristLow[from][piece & 0xF];
    g_hashKeyHigh ^= g_zobristHigh[from][piece & 0xF];
    g_hashKeyLow ^= g_zobristLow[to][piece & 0xF];
    g_hashKeyHigh ^= g_zobristHigh[to][piece & 0xF];
    g_hashKeyLow ^= g_zobristBlackLow;
    g_hashKeyHigh ^= g_zobristBlackHigh;
    
    g_castleRights &= g_castleRightsMask[from] & g_castleRightsMask[to];

    g_baseEval -= pieceSquareAdj[piece & 0x7][me == 0 ? flipTable[from] : from];
    
    // Move our piece in the piece list (Перемещение своей фигуры в список фигур)
    g_pieceIndex[to] = g_pieceIndex[from];
    g_pieceList[((piece & 0xF) << 4) | g_pieceIndex[to]] = to;

    if (flags & moveflagPromotion) {
        var newPiece = piece & (~0x7);
        if (flags & moveflagPromoteKnight) 
            newPiece |= pieceKnight;
        else if (flags & moveflagPromoteQueen) 
            newPiece |= pieceQueen;
        else if (flags & moveflagPromoteBishop) 
            newPiece |= pieceBishop;
        else 
            newPiece |= pieceRook;

        g_hashKeyLow ^= g_zobristLow[to][piece & 0xF];
        g_hashKeyHigh ^= g_zobristHigh[to][piece & 0xF];
        g_board[to] = newPiece;
        g_hashKeyLow ^= g_zobristLow[to][newPiece & 0xF];
        g_hashKeyHigh ^= g_zobristHigh[to][newPiece & 0xF];
        
        g_baseEval += pieceSquareAdj[newPiece & 0x7][me == 0 ? flipTable[to] : to];
        g_baseEval -= materialTable[piecePawn];
        g_baseEval += materialTable[newPiece & 0x7];

        var pawnType = piece & 0xF;
        var promoteType = newPiece & 0xF;

        g_pieceCount[pawnType]--;

        var lastPawnSquare = g_pieceList[(pawnType << 4) | g_pieceCount[pawnType]];
        g_pieceIndex[lastPawnSquare] = g_pieceIndex[to];
        g_pieceList[(pawnType << 4) | g_pieceIndex[lastPawnSquare]] = lastPawnSquare;
        g_pieceList[(pawnType << 4) | g_pieceCount[pawnType]] = 0;
        g_pieceIndex[to] = g_pieceCount[promoteType];
        g_pieceList[(promoteType << 4) | g_pieceIndex[to]] = to;
        g_pieceCount[promoteType]++;
    } else {
        g_board[to] = g_board[from];
        
        g_baseEval += pieceSquareAdj[piece & 0x7][me == 0 ? flipTable[to] : to];
    }
    g_board[from] = pieceEmpty;

    g_toMove = otherColor;
    g_baseEval = -g_baseEval;
    
    if ((piece & 0x7) == pieceKing || g_inCheck) {
        if (IsSquareAttackable(g_pieceList[(pieceKing | (8 - g_toMove)) << 4], otherColor)) {
            UnmakeMove(move);
            return false;
        }
    } else {
        var kingPos = g_pieceList[(pieceKing | (8 - g_toMove)) << 4];
        
        if (ExposesCheck(from, kingPos)) {
            UnmakeMove(move);
            return false;
        }
        
        if (epcEnd != to) {
            if (ExposesCheck(epcEnd, kingPos)) {
                UnmakeMove(move);
                return false;
            }
        }
    }
    
    g_inCheck = false;
    
    if (flags <= moveflagEPC) {
        var theirKingPos = g_pieceList[(pieceKing | g_toMove) << 4];
        
        // First check if the piece we moved can attack the enemy king
        //(Сначала проверяем, может ли атаковать короля противника фигура,которой мы походили)
        g_inCheck = IsSquareAttackableFrom(theirKingPos, to);
        
        if (!g_inCheck) {
            // Now check if the square we moved from exposes check on the enemy king
            //(Теперь проверяем, подвергает ли опасности шаха короля противника покинутое нами поле)
            g_inCheck = ExposesCheck(from, theirKingPos);
            
            if (!g_inCheck) {
                // Finally, ep. capture can cause another square to be exposed
                if (epcEnd != to) {
                    g_inCheck = ExposesCheck(epcEnd, theirKingPos);
                }
            }
        }
    }
    else {
        // Castle or promotion, slow check (Рокировка или превращение, тихий шах)
        g_inCheck = IsSquareAttackable(g_pieceList[(pieceKing | g_toMove) << 4], 8 - g_toMove);
    }

    g_repMoveStack[g_moveCount - 1] = g_hashKeyLow;
    g_move50++;

    return true;
}

function UndoHistory(ep, castleRights, inCheck, baseEval, hashKeyLow, hashKeyHigh, move50, captured) {
    this.ep = ep;
    this.castleRights = castleRights;
    this.inCheck = inCheck;
    this.baseEval = baseEval;
    this.hashKeyLow = hashKeyLow;
    this.hashKeyHigh = hashKeyHigh;
    this.move50 = move50;
    this.captured = captured;
}

function ExposesCheck(from, kingPos){
    var index = kingPos - from + 128;
    // If a queen can't reach it, nobody can! (Если королева не может добраться до него, никто не может!)
    if ((g_vectorDelta[index].pieceMask[0] & (1 << (pieceQueen))) != 0) {
        var delta = g_vectorDelta[index].delta;
        var pos = kingPos + delta;
        while (g_board[pos] == 0) pos += delta;
        
        var piece = g_board[pos];
        if (((piece & (g_board[kingPos] ^ 0x18)) & 0x18) == 0)
            return false;

        // Now see if the piece can actually attack the king
        //(Теперь посмотрим, если на самом деле фигура может атаковать короля)
        var backwardIndex = pos - kingPos + 128;
        return (g_vectorDelta[backwardIndex].pieceMask[(piece >> 3) & 1] & (1 << (piece & 0x7))) != 0;
    }
    return false;
}

//Восстановление позиции
function UnmakeMove(move){
    g_toMove = 8 - g_toMove; //Изменение очередности хода
    g_baseEval = -g_baseEval; //Изменение оценки позиции
    
    g_moveCount--; //Уменьшение на 1 счетчика числа ходов
    g_enPassentSquare = g_moveUndoStack[g_moveCount].ep;
    g_castleRights = g_moveUndoStack[g_moveCount].castleRights;
    g_inCheck = g_moveUndoStack[g_moveCount].inCheck;
    g_baseEval = g_moveUndoStack[g_moveCount].baseEval;
    g_hashKeyLow = g_moveUndoStack[g_moveCount].hashKeyLow;
    g_hashKeyHigh = g_moveUndoStack[g_moveCount].hashKeyHigh;
    g_move50 = g_moveUndoStack[g_moveCount].move50;
    
    var otherColor = 8 - g_toMove; //Цвет фигур противника
    var me = g_toMove >> 3;
    var them = otherColor >> 3;
    
    var flags = move & 0xFF0000;
    var captured = g_moveUndoStack[g_moveCount].captured;
    var to = (move >> 8) & 0xFF; //Поле, на которое ходила фигура
    var from = move & 0xFF; //Поле, откуда ходила фигура
    
    var piece = g_board[to];
    
    if (flags) {
        if (flags & moveflagCastleKing) {//Если была короткая рокировка
        // Перемещение ладьи на исходное поле
            var rook = g_board[to - 1];
            g_board[to + 1] = rook;
            g_board[to - 1] = pieceEmpty;
			
            var rookIndex = g_pieceIndex[to - 1];
            g_pieceIndex[to + 1] = rookIndex;
            g_pieceList[((rook & 0xF) << 4) | rookIndex] = to + 1;
        }
        else if (flags & moveflagCastleQueen) {//Если была длинная рокировка
        // Перемещение ладьи на исходное поле
            var rook = g_board[to + 1];
            g_board[to - 2] = rook;
            g_board[to + 1] = pieceEmpty;
			
            var rookIndex = g_pieceIndex[to + 1];
            g_pieceIndex[to - 2] = rookIndex;
            g_pieceList[((rook & 0xF) << 4) | rookIndex] = to - 2;
        }
    }
    
    if (flags & moveflagPromotion) {
        piece = (g_board[to] & (~0x7)) | piecePawn;
        g_board[from] = piece;

        var pawnType = g_board[from] & 0xF;
        var promoteType = g_board[to] & 0xF;// Тип фигуры, в которую превратилась пешка

        g_pieceCount[promoteType]--;// Уменьшение на 1 числа фигур того типа, 
// Отмена превращения пешки в фигуру
        var lastPromoteSquare = g_pieceList[(promoteType << 4) | g_pieceCount[promoteType]];
        g_pieceIndex[lastPromoteSquare] = g_pieceIndex[to];
        g_pieceList[(promoteType << 4) | g_pieceIndex[lastPromoteSquare]] = lastPromoteSquare;
        g_pieceList[(promoteType << 4) | g_pieceCount[promoteType]] = 0;
        g_pieceIndex[to] = g_pieceCount[pawnType];
        g_pieceList[(pawnType << 4) | g_pieceIndex[to]] = to;
        g_pieceCount[pawnType]++;
    }
    else {
        g_board[from] = g_board[to];
    }
// Отмена взятия пешки, прошедшей через бойное поле
    var epcEnd = to;
    if (flags & moveflagEPC) {
        if (g_toMove == colorWhite) 
            epcEnd = to + 0x10;
        else 
            epcEnd = to - 0x10;
        g_board[to] = pieceEmpty;
    }
    
    g_board[epcEnd] = captured;

	// Move our piece in the piece list (Перемещение своей фигуры в список фигур)
    g_pieceIndex[from] = g_pieceIndex[to];
    g_pieceList[((piece & 0xF) << 4) | g_pieceIndex[from]] = from;

    if (captured) {
    // Restore our piece to the piece list (Возвращение своей фигуры в список фигур)
        var captureType = captured & 0xF;
        g_pieceIndex[epcEnd] = g_pieceCount[captureType];
        g_pieceList[(captureType << 4) | g_pieceCount[captureType]] = epcEnd;
        g_pieceCount[captureType]++;
    }
}

function EnsureAnalysisStopped() {
    //Проверка флага анализа позиции и состояния фонового процесса g_backgroundEngine
    if (g_analyzing && g_backgroundEngine != null) {
        g_backgroundEngine.terminate();//Завершение фонового процесса g_backgroundEngine
        g_backgroundEngine = null;
    }
}

function UIAnalyzeToggle() {
    if (InitializeBackgroundEngine()) {
        if (!g_analyzing) {
            g_backgroundEngine.postMessage("analyze");
        } else {
            EnsureAnalysisStopped();
        }
        g_analyzing = !g_analyzing;
        document.getElementById("AnalysisToggleLink").innerText = g_analyzing ? "Analysis: On" : "Analysis: Off";
    } else {
        alert("Your browser must support web workers for analysis - (chrome4, ff4, safari)");
    }
}

function UIChangeFEN() {
    if (!g_changingFen) {
        var fenTextBox = document.getElementById("FenTextBox");
        var result = InitializeFromFen(fenTextBox.value);
        if (result.length != 0) {
            UpdatePVDisplay(result);
            return;
        } else {
            UpdatePVDisplay('');
        }        g_allMoves = [];

        EnsureAnalysisStopped();
        InitializeBackgroundEngine();

        g_playerWhite = !!g_toMove;
        g_backgroundEngine.postMessage("position " + GetFen());

        RedrawBoard();
    }
}

function UIChangeStartPlayer() {
    g_playerWhite = !g_playerWhite;//Изменение цвета фигур
    RedrawBoard();//Перерисовка шахматной доски
}

//Обновление записи шахматной партии
function UpdatePgnTextBox(move) {
    var pgnTextBox = document.getElementById("PgnTextBox");
//    if (g_toMove != 0) { //Если ход белых ***
        pgnTextBox.value += moveNumber + ". "; //Запись номера хода
        moveNumber++;
//    } ***
    pgnTextBox.value += GetMoveSAN(move) + " "; //Запись хода
    var z=suggestMoves.length;
    suggestMoves[suggestMoves.length]=move;
}

function GetMoveSAN(move, validMoves) {
	var from = move & 0xFF;
	var to = (move >> 8) & 0xFF;
	
	if (move & moveflagCastleKing) return "O-O";
	if (move & moveflagCastleQueen) return "O-O-O";
	
	var pieceType = g_board[from] & 0x7;
	var result = ["", "", "N", "B", "R", "Q", "K", ""][pieceType];
	
	var dupe = false, rowDiff = true, colDiff = true;
	if (validMoves == null) {
		validMoves = GenerateValidMoves();
	}
	for (var i = 0; i < validMoves.length; i++) {
		var moveFrom = validMoves[i] & 0xFF;
		var moveTo = (validMoves[i] >> 8) & 0xFF; 
		if (moveFrom != from &&
			moveTo == to &&
			(g_board[moveFrom] & 0x7) == pieceType) {
			dupe = true;
			if ((moveFrom & 0xF0) == (from & 0xF0)) {
				rowDiff = false;
			}
			if ((moveFrom & 0x0F) == (from & 0x0F)) {
				colDiff = false;
			}
		}
	}
	
	if (dupe) {
		if (colDiff) {
			result += FormatSquare(from).charAt(0);
		} else if (rowDiff) {
			result += FormatSquare(from).charAt(1);
		} else {
			result += FormatSquare(from);
		}
	} else if (pieceType == piecePawn && (g_board[to] != 0 || (move & moveflagEPC))) {
		result += FormatSquare(from).charAt(0);
	}
	
	if (g_board[to] != 0 || (move & moveflagEPC)) {
		result += "x";
	}
	
	result += FormatSquare(to);
	
	if (move & moveflagPromotion) {
		if (move & moveflagPromoteBishop) result += "=B";
		else if (move & moveflagPromoteKnight) result += "=N";
		else if (move & moveflagPromoteQueen) result += "=Q";
		else result += "=R";
	}

	MakeMove(move);
	if (g_inCheck) {
	    result += GenerateValidMoves().length == 0 ? "#" : "+";
	}
	UnmakeMove(move);
	return result;
}

//Изменение времени на ход
function UIChangeTimePerMove() {
    var timePerMove = document.getElementById("TimePerMove");
    g_timeout = parseInt(timePerMove.value, 10);
}

//Окончательный ход
function FinishMove(bestMove, value, timeTaken, ply) { 
    if (bestMove != null) {
        UIPlayMove(bestMove, BuildPVMessage(bestMove, value, timeTaken, ply));
    } else {
        alert("Checkmate!"); //Шах и мат!
    }
}

function UIPlayMove(move, pv) {
    UpdatePgnTextBox(move); //Добавление хода в запись шахматной партии
// alert("2");
    g_allMoves[g_allMoves.length] = move;
//    MakeMove(move);
// alert("3");
    UpdatePVDisplay(pv);
// alert("4");
//    UpdateFromMove(move); //Обновление расположения фигур на шахматной доске ***
}

//Аннулирование хода
function UIUndoMove() {
  if (g_allMoves.length == 0) {
    return;
  }

  if (g_backgroundEngine != null) {
    g_backgroundEngine.terminate();
    g_backgroundEngine = null;
  }

  UnmakeMove(g_allMoves[g_allMoves.length - 1]);
  g_allMoves.pop();

  if (g_playerWhite != !!g_toMove && g_allMoves.length != 0) {
    UnmakeMove(g_allMoves[g_allMoves.length - 1]);
    g_allMoves.pop();
  }

  RedrawBoard();
}

function UpdatePVDisplay(pv) {
    if (pv != null) {
        var outputDiv = document.getElementById("output");
        if (outputDiv.firstChild != null) {
            outputDiv.removeChild(outputDiv.firstChild);
        }
        outputDiv.appendChild(document.createTextNode(pv));
    }
}

function SearchAndRedraw() {
    alert("SearchAndRedraw1");
  //  if (g_analyzing) {
  //      EnsureAnalysisStopped();
  //      InitializeBackgroundEngine();
  //      g_backgroundEngine.postMessage("position " + GetFen());
  //      g_backgroundEngine.postMessage("analyze");
 //       return;
  //  }

//    if (InitializeBackgroundEngine()) { ***
//        g_backgroundEngine.postMessage("search " + g_timeout); ***
//    } *** 
//    else { ***
	    Search(FinishMove, 99, null);
//    } ***
}

function Search(finishMoveCallback, maxPly, finishPlyCallback) {
    var lastEval;
    var alpha = minEval;
    var beta = maxEval;
    
	g_globalPly++;
    g_nodeCount = 0;
    g_qNodeCount = 0;
    g_searchValid = true;
    
    var bestMove = 0;
    var value;
    
    g_startTime = (new Date()).getTime();

    var i;
    for (i = 1; i <= maxPly && g_searchValid; i++) {
        var tmp = AlphaBeta(i, 0, alpha, beta);
        if (!g_searchValid) break;

        value = tmp;

        if (value > alpha && value < beta) {
            alpha = value - 500;
            beta = value + 500;

            if (alpha < minEval) alpha = minEval;
            if (beta > maxEval) beta = maxEval;
        } else if (alpha != minEval) {
            alpha = minEval;
            beta = maxEval;
            i--;
        }

        if (g_hashTable[g_hashKeyLow & g_hashMask] != null) {
            bestMove = g_hashTable[g_hashKeyLow & g_hashMask].bestMove;
        }

        if (finishPlyCallback != null) {
            finishPlyCallback(bestMove, value, (new Date()).getTime() - g_startTime, i);
        }
    }
    //   if (bestMove != null) {
     //       alert("bestMove="+FormatMove(bestMove));
     //     MakeMove(bestMove);
      //    FormatMove(bestMove);
 //         i--;
  //        }
    if (finishMoveCallback != null) {
        finishMoveCallback(bestMove, value, (new Date()).getTime() - g_startTime, i - 1);
    }
}

//////////////////////////////////////////////////
// Test Harness
//////////////////////////////////////////////////
function FinishPlyCallback(bestMove, value, timeTaken, ply) {
    postMessage("pv " + BuildPVMessage(bestMove, value, timeTaken, ply));
}

function BuildPVMessage(bestMove, value, timeTaken, ply) {
    var totalNodes = g_nodeCount + g_qNodeCount;
    return "Ply:" + ply + " Score:" + value + " Nodes:" + totalNodes + " NPS:" + ((totalNodes / (timeTaken / 1000)) | 0) + " " + PVFromHash(bestMove, 15);
//return "Ply:" + ply + " Score:" + value + " ";
}

function PVFromHash(move, ply) {
    if (ply == 0) 
        return "";

    if (move == 0) {
	if (g_inCheck) return "checkmate";
	return "stalemate";
    }
    
    var pvString = " " + GetMoveSAN(move);
    MakeMove(move);
    
    var hashNode = g_hashTable[g_hashKeyLow & g_hashMask];
    if (hashNode != null && hashNode.lock == g_hashKeyHigh && hashNode.bestMove != null) {
        pvString += PVFromHash(hashNode.bestMove, ply - 1);
    }
    
    UnmakeMove(move);
    
    return pvString;
}

function FinishMoveLocalTesting(bestMove, value, timeTaken, ply) {
    if (bestMove != null) {
        MakeMove(bestMove);
        postMessage(FormatMove(bestMove));
    }
}

function FormatMove(move) {
    var result = FormatSquare(move & 0xFF) + FormatSquare((move >> 8) & 0xFF);
    if (move & moveflagPromotion) {
        if (move & moveflagPromoteBishop) result += "b";
        else if (move & moveflagPromoteKnight) result += "n";
        else if (move & moveflagPromoteQueen) result += "q";
        else result += "r";
    }
    return result;
}

function FormatSquare(square) {
    var letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return letters[(square & 0xF) - 4] + ((9 - (square >> 4)) + 1);
}

function AlphaBeta(ply, depth, alpha, beta) {
    if (ply <= 0) {
        return QSearch(alpha, beta, 0);
    }

    g_nodeCount++;

    if (depth > 0 && IsRepDraw())
        return 0;

    // Mate distance pruning
    var oldAlpha = alpha;
    alpha = alpha < minEval + depth ? alpha : minEval + depth;
    beta = beta > maxEval - (depth + 1) ? beta : maxEval - (depth + 1);
    if (alpha >= beta)
       return alpha;

    var hashMove = null;
    var hashFlag = hashflagAlpha;
    var hashNode = g_hashTable[g_hashKeyLow & g_hashMask];
    if (hashNode != null && hashNode.lock == g_hashKeyHigh) {
        hashMove = hashNode.bestMove;
    }
    
    var inCheck = g_inCheck;

    var moveMade = false;
    var realEval = minEval;

    var movePicker = new MovePicker(hashMove, depth, g_killers[depth][0], g_killers[depth][1]);

    for (;;) {
        var currentMove = movePicker.nextMove();
        if (currentMove == 0) {
            break;
        }

        var plyToSearch = ply - 1;

        if (!MakeMove(currentMove)) {
            continue;
        }

        if (g_inCheck) {
            // Check extensions
            plyToSearch++;
        }

        var value;
        if (moveMade) {
            value = -AllCutNode(plyToSearch, depth + 1, -alpha, true);
            if (value > alpha) {
                value = -AlphaBeta(plyToSearch, depth + 1, -beta, -alpha);
            }
        } else {
            value = -AlphaBeta(plyToSearch, depth + 1, -beta, -alpha);
        }

        moveMade = true;

        UnmakeMove(currentMove);

        if (!g_searchValid) {
            return alpha;
        }

        if (value > realEval) {
            if (value >= beta) {
                var histTo = (currentMove >> 8) & 0xFF;
                if (g_board[histTo] == 0) {
                    var histPiece = g_board[currentMove & 0xFF] & 0xF;
                    historyTable[histPiece][histTo] += ply * ply;
                    if (historyTable[histPiece][histTo] > 32767) {
                        historyTable[histPiece][histTo] >>= 1;
                    }

                    if (g_killers[depth][0] != currentMove) {
                        g_killers[depth][1] = g_killers[depth][0];
                        g_killers[depth][0] = currentMove;
                    }
                }

                StoreHash(value, hashflagBeta, ply, currentMove, depth);
                return value;
            }

            if (value > oldAlpha) {
                hashFlag = hashflagExact;
                alpha = value;
            }

            realEval = value;
            hashMove = currentMove;
        }
    }

    if (!moveMade) {
        // If we have no valid moves it's either stalemate or checkmate
        if (inCheck) 
            // Checkmate.
            return minEval + depth;
        else 
            // Stalemate
            return 0;
    }

    StoreHash(realEval, hashFlag, ply, hashMove, depth);
    
    return realEval;
}

function QSearch(alpha, beta, ply) {
    g_qNodeCount++;

    var realEval = g_inCheck ? (minEval + 1) : Evaluate();
    
    if (realEval >= beta) 
        return realEval;

    if (realEval > alpha)
        alpha = realEval;

    var moves = new Array();
    var moveScores = new Array();
    var wasInCheck = g_inCheck;

    if (wasInCheck) { // Если был шах
        // TODO: Fast check escape generator and fast checking moves generator
        GenerateCaptureMoves(moves, null); // Генерация ходов со взятиями
        GenerateAllMoves(moves); // Генерация всех ходов

        for (var i = 0; i < moves.length; i++) {
            moveScores[i] = ScoreMove(moves[i]);
        }
    } else {
        GenerateCaptureMoves(moves, null);

        for (var i = 0; i < moves.length; i++) {
            var captured = g_board[(moves[i] >> 8) & 0xFF] & 0x7;
            var pieceType = g_board[moves[i] & 0xFF] & 0x7;

            moveScores[i] = (captured << 5) - pieceType;
        }
    }
// Сортировка ходов по убыванию их оценок
    for (var i = 0; i < moves.length; i++) {
        var bestMove = i;
        for (var j = moves.length - 1; j > i; j--) {
            if (moveScores[j] > moveScores[bestMove]) {
                bestMove = j;
            }
        }
        {
            var tmpMove = moves[i];
            moves[i] = moves[bestMove];
            moves[bestMove] = tmpMove;
            
            var tmpScore = moveScores[i];
            moveScores[i] = moveScores[bestMove];
            moveScores[bestMove] = tmpScore;
        }

        if (!wasInCheck && !See(moves[i])) {
            continue;
        }

        if (!MakeMove(moves[i])) {
            continue;
        }

        var value = -QSearch(-beta, -alpha, ply - 1);
        
        UnmakeMove(moves[i]);
        
        if (value > realEval) {
            if (value >= beta) 
                return value;
            
            if (value > alpha)
                alpha = value;
            
            realEval = value;
        }
    }

    /* Disable checks...  Too slow currently

    if (ply == 0 && !wasInCheck) {
        moves = new Array();
        GenerateAllMoves(moves);

        for (var i = 0; i < moves.length; i++) {
            moveScores[i] = ScoreMove(moves[i]);
        }

        for (var i = 0; i < moves.length; i++) {
            var bestMove = i;
            for (var j = moves.length - 1; j > i; j--) {
                if (moveScores[j] > moveScores[bestMove]) {
                    bestMove = j;
                }
            }
            {
                var tmpMove = moves[i];
                moves[i] = moves[bestMove];
                moves[bestMove] = tmpMove;

                var tmpScore = moveScores[i];
                moveScores[i] = moveScores[bestMove];
                moveScores[bestMove] = tmpScore;
            }

            if (!MakeMove(moves[i])) {
                continue;
            }
            var checking = g_inCheck;
            UnmakeMove(moves[i]);

            if (!checking) {
                continue;
            }

            if (!See(moves[i])) {
                continue;
            }
            
            MakeMove(moves[i]);

            var value = -QSearch(-beta, -alpha, ply - 1);

            UnmakeMove(moves[i]);

            if (value > realEval) {
                if (value >= beta)
                    return value;

                if (value > alpha)
                    alpha = value;

                realEval = value;
            }
        }
    }
    */

    return realEval;
}

// Оценка позиции
function Evaluate() {
    var curEval = g_baseEval;

    var evalAdjust = 0;
    // Black queen gone, then cancel white's penalty for king movement
    if (g_pieceList[pieceQueen << 4] == 0)
        evalAdjust -= pieceSquareAdj[pieceKing][g_pieceList[(colorWhite | pieceKing) << 4]];
    // White queen gone, then cancel black's penalty for king movement
    if (g_pieceList[(colorWhite | pieceQueen) << 4] == 0) 
        evalAdjust += pieceSquareAdj[pieceKing][flipTable[g_pieceList[pieceKing << 4]]];

    // Black bishop pair (Пара черных слонов)
    if (g_pieceCount[pieceBishop] >= 2)
        evalAdjust -= 500;
    // White bishop pair (Пара белых слонов)
    if (g_pieceCount[pieceBishop | colorWhite] >= 2)
        evalAdjust += 500;

    var mobility = Mobility(8) - Mobility(0);

    if (g_toMove == 0) {
        // Black (Черные)
        curEval -= mobility;
        curEval -= evalAdjust;
    }
    else {
        curEval += mobility;
        curEval += evalAdjust;
    }
    
    return curEval;
}

// Подвижность (маневренность)фигур
function Mobility(color) {
    var result = 0;
    var from, to, mob, pieceIdx;
    var enemy = color == 8 ? 0x10 : 0x8 // Цвет фигур противника
    var mobUnit = color == 8 ? g_mobUnit[0] : g_mobUnit[1];

    // Knight mobility (Подвижность коней)
    mob = -3;
    pieceIdx = (color | 2) << 4;
    from = g_pieceList[pieceIdx++];
    while (from != 0) {
        mob += mobUnit[g_board[from + 31]];
        mob += mobUnit[g_board[from + 33]];
        mob += mobUnit[g_board[from + 14]];
        mob += mobUnit[g_board[from - 14]];
        mob += mobUnit[g_board[from - 31]];
        mob += mobUnit[g_board[from - 33]];
        mob += mobUnit[g_board[from + 18]];
        mob += mobUnit[g_board[from - 18]];
        from = g_pieceList[pieceIdx++];
    }
    result += 65 * mob;

    // Bishop mobility (Подвижность слонов)
    mob = -4;
    pieceIdx = (color | 3) << 4;
    from = g_pieceList[pieceIdx++];
    while (from != 0) {
        to = from - 15; while (g_board[to] == 0) { to -= 15; mob++; }
        if (g_board[to] & enemy) {
          mob++;
          if (!(g_board[to] & piecePawn)) {
            to -= 15; while (g_board[to] == 0) to -= 15;
            mob += mobUnit[g_board[to]] << 2;
          }
        }

        to = from - 17; while (g_board[to] == 0) { to -= 17; mob++; }
        if (g_board[to] & enemy) {
          mob++;
          if (!(g_board[to] & piecePawn)) {
            to -= 17; while (g_board[to] == 0) to -= 17;
            mob += mobUnit[g_board[to]] << 2; 
          }
        }

        to = from + 15; while (g_board[to] == 0) { to += 15; mob++; }
        if (g_board[to] & enemy) {
          mob++;
          if (!(g_board[to] & piecePawn)) {
            to += 15; while (g_board[to] == 0) to += 15;
            mob += mobUnit[g_board[to]] << 2; 
          }
        }

        to = from + 17; while (g_board[to] == 0) { to += 17; mob++; }
        if (g_board[to] & enemy) {
          mob++;
          if (!(g_board[to] & piecePawn)) {
            to += 17; while (g_board[to] == 0) to += 17;
            mob += mobUnit[g_board[to]] << 2;
          }
        }

        from = g_pieceList[pieceIdx++];
    }
    result += 44 * mob;

    // Rook mobility (Подвижность ладей)
    mob = -4;
    pieceIdx = (color | 4) << 4;
    from = g_pieceList[pieceIdx++];
    while (from != 0) {
        to = from - 1; while (g_board[to] == 0) { to--; mob++;}  if (g_board[to] & enemy) mob++;
        to = from + 1; while (g_board[to] == 0) { to++; mob++; } if (g_board[to] & enemy) mob++;
        to = from + 16; while (g_board[to] == 0) { to += 16; mob++; } if (g_board[to] & enemy) mob++;
        to = from - 16; while (g_board[to] == 0) { to -= 16; mob++; } if (g_board[to] & enemy) mob++;
        from = g_pieceList[pieceIdx++];
    }
    result += 25 * mob;

    // Queen mobility (Подвижность ферзя)
    mob = -2;
    pieceIdx = (color | 5) << 4;
    from = g_pieceList[pieceIdx++];
    while (from != 0) {
        to = from - 15; while (g_board[to] == 0) { to -= 15; mob++; } if (g_board[to] & enemy) mob++;
        to = from - 17; while (g_board[to] == 0) { to -= 17; mob++; } if (g_board[to] & enemy) mob++;
        to = from + 15; while (g_board[to] == 0) { to += 15; mob++; } if (g_board[to] & enemy) mob++;
        to = from + 17; while (g_board[to] == 0) { to += 17; mob++; } if (g_board[to] & enemy) mob++;
        to = from - 1; while (g_board[to] == 0) { to--; mob++; } if (g_board[to] & enemy) mob++;
        to = from + 1; while (g_board[to] == 0) { to++; mob++; } if (g_board[to] & enemy) mob++;
        to = from + 16; while (g_board[to] == 0) { to += 16; mob++; } if (g_board[to] & enemy) mob++;
        to = from - 16; while (g_board[to] == 0) { to -= 16; mob++; } if (g_board[to] & enemy) mob++;
        from = g_pieceList[pieceIdx++];
    }
    result += 22 * mob;

    return result;
}

function IsRepDraw() {
    var stop = g_moveCount - 1 - g_move50;
    stop = stop < 0 ? 0 : stop;
    for (var i = g_moveCount - 5; i >= stop; i -= 2) {
        if (g_repMoveStack[i] == g_hashKeyLow)
            return true;
    }
    return false;
}

// Сортировщик ходов
function MovePicker(hashMove, depth, killer1, killer2) {
    this.hashMove = hashMove;
    this.depth = depth;
    this.killer1 = killer1;
    this.killer2 = killer2;

    this.moves = new Array();
    this.losingCaptures = null;
    this.moveCount = 0;
    this.atMove = -1;
    this.moveScores = null;
    this.stage = 0;

    this.nextMove = function () {
        if (++this.atMove == this.moveCount) {
            this.stage++;
            if (this.stage == 1) {
                if (this.hashMove != null && IsHashMoveValid(hashMove)) {
                    this.moves[0] = hashMove;
                    this.moveCount = 1;
                }
                if (this.moveCount != 1) {
                    this.hashMove = null;
                    this.stage++;
                }
            }

            if (this.stage == 2) {
                GenerateCaptureMoves(this.moves, null); // Генерация ходов со взятиями
                this.moveCount = this.moves.length; // Число ходов со взятиями
                this.moveScores = new Array(this.moveCount);
                // Move ordering (упорядочение ходов)
                for (var i = this.atMove; i < this.moveCount; i++) {
                    var captured = g_board[(this.moves[i] >> 8) & 0xFF] & 0x7;
                    var pieceType = g_board[this.moves[i] & 0xFF] & 0x7;
                    this.moveScores[i] = (captured << 5) - pieceType;
                }
                // No moves, onto next stage (Нет ходов, на следующий этап)
                if (this.atMove == this.moveCount) this.stage++;
            }

            if (this.stage == 3) {
                if (IsHashMoveValid(this.killer1) &&
                    this.killer1 != this.hashMove) {
                    this.moves[this.moves.length] = this.killer1;
                    this.moveCount = this.moves.length;
                } else {
                    this.killer1 = 0;
                    this.stage++;
                }
            }

            if (this.stage == 4) {
                if (IsHashMoveValid(this.killer2) &&
                    this.killer2 != this.hashMove) {
                    this.moves[this.moves.length] = this.killer2;
                    this.moveCount = this.moves.length;
                } else {
                    this.killer2 = 0;
                    this.stage++;
                }
            }

            if (this.stage == 5) {
                GenerateAllMoves(this.moves); // Генерация тихих ходов
                this.moveCount = this.moves.length; // Число тихих ходов
                // Move ordering (упорядочение ходов)
                for (var i = this.atMove; i < this.moveCount; i++) this.moveScores[i] = ScoreMove(this.moves[i]);
                // No moves, onto next stage (Нет ходов, на следующий этап)
                if (this.atMove == this.moveCount) this.stage++;
            }

            if (this.stage == 6) {
                // Losing captures (Потери взятий))
                if (this.losingCaptures != null) {
                    for (var i = 0; i < this.losingCaptures.length; i++) {
                        this.moves[this.moves.length] = this.losingCaptures[i];
                    }
                    for (var i = this.atMove; i < this.moveCount; i++) this.moveScores[i] = ScoreMove(this.moves[i]);
                    this.moveCount = this.moves.length;
                }
                // No moves, onto next stage (Нет ходов, на следующий этап)
                if (this.atMove == this.moveCount) this.stage++;
            }

            if (this.stage == 7)
                return 0;
        }

        var bestMove = this.atMove;
        for (var j = this.atMove + 1; j < this.moveCount; j++) {
            if (this.moveScores[j] > this.moveScores[bestMove]) {
                bestMove = j;
            }
        }

        if (bestMove != this.atMove) {
            var tmpMove = this.moves[this.atMove];
            this.moves[this.atMove] = this.moves[bestMove];
            this.moves[bestMove] = tmpMove;

            var tmpScore = this.moveScores[this.atMove];
            this.moveScores[this.atMove] = this.moveScores[bestMove];
            this.moveScores[bestMove] = tmpScore;
        }

        var candidateMove = this.moves[this.atMove];
        if ((this.stage > 1 && candidateMove == this.hashMove) ||
            (this.stage > 3 && candidateMove == this.killer1) ||
            (this.stage > 4 && candidateMove == this.killer2)) {
            return this.nextMove();
        }

        if (this.stage == 2 && !See(candidateMove)) {
            if (this.losingCaptures == null) {
                this.losingCaptures = new Array();
            }
            this.losingCaptures[this.losingCaptures.length] = candidateMove;
            return this.nextMove();
        }
        return this.moves[this.atMove];
    }
}

function IsHashMoveValid(hashMove) {
    var from = hashMove & 0xFF;
    var to = (hashMove >> 8) & 0xFF;
    var ourPiece = g_board[from];
    var pieceType = ourPiece & 0x7;
    if (pieceType < piecePawn || pieceType > pieceKing) return false;
    // Can't move a piece we don't control
    if (g_toMove != (ourPiece & 0x8))
        return false;
    // Can't move to a square that has something of the same color
    if (g_board[to] != 0 && (g_toMove == (g_board[to] & 0x8)))
        return false;
    if (pieceType == piecePawn) {
        if (hashMove & moveflagEPC) {
            return false;
        }

        // Valid moves are push, capture, double push, promotions
        var dir = to - from;
        if ((g_toMove == colorWhite) != (dir < 0))  {
            // Pawns have to move in the right direction
            return false;
        }

        var row = to & 0xF0;
        if (((row == 0x90 && !g_toMove) ||
             (row == 0x20 && g_toMove)) != (hashMove & moveflagPromotion)) {
            // Handle promotions
            return false;
        }

        if (dir == -16 || dir == 16) {
            // White/Black push
            return g_board[to] == 0;
        } else if (dir == -15 || dir == -17 || dir == 15 || dir == 17) {
            // White/Black capture
            return g_board[to] != 0;
        } else if (dir == -32) {
            // Double white push
            if (row != 0x60) return false;
            if (g_board[to] != 0) return false;
            if (g_board[from - 16] != 0) return false;
        } else if (dir == 32) {
            // Double black push
            if (row != 0x50) return false;
            if (g_board[to] != 0) return false;
            if (g_board[from + 16] != 0) return false;
        } else {
            return false;
        }

        return true;
    } else {
        // This validates that this piece type can actually make the attack
        if (hashMove >> 16) return false;
        return IsSquareAttackableFrom(to, from);
    }
}

function AllCutNode(ply, depth, beta, allowNull) {
    if (ply <= 0) {
        return QSearch(beta - 1, beta, 0);
    }

    if ((g_nodeCount & 127) == 127) {
        if ((new Date()).getTime() - g_startTime > g_timeout) {
            // Time cutoff
            g_searchValid = false;
            return beta - 1;
        }
    }

    g_nodeCount++;

    if (IsRepDraw())
        return 0;

    // Mate distance pruning (Сокращение расстояния до мата)
    if (minEval + depth >= beta)
       return beta;

    if (maxEval - (depth + 1) < beta)
	return beta - 1;

    var hashMove = null;
    var hashNode = g_hashTable[g_hashKeyLow & g_hashMask];
    if (hashNode != null && hashNode.lock == g_hashKeyHigh) {
        hashMove = hashNode.bestMove;
        if (hashNode.hashDepth >= ply) {
            var hashValue = hashNode.value;

            // Fixup mate scores (Фиксация оценок мата)
            if (hashValue >= maxMateBuffer)
		hashValue -= depth;
            else if (hashValue <= minMateBuffer)
                hashValue += depth;

            if (hashNode.flags == hashflagExact)
                return hashValue;
            if (hashNode.flags == hashflagAlpha && hashValue < beta)
                return hashValue;
            if (hashNode.flags == hashflagBeta && hashValue >= beta)
                return hashValue;
        }
    }

    // TODO - positional gain? (позиционное усиление?)

    if (!g_inCheck &&
        allowNull &&
        beta > minMateBuffer && 
        beta < maxMateBuffer) {
        // Try some razoring (попробуйте некоторую бритву)
        if (hashMove == null &&
            ply < 4) {
            var razorMargin = 2500 + 200 * ply;
            if (g_baseEval < beta - razorMargin) {
                var razorBeta = beta - razorMargin;
                var v = QSearch(razorBeta - 1, razorBeta, 0);
                if (v < razorBeta)
                    return v;
            }
        }
        
        // TODO - static null move

        // Null move (пустой ход)
        if (ply > 1 &&
            g_baseEval >= beta - (ply >= 4 ? 2500 : 0) &&
            // Disable null move if potential zugzwang (no big pieces)
            // Отключение пустого хода в случае потенциального цугцванга (нет больших фигур)
            (g_pieceCount[pieceBishop | g_toMove] != 0 ||
             g_pieceCount[pieceKnight | g_toMove] != 0 ||
             g_pieceCount[pieceRook | g_toMove] != 0 ||
             g_pieceCount[pieceQueen | g_toMove] != 0)) {
            var r = 3 + (ply >= 5 ? 1 : ply / 4);
            if (g_baseEval - beta > 1500) r++;

	        g_toMove = 8 - g_toMove;
	        g_baseEval = -g_baseEval;
	        g_hashKeyLow ^= g_zobristBlackLow;
	        g_hashKeyHigh ^= g_zobristBlackHigh;
			
	        var value = -AllCutNode(ply - r, depth + 1, -(beta - 1), false);

	        g_hashKeyLow ^= g_zobristBlackLow;
	        g_hashKeyHigh ^= g_zobristBlackHigh;
	        g_toMove = 8 - g_toMove;
	        g_baseEval = -g_baseEval;

            if (value >= beta)
	            return beta;
        }
    }

    var moveMade = false;
    var realEval = minEval - 1;
    var inCheck = g_inCheck;

    var movePicker = new MovePicker(hashMove, depth, g_killers[depth][0], g_killers[depth][1]);

    for (;;) {
        var currentMove = movePicker.nextMove();
        if (currentMove == 0) {
            break;
        }

        var plyToSearch = ply - 1;

        if (!MakeMove(currentMove)) {
            continue;
        }

        var value;
        var doFullSearch = true;

        if (g_inCheck) {
            // Check extensions
            plyToSearch++;
        } else {
            var reduced = plyToSearch - (movePicker.atMove > 14 ? 2 : 1);

            // Futility pruning
/*            if (movePicker.stage == 5 && !inCheck) {
                if (movePicker.atMove >= (15 + (1 << (5 * ply) >> 2)) &&
                    realEval > minMateBuffer) {
                    UnmakeMove(currentMove);
                    continue;
                }

                if (ply < 7) {
                    var reducedPly = reduced <= 0 ? 0 : reduced;
                    var futilityValue = -g_baseEval + (900 * (reducedPly + 2)) - (movePicker.atMove * 10);
                    if (futilityValue < beta) {
                        if (futilityValue > realEval) {
                            realEval = futilityValue;
                        }
                        UnmakeMove(currentMove);
                        continue;
                    }
                }
            }*/

            // Late move reductions (Сокращение недавнего хода)
            if (movePicker.stage == 5 && movePicker.atMove > 5 && ply >= 3) {
                value = -AllCutNode(reduced, depth + 1, -(beta - 1), true);
                doFullSearch = (value >= beta);
            }
        }

        if (doFullSearch) {
            value = -AllCutNode(plyToSearch, depth + 1, -(beta  - 1), true);
        }

        moveMade = true;

        UnmakeMove(currentMove);

        if (!g_searchValid) {
            return beta - 1;
        }

        if (value > realEval) {
            if (value >= beta) {
				var histTo = (currentMove >> 8) & 0xFF;
				if (g_board[histTo] == 0) {
				    var histPiece = g_board[currentMove & 0xFF] & 0xF;
				    historyTable[histPiece][histTo] += ply * ply;
				    if (historyTable[histPiece][histTo] > 32767) {
				        historyTable[histPiece][histTo] >>= 1;
				    }

				    if (g_killers[depth][0] != currentMove) {
				        g_killers[depth][1] = g_killers[depth][0];
				        g_killers[depth][0] = currentMove;
				    }
				}

                StoreHash(value, hashflagBeta, ply, currentMove, depth);
                return value;
            }

            realEval = value;
            hashMove = currentMove;
        }
    }

    if (!moveMade) {
        // If we have no valid moves it's either stalemate or checkmate
        if (g_inCheck)
            // Checkmate.
            return minEval + depth;
        else 
            // Stalemate
            return 0;
    }

    StoreHash(realEval, hashflagAlpha, ply, hashMove, depth);
    
    return realEval;
}

function StoreHash(value, flags, ply, move, depth) {
	if (value >= maxMateBuffer)
		value += depth;
	else if (value <= minMateBuffer)
		value -= depth;
	g_hashTable[g_hashKeyLow & g_hashMask] = new HashEntry(g_hashKeyHigh, value, flags, ply, move);
}

function HashEntry(lock, value, flags, hashDepth, bestMove, globalPly) {
    this.lock = lock;
    this.value = value;
    this.flags = flags;
    this.hashDepth = hashDepth;
    this.bestMove = bestMove;
}

// Оценка хода
function ScoreMove(move){
    var moveTo = (move >> 8) & 0xFF; // Поле, куда ходит фигура
    var captured = g_board[moveTo] & 0x7; // Тип взятой фигуры противника
    var piece = g_board[move & 0xFF];// Код ходившей фигуры
    var score;
    if (captured != 0) { // Если взятие
        var pieceType = piece & 0x7; // Тип ходившей фигуры
        score = (captured << 5) - pieceType;
    } else {
        score = historyTable[piece & 0xF][moveTo];
    }
    return score;
}

//Алгоритм, рассматривающий только победившие или равные взятия
function See(move) {
    var from = move & 0xFF;
    var to = (move >> 8) & 0xFF;

    var fromPiece = g_board[from];

    var fromValue = g_seeValues[fromPiece & 0xF];
    var toValue = g_seeValues[g_board[to] & 0xF];

    if (fromValue <= toValue) {
        return true;
    }

    if (move >> 16) {
        // Castles, promotion, ep are always good
        return true;
    }

    var us = (fromPiece & colorWhite) ? colorWhite : 0;
    var them = 8 - us;

    // Pawn attacks (Пешка нападает)
    // If any opponent pawns can capture back, this capture is probably not worthwhile (as we must be using knight or above).
    // Если какие-нибудь пешки противника могут захватить обратно, это взятие вероятно не стоит
    var inc = (fromPiece & colorWhite) ? -16 : 16; // Note: this is capture direction from to, so reversed from normal move direction
    if (((g_board[to + inc + 1] & 0xF) == (piecePawn | them)) ||
        ((g_board[to + inc - 1] & 0xF) == (piecePawn | them))) {
        return false;
    }

    var themAttacks = new Array();

    // Knight attacks (Конь нападает) 
    // If any opponent knights can capture back, and the deficit we have to make up is greater than the knights value, 
    // it's not worth it.  We can capture on this square again, and the opponent doesn't have to capture back. 
    var captureDeficit = fromValue - toValue;
    SeeAddKnightAttacks(to, them, themAttacks);
    if (themAttacks.length != 0 && captureDeficit > g_seeValues[pieceKnight]) {
        return false;
    }

    // Slider attacks (Атаки дальнобойных фигур)
    g_board[from] = 0;
    for (var pieceType = pieceBishop; pieceType <= pieceQueen; pieceType++) {
        if (SeeAddSliderAttacks(to, them, themAttacks, pieceType)) {
            if (captureDeficit > g_seeValues[pieceType]) {
                g_board[from] = fromPiece;
                return false;
            }
        }
    }

    // Pawn defenses (Пешечные защиты)
    // At this point, we are sure we are making a "losing" capture.  The opponent can not capture back with a 
    // pawn.  They cannot capture back with a minor/major and stand pat either.  So, if we can capture with 
    // a pawn, it's got to be a winning or equal capture. 
    if (((g_board[to - inc + 1] & 0xF) == (piecePawn | us)) ||
        ((g_board[to - inc - 1] & 0xF) == (piecePawn | us))) {
        g_board[from] = fromPiece;
        return true;
    }

    // King attacks (Король нападает)
    SeeAddSliderAttacks(to, them, themAttacks, pieceKing);

    // Our attacks (Наши атаки)
    var usAttacks = new Array();
    SeeAddKnightAttacks(to, us, usAttacks);
    for (var pieceType = pieceBishop; pieceType <= pieceKing; pieceType++) {
        SeeAddSliderAttacks(to, us, usAttacks, pieceType);
    }

    g_board[from] = fromPiece;

    // We are currently winning the amount of material of the captured piece, time to see if the opponent 
    // can get it back somehow.  We assume the opponent can capture our current piece in this score, which 
    // simplifies the later code considerably. 
    var seeValue = toValue - fromValue;

    for (; ; ) {
        var capturingPieceValue = 1000;
        var capturingPieceIndex = -1;

        // Find the least valuable piece of the opponent that can attack the square
        // Поиск наименее ценной фигуры противника, которая может атаковать поле
        for (var i = 0; i < themAttacks.length; i++) {
            if (themAttacks[i] != 0) {
                var pieceValue = g_seeValues[g_board[themAttacks[i]] & 0x7];
                if (pieceValue < capturingPieceValue) {
                    capturingPieceValue = pieceValue;
                    capturingPieceIndex = i;
                }
            }
        }

        if (capturingPieceIndex == -1) {
            // Opponent can't capture back, we win (Противник не может взять обратно, мы победим)
            return true;
        }

        // Now, if seeValue < 0, the opponent is winning.  If even after we take their piece, 
        // we can't bring it back to 0, then we have lost this battle.
        // Теперь, если seeValue <0, противник выигрывает. Если даже после того, как мы берем их
        // фигуру, мы не можем вернуть его в 0, то мы потеряли эту битву.
        seeValue += capturingPieceValue;
        if (seeValue < 0) {
            return false;
        }

        var capturingPieceSquare = themAttacks[capturingPieceIndex];
        themAttacks[capturingPieceIndex] = 0;

        // Add any x-ray attackers
        SeeAddXrayAttack(to, capturingPieceSquare, us, usAttacks, themAttacks);

        // Our turn to capture
        capturingPieceValue = 1000;
        capturingPieceIndex = -1;

        // Find our least valuable piece that can attack the square
        // Поиск наименее ценной своей фигуры, которая может атаковать поле
        for (var i = 0; i < usAttacks.length; i++) {
            if (usAttacks[i] != 0) {
                var pieceValue = g_seeValues[g_board[usAttacks[i]] & 0x7];
                if (pieceValue < capturingPieceValue) {
                    capturingPieceValue = pieceValue;
                    capturingPieceIndex = i;
                }
            }
        }

        if (capturingPieceIndex == -1) {
            // We can't capture back, we lose :( (Мы не можем взять обратно, мы теряем)
            return false;
        }

        // Assume our opponent can capture us back, and if we are still winning, we can stand-pat 
        // here, and assume we've won. 
        // Предположим, наш противник может обратно захватить нас, и если мы по-прежнему завоевываем, мы можем 
        // стоять здесь-PAT, и предположим, что мы выиграли.
        seeValue -= capturingPieceValue;
        if (seeValue >= 0) {
            return true;
        }

        capturingPieceSquare = usAttacks[capturingPieceIndex];
        usAttacks[capturingPieceIndex] = 0;

        // Add any x-ray attackers
        SeeAddXrayAttack(to, capturingPieceSquare, us, usAttacks, themAttacks);
    }
}

// target = attacking square, us = color of knights to look for, attacks = array to add squares to
function SeeAddKnightAttacks(target, us, attacks) {
    var pieceIdx = (us | pieceKnight) << 4;
    var attackerSq = g_pieceList[pieceIdx++];

    while (attackerSq != 0) {
        if (IsSquareOnPieceLine(target, attackerSq)) {
            attacks[attacks.length] = attackerSq;
        }
        attackerSq = g_pieceList[pieceIdx++];
    }
}

function IsSquareOnPieceLine(target, from) {
    var index = from - target + 128;
    var piece = g_board[from];
    return (g_vectorDelta[index].pieceMask[(piece >> 3) & 1] & (1 << (piece & 0x7))) ? true : false;
}

function SeeAddSliderAttacks(target, us, attacks, pieceType) {
    var pieceIdx = (us | pieceType) << 4;
    var attackerSq = g_pieceList[pieceIdx++];
    var hit = false;

    while (attackerSq != 0) {
        if (IsSquareAttackableFrom(target, attackerSq)) {
            attacks[attacks.length] = attackerSq;
            hit = true;
        }
        attackerSq = g_pieceList[pieceIdx++];
    }

    return hit;
}

function SeeAddXrayAttack(target, square, us, usAttacks, themAttacks) {
    var index = square - target + 128;
    var delta = -g_vectorDelta[index].delta;
    if (delta == 0)
        return;
    square += delta;
    while (g_board[square] == 0) {
        square += delta;
    }

    if ((g_board[square] & 0x18) && IsSquareOnPieceLine(target, square)) {
        if ((g_board[square] & 8) == us) {
            usAttacks[usAttacks.length] = square;
        } else {
            themAttacks[themAttacks.length] = square;
        }
    }
}


var g_backgroundEngineValid = true;
var g_backgroundEngine;
function InitializeBackgroundEngine() {
    if (!g_backgroundEngineValid) {
        return false;
    }

    if (g_backgroundEngine == null) {
        g_backgroundEngineValid = true;
        try {
            g_backgroundEngine = new Worker("js/garbochess.js");
 //           g_backgroundEngine.postMessage(g_fen); //zzz
            g_backgroundEngine.onmessage = function (e) {
                if (e.data.match("^pv") == "pv") {
                    UpdatePVDisplay(e.data.substr(3, e.data.length - 3));
//                } else if (e.data.match("^fen") == "fen") {
//                    alert("edata="+e.data);
                } else if (e.data.match("^message") == "message") {
                    EnsureAnalysisStopped();
                    UpdatePVDisplay(e.data.substr(8, e.data.length - 8));
                } else {
                    alert("edata="+e.data);
//suggestMove[suggestMove.length]=e.data;
//alert("gMove="+suggestMove[suggestMove.length-1]);
                    UIPlayMove(GetMoveFromString(e.data), null);
                }
            }
            g_backgroundEngine.error = function (e) {
                alert("Error from background worker:" + e.message);
            }
            g_backgroundEngine.postMessage("position " + GetFen());
        } catch (error) {
            g_backgroundEngineValid = false;
        }
    }

    return g_backgroundEngineValid;
}

function GetMoveFromString(moveString) {
    var moves = GenerateValidMoves();
    for (var i = 0; i < moves.length; i++) {
        if (FormatMove(moves[i]) == moveString) {
            return moves[i];
        }
    }
    alert("busted! ->" + moveString + " fen:" + GetFen());
}

//Обновление расположения фигур на шахматной доске после хода
function UpdateFromMove(move) {
    var fromX = (move & 0xF) - 4;//Вертикаль клетки, откуда ходит фигура(0...7)
    var fromY = ((move >> 4) & 0xF) - 2;//Горизонталь клетки, откуда ходит фигура
    var toX = ((move >> 8) & 0xF) - 4;//Вертикаль клетки, куда ходит фигура
    var toY = ((move >> 12) & 0xF) - 2;//Горизонталь клетки, куда ходит фигура
    //Если играем черными
    if (!g_playerWhite) {
        fromY = 7 - fromY;
        toY = 7 - toY;
        fromX = 7 - fromX;
        toX = 7 - toX;
    }
//Перерисовка фигур в случаях: 1)рокировки; 2)взятия пешки, прошедшей через
//бойное поле пешки противника; 3)превращения проходной пешки в фигуру
    if ((move & moveflagCastleKing) ||
        (move & moveflagCastleQueen) ||
        (move & moveflagEPC) ||
        (move & moveflagPromotion)) {
        RedrawPieces();
    } else {
        var fromSquare = g_uiBoard[fromY * 8 + fromX];//Клетка, откуда ходит фигура
        $(g_uiBoard[toY * 8 + toX])//Клетка, куда ходит фигура
            .empty()//Удаление содержимого клетки доски, куда ходит фигура
            .append($(fromSquare).children());//Перемещение фигуры
    }
}

function RedrawPieces() {
    //Перерисовка фигур в случае спокойного хода или хода со взятием
    for (y = 0; y < 8; ++y) {//Цикл по горизонталям
        for (x = 0; x < 8; ++x) {//Цикл по вертикалям
            var td = g_uiBoard[y * 8 + x];//Текущая клетка доски
            var pieceY = g_playerWhite ? y : 7 - y;
            //Получение кода фигуры, находящейся в текущей клетке доски
            var piece = g_board[((pieceY + 2) * 0x10) + (g_playerWhite ? x : 7 - x) + 4];
            //Формирование имени файла с изображением фигуры
            var pieceName = null; //Очистка имени файла, содержащего изображение фигуры
            switch (piece & 0x7) {
                case piecePawn: pieceName = "pawn"; break;//Если пешка, то имя файла начинается с pawn   
                case pieceKnight: pieceName = "knight"; break;//Если конь, то имя файла начинается с knight
                case pieceBishop: pieceName = "bishop"; break;//Если слон, то имя файла начинается с bishop
                case pieceRook: pieceName = "rook"; break;//Если ладья, то имя файла начинается с rook
                case pieceQueen: pieceName = "queen"; break;//Если ферзь, то имя файла начинается с queen
                case pieceKing: pieceName = "king"; break;//Если король, то имя файла начинается с king
            }
            if (pieceName != null) {//В клетке есть фигура? 
                pieceName += "_";//Добавление к имени файла символа подчеркивания
                //Если фигура - белая, то к имени файла добавляется white, иначе black
                pieceName += (piece & 0x8) ? "white" : "black";
            }

            if (pieceName != null) {//В клетке есть фигура?
                var img = document.createElement("div");
                $(img).addClass('sprite-' + pieceName);
                img.style.backgroundImage = "url('img/sprites.png')";
                img.width = g_cellSize;
                img.height = g_cellSize;
                var divimg = document.createElement("div");
                divimg.appendChild(img);
//jQuery UI Draggable плагин позволяет перетаскивать узлы структуры DOM с помощью мыши.
//start - событие наступает с началом перемещения.
//                $(divimg).draggable({ start: function (e, ui) { ***
//                    if (g_selectedPiece === null) { ***
//                        g_selectedPiece = this; ***
                        //closest('table') - возвращает первый ближайший родительский узел
//                        var offset = $(this).closest('table').offset(); ***
//                        g_startOffset = { ***
//                            left: e.pageX - offset.left, ***
//                            top: e.pageY - offset.top ***
//                        }; ***
//                    } else { ***
//                        return g_selectedPiece == this; ***
//                    } ***
//                }}); ***

//                $(divimg).mousedown(function(e) { ***
//                    if (g_selectedPiece === null) { ***
//                        var offset = $(this).closest('table').offset(); ***
//                        g_startOffset = { ***
//                            left: e.pageX - offset.left, ***
//                            top: e.pageY - offset.top ***
//                        }; ***
//                        e.stopPropagation(); ***
//                        g_selectedPiece = this; ***
//                        g_selectedPiece.style.backgroundImage = "url('img/transpBlue50.png')"; ***
//                    } else if (g_selectedPiece === this) { ***
//                        g_selectedPiece.style.backgroundImage = null; ***
//                        g_selectedPiece = null; ***
//                    } ***
//                }); ***

                $(td).empty().append(divimg);
            } else {
                $(td).empty();
            }
        }
    }
}

function RedrawBoard() {
    var div = $("#board")[0];//возвращает объект DOM с идентификатором board
 
    var table = document.createElement("table");//Контейнер для элементов таблицы
    table.cellPadding = "0px";//Отступ от рамки до содержимого ячейки
    table.cellSpacing = "0px";//Расстояние между ячейками
    $(table).addClass('no-highlight');

    var tbody = document.createElement("tbody");//Элемент для хранения одной или
                                                //нескольких строк таблицы
    g_uiBoard = [];//Массив клеток шахматной доски
//e.pageX и e.pageY - координаты курсора мыши относительно документа
//$(table).offset().left и $(table).offset().top - координаты левого верхнего угла шахматной доски
//    var dropPiece = function (e, ui) {//Перемещение фигуры на шахматной доске.***
    //Функция принимает два аргумента – event (объект события) и ui (специальный объект, 
    //содержащий информацию о положении перемещаемого объекта)
        //endX и endY - координаты курсора мыши относительно шахматной доски
//        var endX = e.pageX - $(table).offset().left; ***
//        var endY = e.pageY - $(table).offset().top; ***
        //Вычисление индексов клетки шахматной доски, над которой находится курсор мыши
//        endX = Math.floor(endX / g_cellSize); ***
//        endY = Math.floor(endY / g_cellSize); ***

//        var startX = Math.floor(g_startOffset.left / g_cellSize); ***
//        var startY = Math.floor(g_startOffset.top / g_cellSize); ***
        //Если играем черными
//        if (!g_playerWhite) { ***
//            startY = 7 - startY; ***
//            endY = 7 - endY; ***
//            startX = 7 - startX; ***
//            endX = 7 - endX; ***
//        } ***

//        var moves = GenerateValidMoves(); ***
//        var move = null; ***
//        for (var i = 0; i < moves.length; i++) { ***
//            if ((moves[i] & 0xFF) == MakeSquare(startY, startX) && ***
//                ((moves[i] >> 8) & 0xFF) == MakeSquare(endY, endX)) { ***
//                move = moves[i]; ***
//            } ***
//        } ***
        //Если играем черными
//        if (!g_playerWhite) { ***
//            startY = 7 - startY; ***
//            endY = 7 - endY; ***
//            startX = 7 - startX; ***
//            endX = 7 - endX; ***
//        } ***

//        g_selectedPiece.style.left = 0; ***
//        g_selectedPiece.style.top = 0; ***

//        if (!(startX == endX && startY == endY) && move != null) { ***
//            UpdatePgnTextBox(move); ***

//            if (InitializeBackgroundEngine()) { ***
//                g_backgroundEngine.postMessage(FormatMove(move)); ***
//            } ***

//            g_allMoves[g_allMoves.length] = move; ***
//            MakeMove(move); ***

//            UpdateFromMove(move); //Обновление расположения фигур на шахматной доске ***

//            g_selectedPiece.style.backgroundImage = null; ***
//            g_selectedPiece = null; ***

//            var fen = GetFen();
//            document.getElementById("FenTextBox").value = fen;
//
//            setTimeout("SearchAndRedraw()", 0);
//        } else {
//            g_selectedPiece.style.backgroundImage = null;
//            g_selectedPiece = null;
//        }
//    }; ***
   
    for (y = 0; y < 8; ++y) {//Цикл по горизонталям доски
        var tr = document.createElement("tr");//Создание горизонтали доски

        for (x = 0; x < 8; ++x) {//Цикл по клеткам
            var td = document.createElement("td");//Создание клетки 
            td.style.width = g_cellSize + "px";//Ширина клетки
            td.style.height = g_cellSize + "px";//Высота клетки
            td.style.backgroundColor = ((y ^ x) & 1) ? "#D18947" : "#FFCE9E";//Цвет клетки
            tr.appendChild(td);//Добавление клетки на горизонталь
            g_uiBoard[y * 8 + x] = td;//Формирование массива клеток
        }

        tbody.appendChild(tr);//Добавление к доске горизонтали 
    }

    table.appendChild(tbody);
    //Плагин Droppable позволяет перемещаемые элементы сбрасывать в какой-либо другой элемент 
    //drop - событие наступает в момент "сброса" перемещаемого элемента в целевой
//    $('body').droppable({ drop: dropPiece }); ***
//    $(table).mousedown(function(e) { ***
//        if (g_selectedPiece !== null) {//Если выбрана фигура ***
//            dropPiece(e); ***
//        } ***
//    }); ***

    RedrawPieces();//Перерисовка фигур

    $(div).empty();
    div.appendChild(table);

//    g_changingFen = true; ***
    //Обновление Fen в текстовом поле FenTextBox
//    document.getElementById("FenTextBox").value = GetFen(); ***
 //   document.getElementById("FenTextBox").value = g_fen; ***
//    g_changingFen = false; ***
}

function GetFen(){
    var result = ""; //Инициализация Fen пустой строкой
    for (var row = 0; row < 8; row++) {//Цикл по горизонталям шахматной доски
        if (row != 0) //Не первая горизонталь?
            result += '/'; //Добавление разделителя горизонталей
        var empty = 0; //Обнуление счетчика пустых клеток горизонтали
        for (var col = 0; col < 8; col++) {//Цикл по вертикалям шахматной доски
            var piece = g_board[((row + 2) << 4) + col + 4];//Получение кода фигуры,
                                      //стоящей на клетке, находящейся на пересечении
                                      //горизонтали row и вертикали col  
            if (piece == 0) {//Клетка пустая?
                empty++; //Увеличение на 1 счетчика пустых клеток горизонтали
            }
            else {
                if (empty != 0) //Проверка счетчика
                    result += empty; //Добавление в Fen числа пустых клеток
                empty = 0;
              //Выделение из кода фигуры ее типа  
                var pieceChar = [" ", "p", "n", "b", "r", "q", "k", " "][(piece & 0x7)];
                //Добавление в Fen типа фигуры. Если фигура белая, 
                //то ее тип преобразуется в верхний регистр
                result += ((piece & colorWhite) != 0) ? pieceChar.toUpperCase() : pieceChar;
            }
        }
        if (empty != 0) {
            result += empty;
        }
    }
    //Добавление в Fen очередности хода
    result += g_toMove == colorWhite ? " w" : " b";
    result += " ";
    //Добавление в Fen прав на рокировку
    if (g_castleRights == 0) {
        result += "-";//Прав на рокировку ни у кого нет
    }
    else {
        if ((g_castleRights & 1) != 0) 
            result += "K";//Белые имеют право на короткую рокировку
        if ((g_castleRights & 2) != 0) 
            result += "Q";//Белые имеют право на длинную рокировку
        if ((g_castleRights & 4) != 0) 
            result += "k";//Черные имеют право на короткую рокировку
        if ((g_castleRights & 8) != 0) 
            result += "q";//Черные имеют право на длинную рокировку
    }
    
    result += " ";
    //Добавление в Fen кода бойного поля, через которое прошла пешка
    if (g_enPassentSquare == -1) {
        result += '-';//Пешка не проходила через бойное поле
    }
    else {
        //Пешка прошла через бойное поле 
        result += FormatSquare(g_enPassentSquare);
    }
    
    return result;
}
