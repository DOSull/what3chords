"use strict";
const WEB_MERC_LIMIT = 85.051129;

const USE_H3 = true;
const N_CHORDS_H3 = 2141;
const H3_RES = 10;
let H3_CODE = {
  prefix: null,
  suffix: null,
  lastSigBit: 19 + 3 * H3_RES,
}

// determine if a theme 'dark' or 'light' has been
// specified in the URL query string
let THEME = getThemeFromURL();
const THEMES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

// the layers the deck will include
const LAYER_LIST = {};
// their visibility - useful for update triggering though...
// not really used now there's no change in layers with zoom
const LAYER_VISIBILITY = {
  "rect": true,
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
    //var geodiv = document.getElementById('geolocate');
    //geodiv.innerHTML += `<br>Returned ${crd.longitude} ${crd.latitude}<br>`;

    MY_DECKGL.setProps({
          initialViewState: {
            longitude:  crd.longitude,
            latitude: crd.latitude,
            zoom: 13,
            transitionInterpolator: new deck.FlyToInterpolator({speed: 1.5}),
            transitionDuration: 'auto',
            onTransitionEnd: function() { setTooltip("something", 1.03 * window.innerWidth / 2, 1.03 * window.innerHeight / 2, [crd.latitude,crd.longitude]); }
          }
        }
      );
};

