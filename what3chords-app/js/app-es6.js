"use strict";
const WEB_MERC_LIMIT = 85.051129;

const USE_H3 = true;
let N_CHORDS_H3;
const H3_RES = 15;
let H3_CODE = {
  prefix: null,
  suffix: null,
  lastSigBit: 19 + 3 * H3_RES,
}
const MIDI_NOTES = [40, 45, 50, 55, 59, 64]

// determine if a theme 'dark' or 'light' has been
// specified in the URL query string
let THEME = getThemeFromURL();
const THEMES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

// the layers the deck will include
const LAYER_LIST = {};
// their visibility - useful for update triggering though...
// not really used now there's no change in layers with zoom
const LAYER_VISIBILITY = {
  "rect": true,
  "h3": true,
};

const START_VIEW = {
  latitude: 0,
  longitude: 0,
  zoom: 2,
  maxZoom: 23,
  minZoom: 1,
  pitch: 0,
  bearing: 0,
  pickingRadius: 3,
}

// initialise the deck
const MY_DECKGL = new deck.DeckGL({
  mapStyle: THEMES[THEME],
  initialViewState: START_VIEW,
  controller: true,
  useDevicePixels: false,
  onViewStateChange: ({viewState}) => {
    render();
  },
});

// retrieve the theme 'dark' or 'light' from the URL
// query string - defaults to 'dark'
function getThemeFromURL() {
  let thisURL = window.location.href;
  if (thisURL.includes("?")) {
    return thisURL.split("?").slice(-1)[0].split("=").slice(-1)[0];
  }
  return "light";
}

// Not very smart... just reload the page with theme in the query string
function switchTheme() {
  THEME = (THEME == "dark") ? "light" : "dark";
  window.location = window.location.href.split("?")[0] + `?theme=${THEME}`;
}

// -----------------------------------
// Geocoding stuff
// -----------------------------------
function GetMyLocationSong(pos) {
  var crd = pos.coords;
  console.log("Found geolocation. ",crd.longitude," ",crd.latitude);

  MY_DECKGL.setProps({
    initialViewState: {
      longitude: crd.longitude,
      latitude: crd.latitude,
      zoom: 13,
      transitionInterpolator: new deck.FlyToInterpolator({speed: 1.5}),
      transitionDuration: 'auto',
      onTransitionEnd: function() {
        setTooltip(
          "something",
          1.03 * window.innerWidth / 2,
          1.03 * window.innerHeight / 2,
          [crd.latitude,crd.longitude]
        );
      }
    }
  });
}

function GeolocationError(err){
  console.log("Attempted geolocation but failed.");
  console.warn(`ERROR(${err.code}): ${err.message}`);
}

function ClickGeolocator() {
  console.log("Attempting to get geolocation.")
  var options = {
    enableHighAccuracy: true,
    timeout: 1000,
    maximumAge: 0
  };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(GetMyLocationSong,GeolocationError, options);
  }
  else {
    console.warn("No geolocation support on this browser.")
  }
}

document.getElementById("geolocate").addEventListener("click", ClickGeolocator);

// fire up the loading spinner
document.getElementById("loaderDiv").style.display = "block";

// get the data
const DATA = {};
let GUITAR;

$.when(
  $.getJSON("./data/chords-compressed.json", function(data) {
    DATA.chords = data;
    console.log(DATA.chords);
  }),
  getSamples(),
  $.getJSON("./data/rect.geojson", function(data) {
    DATA.rect = data.features;
    console.log(DATA.rect);
  })
).done( function() {
  clearLoader(); // clear the spinner
  GUITAR.toMaster(); // ??
  processChordsData();
  render();
});


function getSamples() {
  // passing a single instrument name loads one instrument and returns the tone.js object
  GUITAR = new Tone.Sampler({
    'A3': './data/guitar-electric/A1.mp3',
    'A#4': './data/guitar-electric/As2.mp3',
    'B4': './data/guitar-electric/B2.mp3',
    'C4': './data/guitar-electric/C2.mp3',
    'D4': './data/guitar-electric/D2.mp3',
    'D5': './data/guitar-electric/D3.mp3',
    'E3': './data/guitar-electric/E1.mp3',
    'E5': './data/guitar-electric/E3.mp3',
    'F4': './data/guitar-electric/F2.mp3',
    'G3': './data/guitar-electric/G1.mp3',
    'G4': './data/guitar-electric/G2.mp3',
    'G5': './data/guitar-electric/G3.mp3',
  });
  GUITAR.toMaster();
  console.log(GUITAR);
  document.body.append(GUITAR); // could this fix the iOS problem?
}

