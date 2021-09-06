/**
 * Predicted grade calculator
 * (c) 2021 Joseph Azrak 
 * https://josephazrak.codes/gradecalc
 *
 * I am very, very sorry for this code. Written in a hurry -- no good practice used
 * anywhere here.
 * 
 * Minified on: https://closure-compiler.appspot.com with option: // @language_out ecmascript5
 */

const VERSION = "1.6.0";
const JVERSION = "20210630ja-disa";

let ready = false; // set to true after API response is finished!
let curve;

// cookie funcs -- thanks stackoverflow ^^

function create_cookie(name, value, days) {
    var expires;

    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    } else {
        expires = "";
    }
    document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + expires + "; path=/";
}

function read_cookie(name) {
    var nameEQ = encodeURIComponent(name) + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ')
            c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0)
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function randid(l) {
    let la = ["a", "e", "i", "o", "u"];
    let lb = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "x", "y", "z"];
    let k = "";
    for (let i = 1; i < l + 1; i++) {
        if (i % 2 == 0) {
            k += la[Math.floor(Math.random() * la.length)]
        } else {
            k += lb[Math.floor(Math.random() * lb.length)]
        }
    }
    return k
}

// IBOCurve helper class
class IBOCurve {
    /**
     * An IBOCurve object's curveData parameters is an array of six integers,
     * in order of each grade bin. For example, threeMax is the maximum raw score
     * that covers a level 3.
     */
    constructor(givenCurveData) {
        this.curveData = givenCurveData;
    }

    /**
     * Returns a level achievement given a raw score.
     */
    levelFromRaw(rawScore) {
        for (let i = 0; i < this.curveData.length; i++) {
            if (this.curveData[i] >= rawScore)
                return i + 1;
        }
    }

    /**
     * Returns the ceiling raw score given an achievement level.
     */
    rawFromLevelCeil(level) {
        return this.curveData[(level - 1 >= 0 ? level - 1 : 0)];
    }

    /**
     * Given a 1-7 level, returns the lower bound. 
     */
    getLowerBoundFromLevel(level) {
        return (level - 2 >= 0 ? this.curveData[level - 2] + 1 : 0);
    }

    /** 
     * Given a 1-7 level, returns the upper bound.
     */
    getUpperBoundFromLevel(level) {
        return this.curveData[level - 1];
    }

    /**
     * Returns human-readable string like 35->40 that describes
     * the grade boundary for a specific achievement level.
     */
    getLevelRangeString(level, percentify = false) {
        return this.getLowerBoundFromLevel(level) + (percentify ? "%" : "") + "→" + this.getUpperBoundFromLevel(level) + (percentify ? "%" : "");
    }

    /**
     * Returns the maximum score in this curve.
     */
    get max() {
        return this.curveData[this.curveData.length - 1];
    }
}

function fetchCurveDataNow() {
    fetch('api/get_curve_data_v2.php?rand=' + Math.random().toString(36).substring(7) + "&jv=" + JVERSION) // anti-cache
        .then(response => response.json())
        .then(data => {
            curve = data;
        })
        .then(() => {
            ready = true;
            console.log("Received curve data")
        })
        .then(() => {
            $("#btn-calc")['text']("Calculate")['removeAttr']("disabled")
        });
}

var gradeColorDefinitions = [
    "danger", // level 1 --
    "danger", // level 2   \
    "warning", // level 3   |
    "warning", // level 4   |-- subjective !
    "success", // level 5   |
    "success", // level 6   /
    "primary", // level 7 --
]

function appendLog(text, muted = true) {
    var $obj = $("<p class='text-center" + (muted ? " text-muted" : "") + "'></p>");
    $obj['text'](text);

    $obj['appendTo']($("#log-section"));
}

function appendLogHtml(html) {
    var $obj = $(html);
    $obj['appendTo']($("#log-section"));
}

function appendFinalLog(textTemplate, grade, bg = 'primary') // %G can be used here, it will be replaced with pill-like element w/ grade param as textTemplate
{
    textTemplate = textTemplate.replace(/%G/g, '<span class="badge rounded-pill bg-' + bg + '">' + grade + '</span>');

    var $obj = $("<p class='text-center'></p>");
    $obj['html'](textTemplate);

    $obj['appendTo']($("#final-section"));
}

function getSelectedClass() {
    return $('option:selected', $("#classSelection"))['attr']('data-value');
}

