// Hand-authored Hollow Keep room variants. Coordinates are relative to the
// room start; `level` is the number of solid/one-way tiles above the base
// floor. Structural floor stays free for the first 14 and last 5 tiles so
// entries, gates and checkpoints remain safe; wall dressing may use them.
export const DUNGEON_ROOM_TEMPLATES = [
  {
    id: 'torch-procession',
    setPiece: 'torch-corridor',
    steps: [
      { x: 16, w: 4, h: 1 },
      { x: 22, w: 4, h: 1 },
    ],
    pits: [],
    ledges: [
      { x: 14, y: 5, w: 5 },
      { x: 21, y: 5, w: 5 },
    ],
    chests: [
      { x: 15, level: 5 },
      { x: 23, level: 5 },
    ],
    torches: [5, 9, 24, 31],
    statues: [
      { x: 12, level: 0, prop: 'knight' },
      { x: 28, level: 0, prop: 'robed' },
    ],
    panels: [13, 21],
    altar: null,
  },
  {
    id: 'cellblock',
    setPiece: 'cellblock',
    steps: [
      { x: 14, w: 3, h: 1 },
      { x: 25, w: 3, h: 1 },
    ],
    pits: [{ x: 18, w: 2 }],
    ledges: [{ x: 17, y: 4, w: 4 }],
    chests: [
      { x: 15, level: 1 },
      { x: 26, level: 1 },
    ],
    torches: [5, 9, 24, 31],
    statues: [
      { x: 12, level: 0, prop: 'robed' },
      { x: 28, level: 0, prop: 'knight' },
    ],
    panels: [14, 23],
    altar: null,
  },
  {
    id: 'throne-dais',
    setPiece: 'throne-room',
    steps: [
      { x: 15, w: 10, h: 1 },
      { x: 18, w: 4, h: 2 },
    ],
    pits: [],
    ledges: [
      { x: 14, y: 5, w: 4 },
      { x: 23, y: 5, w: 4 },
    ],
    chests: [{ x: 16, level: 1 }],
    torches: [5, 9, 24, 31],
    statues: [
      { x: 12, level: 0, prop: 'knight' },
      { x: 28, level: 0, prop: 'robed' },
    ],
    panels: [15, 22],
    altar: { x: 20, level: 2 },
  },
  {
    id: 'chain-pit',
    setPiece: 'chain-pit',
    steps: [{ x: 14, w: 3, h: 1 }],
    pits: [{ x: 18, w: 4 }],
    ledges: [
      { x: 16, y: 4, w: 4 },
      { x: 22, y: 5, w: 4 },
    ],
    chests: [{ x: 17, level: 4 }],
    torches: [5, 9, 24, 31],
    statues: [
      { x: 12, level: 0, prop: 'robed' },
      { x: 28, level: 0, prop: 'knight' },
    ],
    panels: [15, 22],
    altar: null,
  },
  {
    id: 'treasury',
    setPiece: 'treasury',
    steps: [],
    pits: [],
    ledges: [
      { x: 14, y: 4, w: 5 },
      { x: 20, y: 5, w: 6 },
      { x: 27, y: 4, w: 3 },
    ],
    chests: [
      { x: 15, level: 4 },
      { x: 23, level: 5 },
      { x: 28, level: 4 },
      { x: 18, level: 0 },
    ],
    torches: [5, 9, 24, 31],
    statues: [
      { x: 12, level: 0, prop: 'knight' },
    ],
    panels: [14, 22],
    altar: null,
  },
  {
    id: 'collapsed-steps',
    setPiece: 'collapsed',
    steps: [
      { x: 15, w: 3, h: 1 },
      { x: 21, w: 4, h: 1 },
    ],
    pits: [
      { x: 18, w: 2 },
      { x: 26, w: 2 },
    ],
    ledges: [{ x: 17, y: 5, w: 4 }],
    chests: [
      { x: 16, level: 1 },
      { x: 23, level: 1 },
    ],
    torches: [5, 9, 24, 31],
    statues: [
      { x: 12, level: 0, prop: 'robed' },
      { x: 28, level: 0, prop: 'knight' },
    ],
    panels: [14, 22],
    altar: null,
  },
];