let CHORDS = [];
function processChordsData() {
  for (let [key, variants] of Object.entries(DATA.chords)) {
    // let v = 1;
    for (let variant of variants) {
      let p = variant.positions.reverse();
      CHORDS.push({
        chord: `${key}`, // v${v}`,
        frets: processFrets(p),
        midi: getNotes(p),
        barres: getBarre(p),
        position: getMinStoppedFret(p),
      });
      // v++;
    }
  }
  N_CHORDS_H3 = CHORDS.length;
}

function getNotes(posn) {
  let midi = [];
  for (let i = 0; i < posn.length; i++) {
    midi.push(posn[i] >= 0 ? posn[i] + MIDI_NOTES[i] : null);
  }
  return midi;
}

function processFrets(posn) {
  let minFret = getMinStoppedFret(posn)
  let strings = [1, 2, 3, 4, 5, 6];
  return strings.map(
    i => posn[i - 1] < 0 ?
          [i, "x"] :
          [i, posn[i - 1] - minFret + 1]
  );
}

function getMinFret(posn) {
  return Math.min.apply(Math, posn.filter(x => x >= 0));
}

function getMinStoppedFret(posn) {
  return Math.min.apply(Math, posn.filter(x => x > 0));
}

function getBarre(posn) {
  let minStopped = getMinStoppedFret(posn);
  let idx = posn.indexOf(minStopped);
  let matches = [];
  while (idx != -1) {
    matches.push(idx);
    idx = posn.indexOf(minStopped, idx + 1);
  }
  if (matches.length == 1) {
    return [];
  } else {
    return [
      {
        fret: 1,
        fromString: Math.max.apply(Math, matches) + 1,
        toString: Math.min.apply(Math, matches) + 1,
      }
    ]
  }
}

// shut down the loading spinner
function clearLoader() {
  document.getElementById("loaderDiv").style.display = "none";
}

// this is the core deck functionality
function render() {
  LAYER_LIST.rect = new deck.GeoJsonLayer({
    id: "rect-layer",
    data: DATA.rect,
    getPolygon: x => x.geometry,
    stroked: true,
    getLineColor: [0, 0, 0, 102],
    getLineWidth: 1,
    lineWidthUnits: "pixels",
    getFillColor: [0, 0, 0, 0],
    pickable: true,
    onClick: info => setTooltip(info.object, info.x, info.y, info.coordinate),
    visible: LAYER_VISIBILITY.rect,
  });
  MY_DECKGL.setProps({
    layers: Object.values(LAYER_LIST),
  });
};

var chartSelectors = ["#chord1","#chord2","#chord3"];
var charts = [0,1,2].map(i => new svguitar.SVGuitarChord(chartSelectors[i]));

// build the tooltip
function setTooltip(object, x, y, c) {
  let el = document.getElementById("tooltip");
  if (object) {
    // This makes a H3 hex and puts it in the console but
    // no idea how to inject it into a layer
    // let hex = h3.h3ToGeoBoundary(h3.geoToH3(c[1], c[0], H3_RES));
    let h3c = getH3Code(c);
    // let abc = getCode(c);
    // let codeToUse =  USE_H3 ? h3c : abc;
    let codeToUse =  h3c;
    // console.log(`LatLon code: ${abc} H3 code: ${h3c}`);
    // el.innerHTML =
    //   `<table>
    //   <tr><td>Chord</td><td>Frets</td><td>Capo</td><td>Fingers</td></tr>
    //   ${getChordTableRow(CHORDS[codeToUse[0]])}
    //   ${getChordTableRow(CHORDS[codeToUse[1]])}
    //   ${getChordTableRow(CHORDS[codeToUse[2]])}
    //   <tr><td>H3</td><td colspan="3">${h3.geoToH3(c[1], c[0], H3_RES)}</td></tr>
    //   </table>`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = "visible";
    el.style.display = "block";

    // yes, this should be one call and not manually take parameters and... punkrock

    drawChord(CHORDS[codeToUse[0]], charts[0]);
    drawChord(CHORDS[codeToUse[1]], charts[1]);
    drawChord(CHORDS[codeToUse[2]], charts[2]);
    chartSelectors.map(function(chartSelector) {
          $(chartSelector).find("text").each(function() {
            $(this).text($(this).text().replace('fr', ''));
          }
        )
      }
    )
    playChord(CHORDS[codeToUse[0]].midi,
              CHORDS[codeToUse[1]].midi,
              CHORDS[codeToUse[2]].midi);
    // el.style.display = "none";
  } else {
    el.style.visibility = "hidden";
    el.style.display = "none";
  }
}

