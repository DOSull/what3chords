"use strict";

const WEB_MERC_LIMIT = 85.051129;

const synth = new Tone.PolySynth(6, Tone.Synth, {
oscillator : {
  type : "pulse",
  volume : "-5"
}
}).toMaster();

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
// query string - defaults to 'light'
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

// fire up the loading spinner
document.getElementById("loaderDiv").style.display = "block";

// get the data
const DATA = {};



$.when(
  $.getJSON("./data/guitar-chords.json", function(data) {
    DATA.chords = data.chords;
    console.log(DATA.chords);
  }),
  $.getJSON("./data/rect.geojson", function(data) {
    DATA.rect = data.features;
    console.log(DATA.rect);
  })
).done( function() {
  clearLoader(); // clear the spinner
  processChordsData();
  render();
});

let CHORDS = [];
function processChordsData() {
  let chordsFlattened = {};
  for (let [key, variants] of Object.entries(DATA.chords)) {
    for (let v of variants) {
      for (let i = 0; i < v.positions.length; i ++) {
        CHORDS.push({
          chord: `${v.key}${v.suffix} ${i}`,
          midi: v.positions[i].midi,
        });
      }
    }
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
    let abc = getCode(c);
    // console.log(`${abc}`);
    el.innerHTML =
      `<table><tr><td>Chord</td><td>MIDI</td></tr><tr><td>${CHORDS[abc[0]].chord}</td><td>${CHORDS[abc[0]].midi}</td></tr><tr><td>${CHORDS[abc[1]].chord}</td><td>${CHORDS[abc[1]].midi}</td></tr><tr><td>${CHORDS[abc[2]].chord}</td><td>${CHORDS[abc[2]].midi}</td</tr></table>`;
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

// get a 3 digit sequence of 0..2040 indices into the Array of chords
function getCode(c) {
  // get x and y values that are int 0..130400, 0..65200
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
  let x = Math.round(rescale(xy[0], 0, 1, 0, 130400));
  let y = Math.round(rescale(xy[1], 0, 1, 0, 65200));
  let i = x + y * 130400;
  let p = Math.floor(i / 2041 / 2041);
  let q = Math.floor((i - p * 2041 * 2041) / 2041);
  let r = i % 2041;
  return [p, q, r];
}

function divide(x, y) {
  return [Math.floor(x / y), x % y];
}

// shuffle the lon lat in a unit square using Arnold's Cat, see
// http://southosullivan.com/misc/what3chords-app/
function doTheShuffle(c) {
  let xy = c;
  for (let i = 0; i < 15; i ++) {
    xy = arnoldsCat(xy);
  }
  return xy;
}

function rescale(x, xmin, xmax, mn, mx) {
  return mn + (mx - mn) * (x - xmin) / (xmax - xmin);
}

function arnoldsCat(xy) {
  return [(2 * xy[0] + xy[1]) % 1, (xy[0] + xy[1]) % 1];
}

function playChord(notes1, notes2, notes3){
  notes1 = notesToFreq(notes1);
  notes2 = notesToFreq(notes2);
  notes3 = notesToFreq(notes3);

  const now = Tone.now()
  synth.triggerAttackRelease(notes1, 1, now);
  synth.triggerAttackRelease(notes2, 1, now + 1.05);
  synth.triggerAttackRelease(notes3, 1, now + 2.1);
}

function notesToFreq(n){
  for (let i = 0; i < n.length; i++){
    n[i] = Tone.Midi(n[i]).toFrequency();
  }
  return n;
}
