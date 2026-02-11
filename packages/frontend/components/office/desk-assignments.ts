/**
 * Desk Assignments - Fixed positions for 6 agents
 * Coordinates based on 640x360 canvas
 * Grid: 40x40px tiles
 */

export interface DeskPosition {
  x: number;
  y: number;
  assignment: string; // agent ID or 'open'
  style: 'messy' | 'organized' | 'creative' | 'minimal' | 'empty';
}

export const DESK_POSITIONS: Record<number, DeskPosition> = {
  1: {
    x: 80,
    y: 120,
    assignment: 'steve',
    style: 'messy', // Coffee cups, notes scattered
  },
  2: {
    x: 480,
    y: 120,
    assignment: 'sam',
    style: 'organized', // Dual monitors, charts
  },
  3: {
    x: 80,
    y: 220,
    assignment: 'luna',
    style: 'creative', // Stickers, mood board
  },
  4: {
    x: 480,
    y: 220,
    assignment: 'leo',
    style: 'minimal', // Single monitor, plant
  },
  5: {
    x: 280,
    y: 280,
    assignment: 'open',
    style: 'empty', // Available for recruitment
  },
  6: {
    x: 480,
    y: 280,
    assignment: 'open',
    style: 'empty', // Available for recruitment
  },
};

// Furniture positions (static elements)
export const FURNITURE = {
  coffeeBar: { x: 280, y: 160, width: 80, height: 40 },
  whiteboard: { x: 280, y: 80, width: 80, height: 60 },
  lounge: { x: 180, y: 260, width: 80, height: 60 },
  door: { x: 40, y: 320, width: 40, height: 40 },
};

// Window positions for lighting effects
export const WINDOWS = [
  { x: 40, y: 10, width: 80, height: 60 },
  { x: 280, y: 10, width: 80, height: 60 },
  { x: 520, y: 10, width: 80, height: 60 },
];

// Grid configuration
export const GRID_CONFIG = {
  tileSize: 40,
  width: 640,
  height: 360,
  cols: 16,
  rows: 9,
};