// itshappening.gif
function drawChord(c, chart) {
  // s for strings
  var s = [1, 2, 3, 4, 5, 6];

  chart.chord({
    fingers: c.frets,
    barres: c.barres, //[]
  }).configure({
    style: 'handdrawn',    // HANDDRAWN DOESNT WORK AT THE MOMENT
    title: c.chord, //replace('fr', ''),
    position: c.position,
    fixedDiagramPosition: true,
    fretLabelFontSize: 72,
  }).draw();
}

function getChordTableRow(c) {
  return `<tr>
  <td>${c.chord}</td>
  <td>${c.frets}</td>
  <td>${c.capo}</td>
  <td>${c.fingers}</td>
  </tr>`;
}


function isValidH3Code(bits) {
  // returns false if provided bits are an invalid h3 code, true otherwise
  // check first seven bits are valid h3 region codes between 0-121
  var regionCode = parseInt(bits.slice(0, 7), 2);
  if ((regionCode) < 0 || (regionCode) > 121) {
    return false
  };
  for (let res = 8; res < bits.length; res += 3) {
  // for (let res = 1; res <= H3_RES; res++) {
    if (parseInt(bits.slice(res, res + 3), 2) == 7) {
    // if (parseInt(bits.slice((res - 1) * 3 + 8, (res) * 3 + 8), 2) == 7) {
      return false
    }
  }
  return true;
}

function getH3Code(c) {
  // use the homebrew base X function to convert the decimal
  // H3 index into base 1692 to index into the chord array
  let h3Code = h3.latLngToCell(c[1], c[0], H3_RES);
  // console.log(h3Code);
  let decCode = h3ToDecimal(h3Code);
  // console.log(decCode);
  let result = nBaseX(decCode, N_CHORDS_H3);
  // check the return trip:
  let inv = inverseH3Code(result);
  // console.log(inv);
  return result;
}

// idx is the raw 64 bit H3 level H3_RES index
// we need bits 12 to 49
// first 7 bits are high level 'region'
// next 27 are 9 7-ary binary encoded indices down the H3 hierarchy
// last 3 are the 10th digit, but only one bit of that will be used
// see: https://h3geo.org/docs/core-library/h3indexing
function h3ToDecimal(idx) {
  // first left pad to 16 digits with 0s
  // not doing so causes all kinds of hell...
  let idxPad = idx.padStart(16, 0);
  // chop into 4 xbit pieces to avoid any issues with overflow in parseInt
  let bin = parseInt(idxPad.slice(0, 4), 16).toString(2).padStart(16, "0") +
            parseInt(idxPad.slice(4, 8), 16).toString(2).padStart(16, "0") +
            parseInt(idxPad.slice(8, 12), 16).toString(2).padStart(16, "0") +
            parseInt(idxPad.slice(12), 16).toString(2).padStart(16, "0");
  H3_CODE.prefix = bin.slice(0, 12); // keep this for the reassembly
  H3_CODE.suffix = bin.slice(H3_CODE.lastSigBit);
  // extract the bits we need -- 37 of these
  bin = bin.slice(12, H3_CODE.lastSigBit);

  // do any bitswapping
  bin = scrambleBySevens(bin, SEVENS_FWD);
  // bin = bitswap(bin, BITSWAP);

  // the power of 7 we are currently working on
  // let pow = H3_RES - 1; // not using the 10th digit in the same way
  let pow = H3_RES;
  // first 7 bits are region
  let result = parseInt(bin.slice(0, 7), 2) * (7 ** pow);
  // remaining bits untill the last three will be sliced
  // 3 at a time into base-7 digits
  let heptDigits = bin.slice(7);
  // while (pow > 0) {
  while (pow > 0) {
    pow --; // decrement the power
    // add the next 7-digit to the results
    result = result + parseInt(heptDigits.slice(0, 3), 2) * (7 ** pow);
    // move to the next digit
    heptDigits = heptDigits.slice(3);
  }
  // final bit... just use the middle one
  return result;
  // return 2 * result + parseInt(heptDigits[1]);
}

function nBaseX(n, x, alphabet) {
  let result = [];
  let digitsRequired = Math.floor(Math.log(n) / Math.log(x)) + 1;
  let q = n;
  for (let i = 0; i < digitsRequired; i++) {
    result.unshift(q % x);
    q = Math.floor(q / x);
  }
  // console.log(result);
  if (alphabet) {
    return result.map(digit => alphabet[digit]).join("");
  } else {
    return result;
  }
}

