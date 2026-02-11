/**
 * Office Scene - Background renderer
 * Draws the static office environment
 */

import { DESK_POSITIONS, FURNITURE, WINDOWS, GRID_CONFIG } from './desk-assignments';

export function drawOfficeScene(ctx: CanvasRenderingContext2D, time: Date) {
  const hour = time.getHours();
  
  // Clear canvas
  ctx.clearRect(0, 0, GRID_CONFIG.width, GRID_CONFIG.height);
  
  // Draw layers from back to front
  drawSky(ctx, hour);
  drawBuilding(ctx);
  drawFloor(ctx);
  drawWindows(ctx, hour);
  drawFurniture(ctx);
  drawDesks(ctx);
}

function drawSky(ctx: CanvasRenderingContext2D, hour: number) {
  const colors = getSkyColors(hour);
  
  // Sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 80);
  gradient.addColorStop(0, colors.top);
  gradient.addColorStop(1, colors.bottom);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GRID_CONFIG.width, 80);
  
  // Stars at night
  if (hour < 6 || hour > 20) {
    ctx.fillStyle = '#ffffff';
    // Fixed star positions for consistency
    const stars = [
      [50, 20], [120, 35], [200, 15], [350, 40], [420, 25],
      [500, 50], [580, 30], [620, 45], [80, 55], [300, 10],
    ];
    for (const [x, y] of stars) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function getSkyColors(hour: number): { top: string; bottom: string } {
  if (hour >= 6 && hour < 8) {
    // Sunrise
    return { top: '#FF6B6B', bottom: '#FFA07A' };
  }
  if (hour >= 8 && hour < 17) {
    // Day
    return { top: '#4A90D9', bottom: '#87CEEB' };
  }
  if (hour >= 17 && hour < 20) {
    // Sunset
    return { top: '#FF6B6B', bottom: '#4A2060' };
  }
  // Night
  return { top: '#0a0a2a', bottom: '#1a1a3a' };
}

function drawBuilding(ctx: CanvasRenderingContext2D) {
  // Main building structure
  ctx.fillStyle = '#1a1a3a';
  ctx.fillRect(0, 80, GRID_CONFIG.width, GRID_CONFIG.height - 80);
  
  // Add some wall detail lines
  ctx.strokeStyle = '#252545';
  ctx.lineWidth = 2;
  
  // Vertical lines
  for (let x = 0; x < GRID_CONFIG.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x, GRID_CONFIG.height);
    ctx.stroke();
  }
}

function drawFloor(ctx: CanvasRenderingContext2D) {
  const floorY = GRID_CONFIG.height - 60;
  
  // Floor base
  ctx.fillStyle = '#252545';
  ctx.fillRect(0, floorY, GRID_CONFIG.width, 60);
  
  // Grid lines
  ctx.strokeStyle = '#2a2a5a';
  ctx.lineWidth = 1;
  
  // Vertical grid lines
  for (let x = 0; x < GRID_CONFIG.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, GRID_CONFIG.height);
    ctx.stroke();
  }
  
  // Horizontal grid lines
  for (let y = floorY; y < GRID_CONFIG.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GRID_CONFIG.width, y);
    ctx.stroke();
  }
}

