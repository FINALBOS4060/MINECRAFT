import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Terminal, ChevronDown, Pickaxe } from 'lucide-react';

// Types and Constants
type BlockType = 'Stone' | 'Coal' | 'Iron' | 'Gold' | 'Diamond' | 'TNT';

interface BlockColors {
  base: string;
  light: string;
  dark: string;
}

const BLOCK_TYPES: BlockType[] = ['Stone', 'Coal', 'Iron', 'Gold', 'Diamond', 'TNT'];
const BLOCK_PROBS = [0.65, 0.15, 0.10, 0.05, 0.03, 0.02];

const BLOCK_COLORS: Record<BlockType, BlockColors> = {
  Stone: { base: '#646464', light: '#828282', dark: '#464646' },
  Coal: { base: '#282828', light: '#3c3c3c', dark: '#141414' },
  Iron: { base: '#c8b4a0', light: '#e6d2be', dark: '#aa9682' },
  Gold: { base: '#f0c832', light: '#ffe664', dark: '#b48c14' },
  Diamond: { base: '#32c8c8', light: '#64ffff', dark: '#149696' },
  TNT: { base: '#c83232', light: '#f05050', dark: '#961e1e' }
};

const COLS = 7;
const ROWS = 12;
const BLOCK_SIZE = 55;
const MINE_RATE_MS = 150;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const getRandomBlock = (): BlockType => {
  const r = Math.random();
  let sum = 0;
  for (let i = 0; i < BLOCK_TYPES.length; i++) {
    sum += BLOCK_PROBS[i];
    if (r <= sum) return BLOCK_TYPES[i];
  }
  return 'Stone';
};

