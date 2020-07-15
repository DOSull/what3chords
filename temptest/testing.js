const chart = new SVGuitarChord('#chart1')


new SVGuitarChord('#chart1')
      .chord({
        // array of [string, fret, text | options]
        fingers: [
          // finger at string 1, fret 2, with text '2'
          [1, 2, '2'],

          // finger at string 2, fret 3, with text '3', colored red
          [2, 3, { text: '3', color: '#F00' }],

          // finger is triangle shpaed
          [3, 3, { shape: 'triangle' }],
          [6, 'x']
        ],

        // optional: barres for barre chords
        barres: [
          { fromString: 5, toString: 1, fret: 1, text: '1', color: '#0F0', textColor: '#F00' },
        ],
      })
      .configure({
          // Customizations (all optional, defaults shown)

          /**
           * Select between 'normal' and 'handdrawn'
           */
          style: 'normal',

          /**
           * The number of strings
           */
          strings: 6,

          /**
           * The number of frets
           */
          frets: 4,
          /**
           * The starting fret (first fret is 1)
           */
          position: 1,

          /**
           * These are the labels under the strings. Can be any string.
           */
          tuning: [ 'E', 'A', 'D', 'G', 'B', 'E' ],

          /**
           * The position of the fret label (eg. "3fr")
           */
          fretLabelPosition: 'right',

          /**
           * The font size of the fret label
           */
          fretLabelFontSize: 38,

          /**
           * The font size of the string labels
           */
          tuningsFontSize: 28,

          /**
           * Size of a nut relative to the string spacing
           */
          nutSize: 0.65,

          /**
           * Color of a finger / nut
           */
          nutColor: '#000',

          /**
           * The color of text inside nuts
           */
          nutTextColor: '#FFF',

          /**
           * The size of text inside nuts
           */
          nutTextSize: 22,

          /**
           * Height of a fret, relative to the space between two strings
           */
          fretSize: 1.5,

          /**
           * The minimum side padding (from the guitar to the edge of the SVG) relative to the whole width.
           * This is only applied if it's larger than the letters inside of the padding (eg the starting fret)
           */
          sidePadding: 0.2,

          /**
           * The font family used for all letters and numbers
           */
          fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',

          /**
           * The title of the chart. Optional
           */
          title: 'F# minor',

          /**
           * Font size of the title. This is only the initial font size. If the title doesn't fit, the title
           * is automatically scaled so that it fits.
           */
          titleFontSize: 48,

          /**
           * Space between the title and the chart
           */
          titleBottomMargin: 0,

          /**
           * Global color of the whole chart. Can be overridden with more specifig color settings such as
           * @link titleColor or @link stringColor etc.
           */
          color: '#000',

          /**
           * The background color of the chord diagram. By default the background is transparent. To set the background to transparent either set this to 'none' or undefined
           */
          backgroundColor: 'none',

          /**
           * Barre chord rectangle border radius relative to the nutSize (eg. 1 means completely round endges, 0 means not rounded at all)
           */
          barreChordRadius: 0.25,

          /**
           * Size of the Xs and Os above empty strings relative to the space between two strings
           */
          emptyStringIndicatorSize: 0.6,

          /**
           * Global stroke width
           */
          strokeWidth: 2,

          /**
           * The width of the top fret (only used if position is 1)
           */
          topFretWidth: 10,

          /**
           * The color of the title (overrides color)
           */
          titleColor: '#000000',
          /**
           * The color of the strings (overrides color)
           */
          stringColor: '#000000',
          /**
           * The color of the fret position (overrides color)
           */
          fretLabelColor: '#000000',
          /**
           * The color of the tunings (overrides color)
           */
          tuningsColor: '#000000',
          /**
           * The color of the frets (overrides color)
           */
          fretColor: '#000000',
          /**
           * When set to true the distance between the chord diagram and the top of the SVG stayes the same,
           * no matter if a title is defined or not.
           */
          fixedDiagramPosition: false

      })
      .draw();