// recover the 37 bits of the H3 code that index level H3_RES
// starting from the 3 chord array indices
function inverseH3Code(c3) {
  // retrieve the decimal index
  let index = c3[0] * N_CHORDS_H3 * N_CHORDS_H3 + c3[1] * N_CHORDS_H3 + c3[2];
  let bits = "";
  // next 45 bits are 7-ary digits encode as 3 bits
  for (let i = 0; i < H3_RES; i++) {
    bits = ((index % 7).toString(2).padStart(3, "0")) + bits;
    index = Math.floor(index / 7);
  }
  // leftmost 7 digits are those remaining
  bits = index.toString(2).padStart(7, "0") + bits;

  // invert any bitswapping
  bits = scrambleBySevens(bits, SEVENS_BCK);
  // return bitswapInverse(bits,BITSWAP);
  bits = H3_CODE.prefix + bits + H3_CODE.suffix;
  return parseInt(bits.slice(0, 16), 2).toString(16) +
         parseInt(bits.slice(16, 32), 2).toString(16).padStart(4, "0") +
         parseInt(bits.slice(32, 48), 2).toString(16).padStart(4, "0") +
         parseInt(bits.slice(48), 2).toString(16).padStart(4, "0");
}

// if middle bit is a 0 then
// options are 000 001 100 101
// if a 1 then 010 011 110
const extraLevel10Bits = {
  "0": ["000", "001", "100", "101"],
  "1": ["010", "011", "110"],
}
function retrieveLevel10(b) {
  return randomChoice(extraLevel10Bits[b]);
}
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}


// This is simple for now
// Could add reverse in place option by coding 1: -1
// although this would make constructing the BCK
// coder a bit trickier
// const SEVENS_FWD = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
const SEVENS_FWD = [0,5,10,1,6,11,2,7,12,3,8,13,4,9,14];
const SEVENS_BCK = makeInverseScrambler(SEVENS_FWD);

// better to make this a function to avoid making a global scope loop counter
function makeInverseScrambler(fwd) {
  let bck = Array(fwd.length);
  for (let from = 0; from < bck.length; from++) {
    let to = fwd[from]
    bck[to] = from;
  }
  return bck;
}

// scrambles from bit 8 of supplied
// by triple-bit encoded 7s
function scrambleBySevens(b, scrambler) {
  let toScramble = b.slice(7);
  let result = Array(H3_RES);
  for (let res = 0; res < H3_RES; res++) {
    result[scrambler[res]] = toScramble.slice(res * 3, (res + 1) * 3);
  }
  return b.slice(0, 7) + result.join("");
}

// ----------------------------------------
// BRING THA NOIZ
// ----------------------------------------
//const DIST = new Tone.Distortion(0.5).toMaster();
const REVERB = new Tone.Reverb().toMaster();

function playChord(notes1, notes2, notes3) {
  let chords = [];
  chords.push(notes1.map(x => Tone.Midi(x).toNote()));
  chords.push(notes2.map(x => Tone.Midi(x).toNote()));
  chords.push(notes3.map(x => Tone.Midi(x).toNote()));
  chords.push(notes1.map(x => Tone.Midi(x).toNote()));

  let now = Tone.now()
  let bpm = 180;
  let durn = 0.5 * 60 / bpm;
  // see https://en.wikipedia.org/wiki/Strum#Strumming_patterns
  // and https://rockguitaruniverse.com/guitar-strumming-patterns/#The_Ramones_Pattern
  let pattern = "dudud-d-";
  for (let bar = 1; bar <= chords.length; bar++) {
    let theChord = chords[bar - 1];
    let vol = -theChord.length; //adapt vol to num notes in the chord
    GUITAR.volume.value = vol;
    // 4:4 time strummed up and down, missing strum where pattern is -
    if (bar < chords.length) {
      for (let p of pattern) {
        if (p != "-") {
          strumChord(GUITAR, theChord, now, 0.02, 1.5 * durn, false);
        }
        now = now + durn * randomBetween(0.95, 1.05);
        theChord.reverse(); // to get down/up strums
      }
      now = now + 0.0;
    } else {
      // last time, just play it once
      strumChord(GUITAR, theChord, now, 0.01, 5 * durn, true);
    }
  }
}

// crude attempt to strum chord, not just play all strings at once
function strumChord (instrument, notes, now, gap, duration, reverb) {
  let t = now;
  for (let n of notes) {
    if (reverb) {
      instrument.triggerAttackRelease(n, duration, t).connect(REVERB);
    } else {
      instrument.triggerAttackRelease(n, duration, t); //.connect(DIST);
    }
    t = t + gap * randomBetween(0.95, 1.05);
  }
}

function randomBetween(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function notesToFreq(n) {
  return n.map(x => Tone.Midi(x).toFrequency());
}