export default function FallingBlocksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderLoopRef = useRef<number | null>(null);
  const gridRef = useRef<BlockType[][]>([]);
  const particlesRef = useRef<Particle[]>([]);
  
  const [depth, setDepth] = useState(-10405);
  const [blockCounts, setBlockCounts] = useState<Record<BlockType, number>>({
    Stone: 0, Coal: 0, Iron: 0, Gold: 0, Diamond: 0, TNT: 0
  });

  // Initialize Grid
  useEffect(() => {
    const initialGrid: BlockType[][] = [];
    for (let c = 0; c < COLS; c++) {
      initialGrid[c] = [];
      for (let r = 0; r < ROWS; r++) {
        initialGrid[c][r] = getRandomBlock();
      }
    }
    gridRef.current = initialGrid;
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let flashAlpha = 0;
    let pickaxeAngle = 0;
    let targetPickaxeAngle = 0;
    let lastMineTime = Date.now();

    const updateSize = () => {
      const { width, height } = containerRef.current!.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const spawnParticles = (x: number, y: number, color: string, count = 10) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 1) * 10,
          life: 1.0,
          color,
          size: Math.random() * 4 + 4
        });
      }
    };

    const mineBlock = (col: number, row: number) => {
      const bType = gridRef.current[col][row];
      
      setBlockCounts(prev => ({ ...prev, [bType]: prev[bType] + 1 }));
      setDepth(d => d - 1);

      const shaftWidth = COLS * BLOCK_SIZE;
      const shaftHeight = ROWS * BLOCK_SIZE;
      const shaftX = (canvas.width - shaftWidth) / 2;
      const shaftY = (canvas.height - shaftHeight) / 2;

      const px = shaftX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
      const py = shaftY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
      
      spawnParticles(px, py, BLOCK_COLORS[bType].base);

      // Shift down
      for (let r = row; r > 0; r--) {
        gridRef.current[col][r] = gridRef.current[col][r - 1];
      }
      gridRef.current[col][0] = getRandomBlock();

      // TNT Nuke Logic
      if (bType === 'TNT') {
        flashAlpha = 1.0;
        let blocksCleared = 0;
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r < 3; r++) { // Clear bottom 3 rows
            const targetRow = ROWS - 1;
            const tbType = gridRef.current[c][targetRow];
            
            setBlockCounts(prev => ({ ...prev, [tbType]: prev[tbType] + 1 }));
            
            const tx = shaftX + c * BLOCK_SIZE + BLOCK_SIZE / 2;
            const ty = shaftY + targetRow * BLOCK_SIZE + BLOCK_SIZE / 2;
            spawnParticles(tx, ty, BLOCK_COLORS[tbType].base, 5);

            for (let i = targetRow; i > 0; i--) {
              gridRef.current[c][i] = gridRef.current[c][i - 1];
            }
            gridRef.current[c][0] = getRandomBlock();
            blocksCleared++;
          }
        }
        setDepth(d => d - blocksCleared);
      }
    };

    const render = () => {
      const now = Date.now();
      const dt = 16 / 1000; // Approx 60fps

      // Auto Mining
      if (now - lastMineTime > MINE_RATE_MS) {
        const targetCol = Math.floor(Math.random() * COLS);
        mineBlock(targetCol, ROWS - 1);
        targetPickaxeAngle = targetCol < COLS / 2 ? -0.5 : 0.5;
        lastMineTime = now;
      }

      if (now - lastMineTime > 50) {
        targetPickaxeAngle = 0;
      }

      pickaxeAngle += (targetPickaxeAngle - pickaxeAngle) * 0.3;

      // Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const shaftWidth = COLS * BLOCK_SIZE;
      const shaftHeight = ROWS * BLOCK_SIZE;
      const shaftX = (canvas.width - shaftWidth) / 2;
      const shaftY = (canvas.height - shaftHeight) / 2;

      // Draw Shaft Background
      ctx.fillStyle = '#141414';
      ctx.fillRect(shaftX, shaftY, shaftWidth, shaftHeight);
      ctx.strokeStyle = '#282828';
      ctx.lineWidth = 4;
      ctx.strokeRect(shaftX, shaftY, shaftWidth, shaftHeight);

      // Draw Grid
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const bType = gridRef.current[c][r];
          if (!bType) continue;

          const bx = shaftX + c * BLOCK_SIZE;
          const by = shaftY + r * BLOCK_SIZE;
          const colors = BLOCK_COLORS[bType];
          const bevel = 6;

          // Base
          ctx.fillStyle = colors.base;
          ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);

          // Top Bevel
          ctx.fillStyle = colors.light;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + BLOCK_SIZE, by);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + bevel);
          ctx.lineTo(bx + bevel, by + bevel);
          ctx.fill();

          // Left Bevel
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + bevel, by + bevel);
          ctx.lineTo(bx + bevel, by + BLOCK_SIZE - bevel);
          ctx.lineTo(bx, by + BLOCK_SIZE);
          ctx.fill();

          // Bottom Bevel
          ctx.fillStyle = colors.dark;
          ctx.beginPath();
          ctx.moveTo(bx, by + BLOCK_SIZE);
          ctx.lineTo(bx + BLOCK_SIZE, by + BLOCK_SIZE);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + BLOCK_SIZE - bevel);
          ctx.lineTo(bx + bevel, by + BLOCK_SIZE - bevel);
          ctx.fill();

          // Right Bevel
          ctx.beginPath();
          ctx.moveTo(bx + BLOCK_SIZE, by);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + bevel);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + BLOCK_SIZE - bevel);
          ctx.lineTo(bx + BLOCK_SIZE, by + BLOCK_SIZE);
          ctx.fill();

          // Inner Detail
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.fillRect(bx + bevel, by + bevel, BLOCK_SIZE - bevel * 2, BLOCK_SIZE - bevel * 2);

          // TNT Label
          if (bType === 'TNT') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TNT', bx + BLOCK_SIZE / 2, by + BLOCK_SIZE / 2);
          }
        }
      }

      // Draw Pickaxe
      ctx.save();
      ctx.translate(shaftX + shaftWidth / 2, shaftY + shaftHeight - 20);
      ctx.rotate(pickaxeAngle);
      
      // Handle
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(-5, -40, 10, 80);
      // Head
      ctx.fillStyle = '#969696';
      ctx.beginPath();
      ctx.moveTo(-40, -30);
      ctx.quadraticCurveTo(0, -50, 40, -30);
      ctx.lineTo(40, -20);
      ctx.quadraticCurveTo(0, -40, -40, -20);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();

      // Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5; // Gravity
        p.life -= 0.02;
        
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          ctx.globalAlpha = 1.0;
        }
      }

      // Draw Flash
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashAlpha -= 0.05;
      }

      renderLoopRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', updateSize);
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
    };
  }, []);

  return (
    <div className="flex h-full w-full bg-[#0a0a0a] text-white font-mono overflow-hidden">
      {/* Left Sidebar: Depth & Inventory */}
      <div className="w-[280px] bg-[#111] border-r border-[#333] p-6 flex flex-col z-10 shrink-0">
        <div className="text-4xl font-bold text-green-400 mb-10 tracking-wider">
          Y: {depth}
        </div>
        
        <div className="text-xl text-gray-400 mb-6 border-b border-[#333] pb-2 font-bold tracking-widest">
          INVENTORY
        </div>
        
        <div className="space-y-6">
          {BLOCK_TYPES.map(type => (
            <div key={type} className="flex items-center gap-4">
              <div 
                className="w-8 h-8 rounded-sm shrink-0"
                style={{ 
                  backgroundColor: BLOCK_COLORS[type].base, 
                  borderTop: `3px solid ${BLOCK_COLORS[type].light}`, 
                  borderLeft: `3px solid ${BLOCK_COLORS[type].light}`, 
                  borderBottom: `3px solid ${BLOCK_COLORS[type].dark}`,
                  borderRight: `3px solid ${BLOCK_COLORS[type].dark}`
                }}
              />
              <div className="text-lg text-gray-200 font-bold">
                {type}: <span className="text-white">{blockCounts[type]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center: Canvas Area */}
      <div className="flex-1 relative" ref={containerRef}>
        <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />
      </div>

      {/* Right Sidebar: Chatters & Commands */}
      <div className="w-[320px] bg-[#111] border-l border-[#333] p-6 flex flex-col z-10 shrink-0">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xl text-gray-400 mb-4 border-b border-[#333] pb-2 font-bold tracking-widest">
            <Trophy size={20} className="text-yellow-500" />
            TOP CHATTERS
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">1. GamerPro99</span>
              <span className="text-yellow-500 font-bold">15.2K</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">2. UzbekNinja</span>
              <span className="text-yellow-500 font-bold">12.8K</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">3. BlockMaster</span>
              <span className="text-yellow-500 font-bold">9.5K</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">4. StreamFan</span>
              <span className="text-yellow-500 font-bold">8.1K</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">5. Ali_Dev</span>
              <span className="text-yellow-500 font-bold">6.4K</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xl text-gray-400 mb-4 border-b border-[#333] pb-2 font-bold tracking-widest">
            <Terminal size={20} className="text-blue-400" />
            COMMANDS
          </div>
          <div className="space-y-3 text-sm text-blue-300">
            <div>!tnt - Drop TNT</div>
            <div>!mega - Mega TNT</div>
            <div>!nuke - Clear Screen</div>
            <div>!siu - Celebration</div>
            <div>!pickaxe - Big Pickaxe</div>
          </div>
        </div>
      </div>
    </div>
  );
}
