"use strict";

// Perf TODO:
// Merge material updating with psq values
// Put move scoring inline in generator
// Remove need for fliptable in psq tables.  Access them by color
// Optimize pawn move generation

// Non-perf todo:
// Checks in first q?
// Pawn eval.
// Better king evaluation
// Better move sorting in PV nodes (especially root)


//var z100="8/7B/8/6p1/6k1/8/1Q3K2/8 w - -";
//var z100;



function PawnEval(color) {
    var pieceIdx = (color | 1) << 4;
    var from = g_pieceList[pieceIdx++];
    while (from != 0) {
        from = g_pieceList[pieceIdx++];
    }
} 

var needsReset = true;
self.onmessage = function (e) {
//    if (e.data == "go" || needsReset) {
//        ResetGame();
//        needsReset = false;
//        if (e.data == "go") return;
//    }

//    } else if (e.data.match("^fen") == "fen") {
    if (e.data.match("^position") == "position") {
        ResetGame();
        var result = InitializeFromFen(e.data.substr(9, e.data.length - 9));
        if (result.length != 0) {
            postMessage("message " + result);
        }
    } else if (e.data.match("^search") == "search") {
        g_timeout = parseInt(e.data.substr(7, e.data.length - 7), 10);
        Search(FinishMoveLocalTesting, 99, FinishPlyCallback);
    } else if (e.data == "analyze") {
        g_timeout = 99999999999;
        Search(null, 99, FinishPlyCallback);
    } else {
        MakeMove(GetMoveFromString(e.data));
    }
}