function getIsHl() {
    if ($('option:selected', $("#levelSelection"))['attr']('data-value') == "__SEL-L__")
        return -1;

    return $('option:selected', $("#levelSelection"))['attr']('data-value') == "hl";
}

function checkAdditionalInfo() {
    if (!ready) return;
    if (getIsHl() === -1) return;

    try {
        let selectedClass = getSelectedClass();
        let hlChecked = getIsHl();

        if ("_note" in curve[selectedClass][(hlChecked ? "hl" : "sl")])
            alert(curve[selectedClass][(hlChecked ? "hl" : "sl")]["_note"]);

        $("#cw")['attr']("placeholder", `RAW Coursework / IA (/${curve[selectedClass][(hlChecked ? "hl" : "sl")]['iaMax']})`);
    } catch (e) {}
}

function calculate() {
    let selectedClass = getSelectedClass();
    let predictedGrade = parseInt($('#pg')['val']());
    let rawIaMark = parseInt($('#cw')['val']());
    let hlChecked = getIsHl();

    if (selectedClass == "" || selectedClass == "__SEL__") {
        alert("Please select a subject");
        return;
    }

    if (!(selectedClass in curve)) {
        alert("Sorry, for some reason this class could not be found in the database :( this should not happen, try refreshing");
        return;
    }

    if (hlChecked === -1) {
        alert("Please select the level at which you are taking this subject");
        return;
    }

    if (predictedGrade > 7 || predictedGrade < 1 || isNaN(predictedGrade)) {
        alert("Invalid predicted grade! The number should range from 1 to 7");
        return;
    }

    if (rawIaMark > curve[selectedClass][(hlChecked ? "hl" : "sl")]["iaMax"] || rawIaMark < 1 || isNaN(rawIaMark)) {
        alert("Invalid raw IA mark! The number should range from 1 to " + curve[selectedClass][(hlChecked ? "hl" : "sl")]["iaMax"]);
        return;
    }

    if (rawIaMark <= 7)
        alert("HOLD ON! It looks like you -might- have input a 1-7 grade for your IA. Remember that the IA field expects a raw score. Going forward assuming you scored " + rawIaMark + " raw mark(s).");

    fetch("api/get_estimate.php?code=" + selectedClass + "&lvl=" + (hlChecked ? "hl" : "sl") + "&pg=" + predictedGrade + "&ia=" + rawIaMark + "&jv=" + JVERSION)
        .then((result) => { /* nvm - we'll do local processing */ });

    let subjectCurves = curve[selectedClass][(hlChecked ? "hl" : "sl")];
    let hasPaper1 = ("p1" in subjectCurves);
    let hasPaper2 = ("p2" in subjectCurves);
    let hasPaper3 = ("p3" in subjectCurves);

    // calculate an IA percentage
    let iaPercentage = (rawIaMark / subjectCurves["iaMax"]) * 100;

    // calculate paper 1 and paper 2 rawmarks, then percentage
    let p1Rawmark = -1;
    let p2Rawmark = -1;
    let p3Rawmark = -1;

    // Check if this specific course has a paper 3, and so do the same thing
    if (hasPaper3)
        p3Rawmark = new IBOCurve(subjectCurves["p3"]).rawFromLevelCeil(predictedGrade);

    if (hasPaper2)
        p2Rawmark = new IBOCurve(subjectCurves["p2"]).rawFromLevelCeil(predictedGrade);

    if (hasPaper1)
        p1Rawmark = new IBOCurve(subjectCurves["p1"]).rawFromLevelCeil(predictedGrade);

    // Do some fucking shit
    let paperPercentage = (
        (hasPaper1 ? p1Rawmark : 0) +
        (hasPaper2 ? p2Rawmark : 0) +
        (hasPaper3 ? p3Rawmark : 0)
    ) / (
        (hasPaper1 ? new IBOCurve(subjectCurves["p1"]).max : 0) +
        (hasPaper2 ? new IBOCurve(subjectCurves["p2"]).max : 0) +
        (hasPaper3 ? new IBOCurve(subjectCurves["p3"]).max : 0)
    ) * 100;

    // determine the IA weighting and the PG weighting for this subject
    let iaWeight = subjectCurves["iaWeight"];
    let paperWeight = 1 - iaWeight;

    // calculate the weighted sum given IBO weightings for this subject (m21-modified weights)
    let weighted = iaPercentage * iaWeight + paperPercentage * paperWeight;

    // weighted score -> level w/ overall curve
    let level = new IBOCurve(subjectCurves["overall"]).levelFromRaw(weighted);

    $("#btn-calc")['html']("Re-calculate grade");
    $("#log-section")['html'](""); // UGLINESS COMING!
    $("#final-section")['html']("");

    appendLog("Here is what happened during this calculation:");
    appendLog("IA percentage calculated as " + iaPercentage.toFixed(2) + "%");
    appendLog("Calculated raw-mark: P1=" + (hasPaper1 ? p1Rawmark : "n/a") + " P2=" + (hasPaper2 ? p2Rawmark : "n/a") + " P3=" + (hasPaper3 ? p3Rawmark : "n/a"));
    appendLog("Calculated overall PG (R-up) percentage: " + paperPercentage.toFixed(2) + "%");
    appendLog("IBO specified the following weightings for your course: " + (iaWeight * 100).toFixed(0) + "% IA, " + (paperWeight * 100).toFixed(0) + "% PG...");
    appendLog("Weighted final: " + weighted.toFixed(2) + "% -> level " + level + " given the curve: " + subjectCurves['_source']);
    appendLogHtml(`<div style="overflow-x: auto;overflow-y: hidden;white-space: nowrap;"><img src="IBOM21.svg"></div>`);

    appendFinalLog("You are projected to receive a non-exam diploma grade of around %G.", level, gradeColorDefinitions[parseInt(level) - 1]);
    appendFinalLog(`The \"overall percentage\" you would internally receive is ${weighted.toFixed(2)}%. The grade boundary for level %G is ${new IBOCurve(subjectCurves["overall"]).getLevelRangeString(level, true)}.`, level, gradeColorDefinitions[parseInt(level) - 1]);

    // Close-call detection

    let lower_delta = Math.abs((new IBOCurve(subjectCurves["overall"]).getLowerBoundFromLevel(level)) - weighted);
    let upper_delta = Math.abs((new IBOCurve(subjectCurves["overall"]).getUpperBoundFromLevel(level)) - weighted);

    if (lower_delta <= 3.00 && level > 1) {
        appendFinalLog(`<span class="badge rounded-pill bg-warning">HEY!</span> Looks like this is a close call. You are just ${lower_delta.toFixed(2)}% away from scoring %G. Expect those two possibilities.`, level - 1, gradeColorDefinitions[parseInt(level - 1) - 1])
    }

    if (upper_delta <= 3.00 && level < 7) {
        appendFinalLog(`<span class="badge rounded-pill bg-warning">HEY!</span> Looks like this is a close call. You are just ${upper_delta.toFixed(2)}% away from scoring %G. Expect those two possibilities.`, level + 1, gradeColorDefinitions[parseInt(level + 1) - 1])
    }

    $("#calc-result")['fadeIn']();
    document.getElementById("final-section").scrollIntoView();
}