function drawWindows(ctx: CanvasRenderingContext2D, hour: number) {
  const isDaytime = hour >= 6 && hour <= 18;
  
  for (const win of WINDOWS) {
    // Window frame
    ctx.fillStyle = '#2a2a5a';
    ctx.fillRect(win.x - 2, win.y - 2, win.width + 4, win.height + 4);
    
    // Window glass (color changes based on time)
    if (isDaytime) {
      ctx.fillStyle = '#87CEEB44'; // Light blue, semi-transparent
    } else {
      ctx.fillStyle = '#FFD70033'; // Warm yellow, semi-transparent
    }
    ctx.fillRect(win.x, win.y, win.width, win.height);
    
    // Window cross
    ctx.strokeStyle = '#3a3a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(win.x, win.y, win.width, win.height);
    
    ctx.beginPath();
    ctx.moveTo(win.x + win.width / 2, win.y);
    ctx.lineTo(win.x + win.width / 2, win.y + win.height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(win.x, win.y + win.height / 2);
    ctx.lineTo(win.x + win.width, win.y + win.height / 2);
    ctx.stroke();
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D) {
  // Coffee bar
  const coffee = FURNITURE.coffeeBar;
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(coffee.x, coffee.y, coffee.width, coffee.height);
  
  // Coffee machine
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(coffee.x + 10, coffee.y - 15, 20, 20);
  ctx.fillStyle = '#0f0'; // Green light
  ctx.fillRect(coffee.x + 15, coffee.y - 10, 10, 5);
  
  // Steam effect (simple)
  ctx.fillStyle = '#ffffff44';
  ctx.fillRect(coffee.x + 18, coffee.y - 25, 4, 8);
  ctx.fillRect(coffee.x + 22, coffee.y - 30, 3, 6);
  
  // Whiteboard
  const wb = FURNITURE.whiteboard;
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(wb.x, wb.y, wb.width, wb.height);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 3;
  ctx.strokeRect(wb.x, wb.y, wb.width, wb.height);
  
  // Some scribbles on whiteboard
  ctx.strokeStyle = '#3a3a6a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(wb.x + 10, wb.y + 20);
  ctx.lineTo(wb.x + 30, wb.y + 20);
  ctx.moveTo(wb.x + 10, wb.y + 35);
  ctx.lineTo(wb.x + 50, wb.y + 35);
  ctx.moveTo(wb.x + 10, wb.y + 50);
  ctx.lineTo(wb.x + 40, wb.y + 50);
  ctx.stroke();
  
  // Lounge area
  const lounge = FURNITURE.lounge;
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(lounge.x, lounge.y, lounge.width, lounge.height);
  
  // Bean bag
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.arc(lounge.x + 30, lounge.y + 40, 20, 0, Math.PI * 2);
  ctx.fill();
  
  // Door
  const door = FURNITURE.door;
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(door.x, door.y, door.width, door.height);
  
  // Door handle
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(door.x + 30, door.y + 20, 4, 8);
}

function drawDesks(ctx: CanvasRenderingContext2D) {
  for (const [id, desk] of Object.entries(DESK_POSITIONS)) {
    const deskNum = parseInt(id);
    
    // Desk top
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(desk.x - 40, desk.y - 20, 80, 8);
    
    // Desk legs
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(desk.x - 35, desk.y - 12, 4, 15);
    ctx.fillRect(desk.x + 31, desk.y - 12, 4, 15);
    
    // Monitor
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(desk.x - 15, desk.y - 45, 30, 22);
    
    // Screen (glow based on assignment)
    if (desk.assignment !== 'open') {
      ctx.fillStyle = '#0f0';
      ctx.fillRect(desk.x - 13, desk.y - 43, 26, 18);
      
      // Screen content (simple lines)
      ctx.fillStyle = '#003300';
      ctx.fillRect(desk.x - 10, desk.y - 40, 20, 2);
      ctx.fillRect(desk.x - 10, desk.y - 35, 15, 2);
      ctx.fillRect(desk.x - 10, desk.y - 30, 18, 2);
    } else {
      // Empty desk - dark screen
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(desk.x - 13, desk.y - 43, 26, 18);
    }
    
    // Desk decorations based on style
    if (desk.style === 'messy') {
      // Coffee cup
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(desk.x - 30, desk.y - 28, 6, 8);
      // Papers
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(desk.x + 10, desk.y - 25, 8, 6);
    } else if (desk.style === 'organized') {
      // Notebook
      ctx.fillStyle = '#4a5a8a';
      ctx.fillRect(desk.x - 30, desk.y - 28, 10, 8);
    } else if (desk.style === 'creative') {
      // Plant
      ctx.fillStyle = '#4a8a4a';
      ctx.fillRect(desk.x + 15, desk.y - 32, 6, 12);
      ctx.fillStyle = '#6aba6a';
      ctx.fillRect(desk.x + 13, desk.y - 38, 10, 8);
    } else if (desk.style === 'minimal') {
      // Single pen
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(desk.x - 25, desk.y - 26, 8, 3);
    }
    
    // Desk number label
    ctx.fillStyle = '#666';
    ctx.font = '6px monospace';
    ctx.fillText(`D${deskNum}`, desk.x - 38, desk.y - 5);
  }
}