function GeolocationError(err){
  console.log("Attempted geolocation but failed.");
  console.warn(`ERROR(${err.code}): ${err.message}`);
  //var geodiv = document.getElementById('geolocate');
  //geodiv.innerHTML += `ERROR(${err.code}): ${err.message}`;
};

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
  $.getJSON("./data/guitar-chords.json", function(data) {
    DATA.chords = data.chords;
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
  let chordsFlattened = {};
  for (let [key, variants] of Object.entries(DATA.chords)) {
    for (let v of variants) {
      for (let i = 0; i < v.positions.length; i++) {
        // console.log(v.positions[i].midi);
        let position = v.positions[i];
        CHORDS.push({
          chord: `${v.key}${v.suffix} v${(i + 1)}`,
          midi: position.midi,
          frets: processFrets(position.frets),
          capo: processCapo(position),
          fingers: position.fingers.join(""),
        });
      }
    }
  }
}

function processFrets(fretPositions) {
  let symbols = [];
  for (let fret of fretPositions) {
    symbols.push(fret < 0 ? "X" : fret);
  }
  return symbols.join("");
}

function processCapo(posn) {
  if (posn.capo) {
    return posn.baseFret;
  } else {
    return 0;
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

    drawChord(CHORDS[codeToUse[0]], '#chord1');
    drawChord(CHORDS[codeToUse[1]], '#chord2');
    drawChord(CHORDS[codeToUse[2]], '#chord3');

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
function drawChord(c, d) {
  // s for strings
  var s = [1, 2, 3, 4, 5, 6];
  // x should be a [[string, fret], [string, fret], etc.] set
  var x = s.map(function(e, i) {
    return [e, c.frets[i]];
  });

  var chart = new svguitar.SVGuitarChord(d);
  chart.configure({
      style: 'handdrawn',
      title: c.chord
    }).chord({
      fingers: x
      // barres: [ {fromString: 6, toString: 1, fret: c.capo, text: c.capo}]

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
  let h3Code = h3.geoToH3(c[1], c[0], H3_RES);
  let decCode = h3ToDecimal(h3Code);
  let result = nBaseX(decCode, N_CHORDS_H3);
  // check the return trip:
  // let inv = inverseH3Code(result);
  // console.log(h3Code);
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
  let pow = H3_RES - 1; // not using the 10th digit in the same way
  // first 7 bits are region
  let result = parseInt(bin.slice(0, 7), 2) * (7 ** pow);
  // remaining bits untill the last three will be sliced
  // 3 at a time into base-7 digits
  let heptDigits = bin.slice(7);
  while (pow > 0) {
    pow --; // decrement the power
    // add the next 7-digit to the results
    result = result + parseInt(heptDigits.slice(0, 3), 2) * (7 ** pow);
    // move to the next digit
    heptDigits = heptDigits.slice(3);
  }
  // final bit... just use the middle one
  return 2 * result + parseInt(heptDigits[1]);
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
  // the rightmost bit is from the 10th level code
  let bits = (index % 2 == 1) ? "1" : "0";
  bits = retrieveLevel10(bits);
  index = Math.floor(index / 2);
  // next 17 bits are 7-ary digits encode as 3 bits
  for (let i = 0; i < H3_RES - 1; i++) {
    bits = ((index % 7).toString(2).padStart(3, "0")) + bits;
    index = Math.floor(index / 7);
  }
  // leftmost 7 digits are those remaining
  bits = index.toString(2).padStart(7, "0") + bits;

  // inverse any bitswapping
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
const SEVENS_FWD = [2, 5, 0, 4, 3, 1, 8, 6, 7];
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

// takes the 37 bits and scrambles the middle from 8 to 34
// by triple-bit encoded 7s
function scrambleBySevens(b, scrambler) {
  let toScramble = b.slice(7, 34);
  let result = Array(9);
  for (let res = 0; res < 9; res++) {
    result[scrambler[res]] = toScramble.slice(res * 3, (res + 1) * 3);
  }
  return b.slice(0, 7) + result.join("") + b.slice(34);
}

// ----------------------------------------
// BRING THA NOIZ
// ----------------------------------------
//const DIST = new Tone.Distortion(0.5).toMaster();

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
  for (let i = 1; i <= chords.length; i++) {
    let c = chords[i - 1];
    let vol = -3 - chords[i-1].length; //adapt volume to number of notes being played
    GUITAR.volume.value = vol;
    // 4:4 time strummed up and down, missing the strum where pattern is -
    if (i < chords.length) {
      for (let p of pattern) {
        if (p != "-") {
          strumChord(GUITAR, c, now, 0.02, 1.5 * durn);
        }
        now = now + durn * (0.9 + 0.1 * Math.random());
        c.reverse(); // to get down/up strums
      }
      now = now + 0.0;
    } else {
      // last time, just play it once
      strumChord(GUITAR, c, now, 0.01, 5 * durn);
    }
  }
}

// crude attempt to strum chord, not just play all strings at once
function strumChord (instrument, notes, now, gap, duration) {
  let t = now;
  for (let n of notes) {
    instrument.triggerAttackRelease(n, duration, t); //.connect(DIST);
    t = t + gap * (0.9 + 0.1 * Math.random());
  }
}

function notesToFreq(n) {
  return n.map(x => Tone.Midi(x).toFrequency());
}


// --------------------------------------
// THE DNA JUNKYARD
// --------------------------------------

// --------------------------------------
// Long-lat grid based approach
// --------------------------------------
//
// const LON_RES = 130400;
// const LAT_RES = 65200;
// const CAT_SHUFFLES = 15;
// const N_CHORDS_LL = 2141;
//
// // get a 3 digit sequence of 0..2140 indices into the Array of chords
// function getCode(c) {
//   // get x and y values that are integers 0..130400, 0..65200
//   let xy = [
//     Math.round(rescale(c[0], -180, 180, 0, LON_RES)),
//     Math.round(rescale(c[1], -WEB_MERC_LIMIT, WEB_MERC_LIMIT, 0, LAT_RES))
//   ];
//   // rescale to unit square
//   xy = [
//     rescale(xy[0], 0, LON_RES, 0, 1),
//     rescale(xy[1], 0, LAT_RES, 0, 1)
//   ]
//   // shuffle them
//   xy = doTheShuffle(xy, CAT_SHUFFLES);
//   // round back to ints
//   let x = Math.round(rescale(xy[0], 0, 1, 0, LON_RES));
//   let y = Math.round(rescale(xy[1], 0, 1, 0, LAT_RES));
//
//   // convert to an index
//   let i = x + y * LON_RES;
//   return nBaseX(i, N_CHORDS_LL);
// }
//
//
// // rescale x from xmin-xmax to mn-mx
// function rescale(x, xmin, xmax, mn, mx) {
//   return mn + (mx - mn) * (x - xmin) / (xmax - xmin);
// }
//
//
// // shuffle the lon lat in a unit square using Arnold's Cat, see
// // https://en.wikipedia.org/wiki/Arnold's_cat_map
// function doTheShuffle(c, n) {
//   let xy = c;
//   for (let i = 0; i < n; i ++) {
//     xy = arnoldsCat(xy);
//   }
//   return xy;
// }
//
// function arnoldsCat(xy) {
//   return [(2 * xy[0] + xy[1]) % 1, (xy[0] + xy[1]) % 1];
// }


// Competing scrambler
// a dictionary of forward bit swaps of the 34 bits from
// position 13 to position 46
// const H3_SCRAMBLE = {
//    0:  7,  1: 10,  2: 13,  3: 16,  4: 19,  5: 22,  6: 25,  7: 28,  8: 31,
//    9:  8, 10: 11, 11: 14, 12: 17, 13: 20, 14: 23, 15: 26, 16: 29, 17: 32,
//   18:  9, 19: 12, 20: 15, 21: 18, 22: 21, 23: 24, 24: 27, 25: 30, 26: 33,
//   27:  6, 28:  5, 29:  4, 30:  3, 31:  2, 32:  1, 33:  0
// };
// // inversion of the forward scrambler
// const H3_DESCRAMBLE =
//   Object.fromEntries(Object.entries(H3_SCRAMBLE).map(kv => kv.reverse()));
//
// // s: string to scramble
// // forward: use the forward scramble if true, inverse if false
// function scramble(s, forward) {
//   let n = Object.entries(H3_SCRAMBLE).map(x => x[0]);
//   if (forward) {
//     return n.map(b => s[H3_SCRAMBLE[b]]).join("");
//   } else {
//     return n.map(b => s[H3_DESCRAMBLE[b]]).join("");
//   }
// }


// --------------------------------------
// Luke's H3 bitswapper code - not level 9 compatible
// --------------------------------------
// functions bitswap and bitswapInverse exist to bridge between
// the relative spatial monotony (autocorrelation in chords)
// of just using h3 indices and the total chord randomness
// that would characterize other indices.
//
// the number and location of bits swapped determine the nature
// of the randomness added.
//
// Consider: Swapping one of the most variable (rightmost) bits
// with one of the least variable (leftmost). this increases (in most places,
// doubles) the number of first chords available locally (from 1 to 2).
// It also (in most places) halves the number of third chords that would be used
// in that locality (from ~1700 to ~850.)
//
// There is some net change in worldwide chord diversity--
// There is a reshuffling of chords with other places,
// with many localities gaining diversity (in chord 1)
// and gaining character that differentiates them from elsewhere (in chord 3.)
// However, because of the way that h3 is encoded in binary, attempting
// some bitswaps on some bitstrings would create invalid h3 strings.
// We trap those out below, disallowing those swaps, while allowing the
// rest of the swaps in the bitswap.
//
// Swapping accomplished by the array of arrays BITSWAP.
// Each array in BITSWAP contains two bit positions that should be swapped.
// This is done left-to-right for the direct transformation bitswap () and
// done right-to-left for the inverse.
//
// note tha

// var BITSWAP = [
//   [6, 3 * H3_RES - 1],
//   [12, 3 * H3_RES - 2]
// ];
//
// function swapbits(twoPosArray,bits) {
//   var newbits = bits;
//   newbits = newbits.substr(0, twoPosArray[0]) + bits.substr(twoPosArray[1],1) + newbits.substr(twoPosArray[0]+1);
//   newbits = newbits.substr(0, twoPosArray[1]) + bits.substr(twoPosArray[0],1) + newbits.substr(twoPosArray[1]+1);
//   return newbits;
// }
//
// function bitswap(bits, BITSWAPlist) {
//   var swappedbits = bits;
//   for(var currSwapPos = 0; currSwapPos < BITSWAPlist.length; currSwapPos++) {
//     var candidatebits = swapbits(BITSWAPlist[currSwapPos],swappedbits);
//     if (isValidH3Code(candidatebits)) {
//       swappedbits = candidatebits;
//     }
//   }
//   return swappedbits;
// }
//
// function bitswapInverse(bits, BITSWAPlist) {
//   return bitswap(bits, BITSWAPlist.reverse());
// }

// The makings of a more complicated H3 scrambler
// const SEVENS_FWD = [[0], [1, lshift], [2, rev], [3, rshift],
//                     [4], [5], [6], [7], [8]];
// const SEVENS_BCK = makeReverseScrambler(SEVENS_FWD);
//
// function makeReverseScrambler(fwd) {
//   let bck = Array(fwd.length);
//   for (let f = 0; f < bck.length; f++) {
//     let change = fwd[f];
//     let t = change[0];
//     bck[t] = [f];
//     if (change.length > 1) {
//       let op = change[1];
//       switch (op) {
//         case rev:
//           bck[t].push(rev);
//           break;
//         case lshift:
//           bck[t].push(rshift);
//           break;
//         default:
//           bck[t].push(lshift);
//       }
//     }
//   }
//   return bck;
// }
// function rev(s) {
//   return s.split("").reverse().join("");
// }
// function lshift(s) {
//   return s.slice(1) + s[0];
// }
// function rshift(s) {
//   return s[2] + s.slice[0, 2];
// }
