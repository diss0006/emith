/* ==========================================================================
   reel-themes.js
   --------------------------------------------------------------------------
   What each reel word is actually promising, and which real images stand for
   it. Order must match the <li> order in the reel markup.

   Two of these have no imagery yet and say so in plain language rather than
   borrowing pictures from a neighbouring discipline. The panel drops its deck
   column entirely for those and gives the space to the copy.
   ========================================================================== */

export const THEMES = [
  {
    kicker: 'Research and interface',
    title: 'UX research and design',
    blurb: 'Whole processes rather than screens: interviews and personas, ' +
           'information architecture, wireframes, then a build that proves it ' +
           'works. Pawsitive Futures runs the full length of that.',
    facts: ['Research', 'Personas', 'Wireframes', 'Prototypes'],
    images: ['images/pf.png', 'images/proto.png', 'images/graphics/moodboard1.png']
  },
  {
    kicker: 'Graphics',
    title: 'Graphic design',
    blurb: 'Posters, banners, artboards and album artwork made across ' +
           'coursework and personal briefs, where the job is to hold ' +
           'attention at a glance and survive being printed small.',
    facts: ['Posters', 'Banners', 'Layout', 'Type'],
    images: ['images/web/graphics.jpg', 'images/graphics/artboard1.png',
             'images/graphics/poster.png', 'images/graphics/thicc.png']
  },
  {
    kicker: 'Identity',
    title: 'Branding work',
    blurb: 'Complete identity packages: the mark, the type and colour system ' +
           'around it, and the guidelines that keep it consistent once other ' +
           'people start using it. Feels and Flavors, and Sweetwater.',
    facts: ['Marks', 'Systems', 'Guidelines', 'Packaging'],
    images: ['images/web/feelsandf.jpg', 'images/sweetwater.png']
  },
  {
    kicker: 'Social',
    title: 'Social media projects',
    blurb: 'Campaign visuals and reusable templates built for a feed: legible ' +
           'at thumbnail size, and consistent enough to read as a set when ' +
           'they land next to each other.',
    facts: ['Campaigns', 'Templates', 'Sets'],
    images: ['images/graphics/banner2.png', 'images/graphics/slicc.png']
  },
  {
    kicker: 'Music',
    title: 'Music related projects',
    blurb: 'Cover art, sleeve layouts and release visuals for music projects, ' +
           'where the artwork has to carry the whole tone of the record on ' +
           'its own.',
    facts: ['Cover art', 'Sleeves', 'Release visuals'],
    images: ['images/graphics/embiaz.png', 'images/graphics/upsidedown.png']
  },
  {
    kicker: 'Hands on',
    title: 'Mechanical skills',
    blurb: 'Builds, repairs and the habit of taking things apart to find out ' +
           'how they go back together. Documentation for this one is still ' +
           'being put together.',
    facts: ['Builds', 'Repairs'],
    images: []
  },
  {
    kicker: 'Photography',
    title: 'Photography work',
    blurb: 'Personal photography, shot for its own sake rather than a brief. ' +
           'A selection for this section is still being chosen.',
    facts: ['Personal', 'Selects'],
    images: []
  },
  {
    kicker: 'Document',
    title: 'Resume',
    blurb: 'The one page version: education, tools, experience and the ' +
           'fastest way to get in touch. Opens as a PDF.',
    facts: ['PDF', 'One page'],
    images: []
  }
];
