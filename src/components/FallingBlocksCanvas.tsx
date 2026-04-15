import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Terminal } from 'lucide-react';

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
const ROWS = 14;
const BLOCK_SIZE = 48;
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
  const commandQueueRef = useRef<string[]>([]);
  
  const [depth, setDepth] = useState(-10000);
  const [blockCounts, setBlockCounts] = useState<Record<string, number>>({
    Stone: 0, Coal: 0, Iron: 0, Gold: 0, Diamond: 0, TNT: 0
  });

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
    let lastCmdTime = Date.now();

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
      
      setBlockCounts(prev => ({ ...prev, [bType]: (prev[bType] || 0) + 1 }));
      setDepth(d => d - 1);

      const shaftWidth = COLS * BLOCK_SIZE;
      const shaftHeight = ROWS * BLOCK_SIZE;
      const shaftX = (canvas.width - shaftWidth) / 2;
      const shaftY = (canvas.height - shaftHeight) / 2;

      const px = shaftX + col * BLOCK_SIZE + BLOCK_SIZE / 2;
      const py = shaftY + row * BLOCK_SIZE + BLOCK_SIZE / 2;
      
      spawnParticles(px, py, BLOCK_COLORS[bType].base);

      for (let r = row; r > 0; r--) {
        gridRef.current[col][r] = gridRef.current[col][r - 1];
      }
      gridRef.current[col][0] = getRandomBlock();

      if (bType === 'TNT') {
        flashAlpha = 1.0;
        let blocksCleared = 0;
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r < 3; r++) {
            const targetRow = ROWS - 1;
            const tbType = gridRef.current[c][targetRow];
            
            setBlockCounts(prev => ({ ...prev, [tbType]: (prev[tbType] || 0) + 1 }));
            
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
        setDepth(d => d - 3);
      }
    };

    const processNuke = () => {
      flashAlpha = 1.0;
      const shaftWidth = COLS * BLOCK_SIZE;
      const shaftHeight = ROWS * BLOCK_SIZE;
      const shaftX = (canvas.width - shaftWidth) / 2;
      const shaftY = (canvas.height - shaftHeight) / 2;

      for (let c = 0; c < COLS; c++) {
        for (let r = ROWS - 1; r >= 10; r--) {
          gridRef.current[c][r] = gridRef.current[c][r - 10];
        }
        for (let r = 0; r < 10; r++) {
          gridRef.current[c][r] = getRandomBlock();
        }
        
        const tx = shaftX + c * BLOCK_SIZE + BLOCK_SIZE / 2;
        const ty = shaftY + (ROWS - 1) * BLOCK_SIZE;
        spawnParticles(tx, ty, '#ffffff', 15);
      }
      setDepth(d => d - 10);
    };

    const render = () => {
      const now = Date.now();

      if (now - lastCmdTime > 2000) {
        if (Math.random() < 0.1) {
          commandQueueRef.current.push('!nuke');
        } else if (Math.random() < 0.3) {
          commandQueueRef.current.push('!drop TNT');
        }
        lastCmdTime = now;
      }

      if (commandQueueRef.current.length > 0) {
        const cmd = commandQueueRef.current.shift();
        if (cmd === '!nuke') {
          processNuke();
        } else if (cmd?.startsWith('!drop ')) {
          const item = cmd.split(' ')[1] as BlockType;
          if (BLOCK_TYPES.includes(item)) {
            const c = Math.floor(Math.random() * COLS);
            gridRef.current[c][0] = item;
          }
        }
      }

      if (now - lastMineTime > MINE_RATE_MS) {
        const targetCol = Math.floor(Math.random() * COLS);
        mineBlock(targetCol, ROWS - 1);
        targetPickaxeAngle = targetCol < COLS / 2 ? -0.8 : 0.8;
        lastMineTime = now;
      }

      if (now - lastMineTime > 50) {
        targetPickaxeAngle = 0;
      }

      pickaxeAngle += (targetPickaxeAngle - pickaxeAngle) * 0.3;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const shaftWidth = COLS * BLOCK_SIZE;
      const shaftHeight = ROWS * BLOCK_SIZE;
      const shaftX = (canvas.width - shaftWidth) / 2;
      const shaftY = (canvas.height - shaftHeight) / 2;

      ctx.fillStyle = '#050505';
      ctx.fillRect(shaftX, shaftY, shaftWidth, shaftHeight);
      ctx.strokeStyle = '#1e1e1e';
      ctx.lineWidth = 4;
      ctx.strokeRect(shaftX, shaftY, shaftWidth, shaftHeight);

      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const bType = gridRef.current[c][r];
          if (!bType) continue;

          const bx = shaftX + c * BLOCK_SIZE;
          const by = shaftY + r * BLOCK_SIZE;
          const colors = BLOCK_COLORS[bType];
          const bevel = 5;

          ctx.fillStyle = colors.base;
          ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);

          ctx.fillStyle = colors.light;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + BLOCK_SIZE, by);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + bevel);
          ctx.lineTo(bx + bevel, by + bevel);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + bevel, by + bevel);
          ctx.lineTo(bx + bevel, by + BLOCK_SIZE - bevel);
          ctx.lineTo(bx, by + BLOCK_SIZE);
          ctx.fill();

          ctx.fillStyle = colors.dark;
          ctx.beginPath();
          ctx.moveTo(bx, by + BLOCK_SIZE);
          ctx.lineTo(bx + BLOCK_SIZE, by + BLOCK_SIZE);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + BLOCK_SIZE - bevel);
          ctx.lineTo(bx + bevel, by + BLOCK_SIZE - bevel);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(bx + BLOCK_SIZE, by);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + bevel);
          ctx.lineTo(bx + BLOCK_SIZE - bevel, by + BLOCK_SIZE - bevel);
          ctx.lineTo(bx + BLOCK_SIZE, by + BLOCK_SIZE);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.fillRect(bx + bevel, by + bevel, BLOCK_SIZE - bevel * 2, BLOCK_SIZE - bevel * 2);

          if (bType === 'TNT') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('TNT', bx + BLOCK_SIZE / 2, by + BLOCK_SIZE / 2);
          }

          const distX = Math.abs(c - COLS / 2) / (COLS / 2);
          const distY = r / ROWS;
          const shadowIntensity = Math.min(0.85, (distX * distX * 0.3) + (distY * 0.7));
          ctx.fillStyle = `rgba(0, 0, 0, ${shadowIntensity})`;
          ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);
        }
      }

      ctx.save();
      ctx.translate(shaftX + shaftWidth / 2, shaftY + shaftHeight - 30);
      ctx.rotate(pickaxeAngle);
      
      ctx.fillStyle = '#654321';
      ctx.fillRect(-6, -60, 12, 100);
      ctx.fillStyle = '#32c8c8';
      ctx.beginPath();
      ctx.moveTo(-60, -50);
      ctx.quadraticCurveTo(0, -80, 60, -50);
      ctx.lineTo(60, -40);
      ctx.quadraticCurveTo(0, -60, -60, -40);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5;
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
    <div className="flex h-full w-full bg-[#020202] text-white font-mono overflow-hidden relative">
      <div className="absolute inset-0" ref={containerRef}>
        <canvas ref={canvasRef} className="block w-full h-full" />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.9)] z-0" />
      </div>

      <div className="w-[280px] h-full bg-slate-950/60 backdrop-blur-xl border-r border-slate-800/50 p-6 flex flex-col z-10 shrink-0 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </div>
          <h1 className="text-xl font-bold tracking-widest text-white">LIVE</h1>
        </div>

        <div className="text-4xl font-bold text-green-400 mb-10 tracking-wider drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]">
          Y: {Math.floor(depth)}
        </div>
        
        <div className="text-sm text-slate-400 mb-6 border-b border-slate-800/50 pb-2 font-bold tracking-widest">
          INVENTORY
        </div>
        
        <div className="space-y-5">
          {BLOCK_TYPES.map(type => (
            <div key={type} className="flex items-center gap-4 bg-slate-900/40 p-2 rounded-lg border border-slate-800/50">
              <div 
                className="w-8 h-8 rounded-sm shrink-0 shadow-lg"
                style={{ 
                  backgroundColor: BLOCK_COLORS[type].base, 
                  borderTop: `3px solid ${BLOCK_COLORS[type].light}`, 
                  borderLeft: `3px solid ${BLOCK_COLORS[type].light}`, 
                  borderBottom: `3px solid ${BLOCK_COLORS[type].dark}`,
                  borderRight: `3px solid ${BLOCK_COLORS[type].dark}`
                }}
              />
              <div className="text-lg text-slate-300 font-bold flex-1 flex justify-between">
                <span>{type}</span>
                <span className="text-white">{blockCounts[type]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-[320px] h-full ml-auto bg-slate-950/60 backdrop-blur-xl border-l border-slate-800/50 p-6 flex flex-col z-10 shrink-0 shadow-2xl">
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4 border-b border-slate-800/50 pb-2 font-bold tracking-widest">
            <Trophy size={16} className="text-yellow-500" />
            TOP CHATTERS
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm bg-slate-900/40 p-2 rounded border border-slate-800/30">
              <span className="text-slate-300">1. GamerPro99</span>
              <span className="text-yellow-500 font-bold">15.2K</span>
            </div>
            <div className="flex justify-between text-sm bg-slate-900/40 p-2 rounded border border-slate-800/30">
              <span className="text-slate-300">2. UzbekNinja</span>
              <span className="text-yellow-500 font-bold">12.8K</span>
            </div>
            <div className="flex justify-between text-sm bg-slate-900/40 p-2 rounded border border-slate-800/30">
              <span className="text-slate-300">3. BlockMaster</span>
              <span className="text-yellow-500 font-bold">9.5K</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4 border-b border-slate-800/50 pb-2 font-bold tracking-widest">
            <Terminal size={16} className="text-blue-400" />
            COMMANDS
          </div>
          <div className="space-y-2 text-sm text-blue-300/80 font-mono bg-slate-900/60 p-4 rounded-lg border border-slate-800/50">
            <div>{'>'} !drop TNT</div>
            <div>{'>'} !mega (Mega TNT)</div>
            <div>{'>'} !nuke (Clear 10 rows)</div>
            <div>{'>'} !siu (Celebration)</div>
            <div>{'>'} !pickaxe (Big Pickaxe)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