function onready() {
    fetchCurveDataNow();
    $('#btn-calc')['click'](() => {
        if (ready) {
            calculate();
        }
    });
    $('#btn-request')['click'](() => {
        let rq = prompt("Write something nice here! ");

        if (rq && rq !== "")
            fetch("api/request.php?req=" + btoa(rq))
            .then(response => response['text']())
            .then((res) => {
                alert(res);
            });
    });

    $("#header-text")['text']($("#header-text")['text']() + ` (v${VERSION})`);
    $("#news")["html"]("After serving " + window.__acount + " calculations, gradecalc is now obsolete. It will no longer receive updates. I hope it helped some of you remain calm about your upcoming results :)<br>Access your results on <a href='https://candidates.ibo.org'>candidates.ibo.org</a>.");
    $("#classSelection")['change'](checkAdditionalInfo);
    $("#levelSelection")['change'](checkAdditionalInfo);

    setTimeout(() => {
        if (read_cookie("dontrenew") == "Yes") return false;
        window.location.href = window.location.pathname + "?renew";
    }, 5 * 60 * 1000);

    if (!read_cookie("urid"))
        create_cookie("urid", "A_" + randid(10), 365);

    if (read_cookie("urid").substring(0, 2) !== "A_")
        create_cookie("urid", "A_" + randid(10), 365);

    $("#exam_student_info")['click'](() => {
        alert("Hope your exams went well. This calculator isn't so useful for exam route students since it's usually harder to predict your exam grade than your predicted grade. In case you have an idea, though, or if you just want to play around—put an exam grade from 1-7 instead of a predicted grade in the PG field :)");
    });
}

$(document)['ready'](onready);