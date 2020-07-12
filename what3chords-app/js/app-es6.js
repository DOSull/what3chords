"use strict";

const WEB_MERC_LIMIT = 85.051129;

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
  return "dark";
}

// Not very smart... just reload the page with theme in the query string
function switchTheme() {
  THEME = (THEME == "dark") ? "light" : "dark";
  window.location = window.location.href.split("?")[0] + `?theme=${THEME}`;
}


function GetMyLocationSong(pos) {
    var crd = pos.coords;
    console.log("Found geolocation. ",crd.longitude," ",crd.latitude);

    var geodiv = document.getElementById('geolocate');
    geodiv.innerHTML += `<br>Returned ${crd.longitude} ${crd.latitude}<br>`;
    //alert(`Returned ${crd.longitude} ${crd.latitude}`)

    MY_DECKGL.viewState = {
      longitude: crd.longitude,
      latitude: crd.latitude,
      zoom: 12,
      transitionDuration: 3000
    };
};

function GeolocationError(err){
  console.log("Attempted geolocation but failed.");
  console.warn(`ERROR(${err.code}): ${err.message}`);

  var geodiv = document.getElementById('geolocate');
  geodiv.innerHTML += `ERROR(${err.code}): ${err.message}`;
};

function ClickGeolocator() {
  console.log("Attempting to get geolocation.")
  var options = {
    enableHighAccuracy: true,
    timeout: 1000,
    maximumAge: 1000
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
  GUITAR = SampleLibrary.load({
    baseUrl: "./data/",
    instruments: "guitar-electric",
    curve: "linear",
  });
  GUITAR.toMaster();
  console.log(GUITAR);
  document.body.append(GUITAR); // could this fix the iOS problem?
}


// let ALL_THE_NOTES = {};
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
        // for (let n of v.positions[i].midi) {
        //   if (ALL_THE_NOTES[n]) {
        //     ALL_THE_NOTES[n] = ALL_THE_NOTES[n] + 1;
        //   } else {
        //     ALL_THE_NOTES[n] = 1;
        //   }
        // }
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
    // autoHighlight: true,
    pickable: true,
    // highlightColor: d => [0, 0, 255, 50],
    onClick: info => setTooltip(info.object, info.x, info.y, info.coordinate),
    visible: LAYER_VISIBILITY.rect,
  });

  MY_DECKGL.setProps({
    layers: Object.values(LAYER_LIST),
  });
};


function setTooltip(object, x, y, c) {
  let el = document.getElementById("tooltip");
  if (object) {
    // testing getting the H3 index for possible later extension
    let h3c = getH3Code(c);
    let abc = getCode(c);
    console.log(`LatLon code: ${abc} H3 code: ${h3c}`);
    el.innerHTML =
      `<table>
      <tr><td>Chord</td><td>Frets</td><td>Capo</td><td>Fingers</td></tr>
      ${getChordTableRow(CHORDS[abc[0]])}
      ${getChordTableRow(CHORDS[abc[1]])}
      ${getChordTableRow(CHORDS[abc[2]])}
      <tr><td>H3</td><td colspan="3">${h3.geoToH3(c[1], c[0], 15)}</td></tr>
      </table>`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = "visible";
    el.style.display = "block";

    playChord(CHORDS[abc[0]].midi,CHORDS[abc[1]].midi,CHORDS[abc[2]].midi);
    // el.style.display = "none";
  } else {
    el.style.visibility = "hidden";
    el.style.display = "none";
  }
}

function getChordTableRow(c) {
  return `<tr>
  <td>${c.chord}</td>
  <td>${c.frets}</td>
  <td>${c.capo}</td>
  <td>${c.fingers}</td>
  </tr>`;
}

function getH3Code(c) {
  // use the homebrew base X function to convert the decimal
  // H3 index into base 1692 to index into the chord array
  return nBaseX(h3ToDecimal(h3.geoToH3(c[1], c[0], 15)), 1692);
}


// idx is the raw 64 bit H3 level 9 index
// we need bits 12 to 46
// first 7 bits are high level 'region'
// the remaining 27 bits are 9 sets of base 7 hierarchical indexing
function h3ToDecimal(idx) {
  let bin = parseInt(idx.slice(0, 4), 16).toString(2) +
            parseInt(idx.slice(4, 8), 16).toString(2) +
            parseInt(idx.slice(8, 12), 16).toString(2) +
            parseInt(idx.slice(12), 16).toString(2);
  // extract the bits we need
  bin = bin.slice(12, 46);
  // the power of 7 we are currently working on
  let pow = 9;
  // first 7 bits are region
  let result = parseInt(bin.slice(0, 7), 2) * (7 ** pow);
  // remaining bits will be sliced 3 at a time into base-7 digits
  let heptDigits = bin.slice(7);
  while (pow > 0) {
    pow--; // decrement the power
    // add the next 7-digit to the results
    result = result + parseInt(heptDigits.slice(0, 3), 2) * (7 ** pow);
    // move to the next digit
    heptDigits = heptDigits.slice(3);
  }
  return result;
}


// get a 3 digit sequence of 0..2040 indices into the Array of chords
function getCode(c) {
  // get x and y values that are integers 0..130400, 0..65200
  let xy = [
    Math.round(rescale(c[0], -180, 180, 0, 130400)),
    Math.round(rescale(c[1], -WEB_MERC_LIMIT, WEB_MERC_LIMIT, 0, 65200))
  ];
  // rescale to unit square
  xy = [
    rescale(xy[0], 0, 130400, 0, 1),
    rescale(xy[1], 0, 65200, 0, 1)
  ]
  // shuffle them
  xy = doTheShuffle(xy);
  // round back to ints
  let x = Math.round(rescale(xy[0], 0, 1, 0, 130400));
  let y = Math.round(rescale(xy[1], 0, 1, 0, 65200));

  // convert to an index
  let i = x + y * 130400;
  return nBaseX(i, 2041);
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
    return result.map(i => alphabet[i]).join("");
  } else {
    return result;
  }
}

// rescale x from xmin-xmax to mn-mx
function rescale(x, xmin, xmax, mn, mx) {
  return mn + (mx - mn) * (x - xmin) / (xmax - xmin);
}


// shuffle the lon lat in a unit square using Arnold's Cat, see
// https://en.wikipedia.org/wiki/Arnold's_cat_map
function doTheShuffle(c) {
  let xy = c;
  for (let i = 0; i < 15; i ++) {
    xy = arnoldsCat(xy);
  }
  return xy;
}

function arnoldsCat(xy) {
  return [(2 * xy[0] + xy[1]) % 1, (xy[0] + xy[1]) % 1];
}


const dist = new Tone.Distortion(1).toMaster();

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
    // 4:4 time strummed up and down, missing the strum where pattern is -
    if (i < chords.length) {
      for (let p of pattern) {
        if (p != "-") {
          strumChord(GUITAR, c, now, 0.01, 3 * durn);
        }
        now = now + durn;
        c.reverse(); // to get down/up strums
      }
      now = now + 0.0;
    } else {
      // last time, just play it once
      strumChord(GUITAR, c, now, 0.01, 4 * durn);
    }
  }
}


// crude attempt to strum chord, not just play all strings at once
function strumChord (instrument, notes, now, gap, duration) {
  let t = now;
  for (let n of notes) {
    instrument.triggerAttackRelease(n, duration, t).connect(dist);
    t = t + gap;
  }
}


function notesToFreq(n) {
  return n.map(x => Tone.Midi(x).toFrequency());
}
