export const PYTHON_SCRIPT = `import pygame
import random
import sys
import math

# ==========================================
# CONFIGURATION & LAYOUT
# ==========================================
WIDTH, HEIGHT = 1280, 720
FPS = 60

# Grid Settings
COLS = 10
ROWS = 20
BLOCK_SIZE = 36
SHAFT_WIDTH = COLS * BLOCK_SIZE
SHAFT_HEIGHT = ROWS * BLOCK_SIZE

# Layout
LEFT_PANEL_WIDTH = 280
RIGHT_PANEL_WIDTH = 320
CENTER_WIDTH = WIDTH - LEFT_PANEL_WIDTH - RIGHT_PANEL_WIDTH
SHAFT_X = LEFT_PANEL_WIDTH + (CENTER_WIDTH - SHAFT_WIDTH) // 2
SHAFT_Y = (HEIGHT - SHAFT_HEIGHT) // 2

# Block Definitions
BLOCK_TYPES = ["Stone", "Coal", "Iron", "Gold", "Diamond", "TNT"]
BLOCK_PROBS = [0.65, 0.15, 0.10, 0.05, 0.03, 0.02]

BLOCK_COLORS = {
    "Bedrock": {"base": (20, 20, 20),    "high": (40, 40, 40),    "shadow": (0, 0, 0)},
    "Stone":   {"base": (100, 100, 100), "high": (130, 130, 130), "shadow": (70, 70, 70)},
    "Coal":    {"base": (40, 40, 40),    "high": (60, 60, 60),    "shadow": (20, 20, 20)},
    "Iron":    {"base": (200, 180, 160), "high": (230, 210, 190), "shadow": (170, 150, 130)},
    "Gold":    {"base": (240, 200, 50),  "high": (255, 230, 100), "shadow": (180, 140, 20)},
    "Diamond": {"base": (50, 200, 200),  "high": (100, 255, 255), "shadow": (20, 150, 150)},
    "TNT":     {"base": (200, 50, 50),   "high": (240, 80, 80),   "shadow": (150, 30, 30)}
}

# ==========================================
# INITIALIZATION
# ==========================================
pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Vertical Mining - Strict Grid Edition")
clock = pygame.time.Clock()

font_large = pygame.font.SysFont("Consolas", 36, bold=True)
font_medium = pygame.font.SysFont("Consolas", 24, bold=True)
font_small = pygame.font.SysFont("Consolas", 18)

# ==========================================
# GAME STATE
# ==========================================
def get_random_block():
    return random.choices(BLOCK_TYPES, weights=BLOCK_PROBS, k=1)[0]

grid = []
for c in range(COLS):
    col = []
    for r in range(ROWS):
        if c == 0 or c == COLS - 1:
            col.append("Bedrock")
        else:
            col.append(get_random_block())
    grid.append(col)

block_counts = {bt: 0 for bt in BLOCK_TYPES}
depth = -10405

particles = []
flash_alpha = 0.0

pickaxe_angle = 0.0
target_pickaxe_angle = 0.0

# UI Data
top_chatters = [
    ("1. GamerPro99", "15.2K"),
    ("2. UzbekNinja", "12.8K"),
    ("3. BlockMaster", "9.5K"),
    ("4. StreamFan", "8.1K"),
    ("5. Ali_Dev", "6.4K")
]

commands = [
    "!tnt - Drop TNT",
    "!mega - Mega TNT",
    "!nuke - Clear Screen",
    "!siu - Celebration",
    "!pickaxe - Big Pickaxe"
]

command_queue = []

# ==========================================
# RENDERING HELPERS
# ==========================================
block_surfaces = {}

def create_block_surface(b_type):
    surf = pygame.Surface((BLOCK_SIZE, BLOCK_SIZE))
    colors = BLOCK_COLORS[b_type]
    
    # Base
    surf.fill(colors["base"])
    
    # Pixelated Bevels (Minecraft style)
    bevel = 4
    pygame.draw.polygon(surf, colors["high"], [(0, 0), (BLOCK_SIZE, 0), (BLOCK_SIZE-bevel, bevel), (bevel, bevel)])
    pygame.draw.polygon(surf, colors["high"], [(0, 0), (bevel, bevel), (bevel, BLOCK_SIZE-bevel), (0, BLOCK_SIZE)])
    pygame.draw.polygon(surf, colors["shadow"], [(0, BLOCK_SIZE), (BLOCK_SIZE, BLOCK_SIZE), (BLOCK_SIZE-bevel, BLOCK_SIZE-bevel), (bevel, BLOCK_SIZE-bevel)])
    pygame.draw.polygon(surf, colors["shadow"], [(BLOCK_SIZE, 0), (BLOCK_SIZE-bevel, bevel), (BLOCK_SIZE-bevel, BLOCK_SIZE-bevel), (BLOCK_SIZE, BLOCK_SIZE)])
    
    # Inner detail (pixel art style)
    inner = pygame.Rect(bevel, bevel, BLOCK_SIZE - bevel*2, BLOCK_SIZE - bevel*2)
    pygame.draw.rect(surf, (255, 255, 255, 15), inner)
    
    # TNT Label
    if b_type == "TNT":
        tnt_font = pygame.font.SysFont("Arial", 12, bold=True)
        text = tnt_font.render("TNT", True, (255, 255, 255))
        trect = text.get_rect(center=(BLOCK_SIZE//2, BLOCK_SIZE//2))
        surf.blit(text, trect)
        
    return surf

for bt in BLOCK_COLORS.keys():
    block_surfaces[bt] = create_block_surface(bt)

def spawn_particles(x, y, color, count=10):
    for _ in range(count):
        particles.append({
            'x': x, 'y': y,
            'vx': random.uniform(-5, 5),
            'vy': random.uniform(-8, 2),
            'life': 255,
            'color': color,
            'size': random.randint(4, 8)
        })

# ==========================================
# LOGIC
# ==========================================
def mine_block(col, row):
    global depth, flash_alpha
    if col == 0 or col == COLS - 1:
        return # Cannot mine bedrock
        
    b_type = grid[col][row]
    if b_type in block_counts:
        block_counts[b_type] += 1
    
    # Screen coordinates for particles
    px = SHAFT_X + col * BLOCK_SIZE + BLOCK_SIZE // 2
    py = SHAFT_Y + row * BLOCK_SIZE + BLOCK_SIZE // 2
    spawn_particles(px, py, BLOCK_COLORS[b_type]["base"])
    
    # Shift down
    for r in range(row, 0, -1):
        grid[col][r] = grid[col][r-1]
    grid[col][0] = get_random_block()
    
    # TNT Logic
    if b_type == "TNT":
        flash_alpha = 255.0
        for c in range(1, COLS - 1):
            for r in range(3): # Clear bottom 3 rows of all columns
                target_r = ROWS - 1
                tb_type = grid[c][target_r]
                if tb_type in block_counts:
                    block_counts[tb_type] += 1
                
                tx = SHAFT_X + c * BLOCK_SIZE + BLOCK_SIZE // 2
                ty = SHAFT_Y + target_r * BLOCK_SIZE + BLOCK_SIZE // 2
                spawn_particles(tx, ty, BLOCK_COLORS[tb_type]["base"], count=5)
                
                for i in range(target_r, 0, -1):
                    grid[c][i] = grid[c][i-1]
                grid[c][0] = get_random_block()
        depth -= 3 # 3 rows cleared

def process_nuke():
    global depth, flash_alpha
    flash_alpha = 255.0
    for c in range(1, COLS - 1):
        # Shift down by 5
        for r in range(ROWS - 1, 4, -1):
            grid[c][r] = grid[c][r - 5]
        # Fill top 5
        for r in range(5):
            grid[c][r] = get_random_block()
            
        # Spawn particles at bottom
        tx = SHAFT_X + c * BLOCK_SIZE + BLOCK_SIZE // 2
        ty = SHAFT_Y + (ROWS - 1) * BLOCK_SIZE
        spawn_particles(tx, ty, (200, 200, 200), count=10)
    depth -= 5

# ==========================================
# MAIN LOOP
# ==========================================
last_mine_time = pygame.time.get_ticks()
last_cmd_time = pygame.time.get_ticks()
MINE_RATE_MS = 150

running = True
while running:
    dt = clock.tick(FPS) / 1000.0
    current_time = pygame.time.get_ticks()
    
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
            
    # Simulated Command Queue
    if current_time - last_cmd_time > 2000:
        if random.random() < 0.1:
            command_queue.append("!nuke")
        elif random.random() < 0.3:
            command_queue.append("!drop TNT")
        last_cmd_time = current_time

    # Process Commands
    if command_queue:
        cmd = command_queue.pop(0)
        if cmd == "!nuke":
            process_nuke()
        elif cmd.startswith("!drop "):
            item = cmd.split(" ")[1]
            if item in BLOCK_TYPES:
                c = random.randint(1, COLS - 2)
                grid[c][0] = item

    # Auto Mining
    if current_time - last_mine_time > MINE_RATE_MS:
        target_col = random.randint(1, COLS - 2)
        mine_block(target_col, ROWS - 1)
        depth -= 0.1 # Small depth increment per block
        
        # Animate Pickaxe
        target_pickaxe_angle = -45 if target_col < COLS // 2 else 45
        last_mine_time = current_time

    # Pickaxe return animation
    if current_time - last_mine_time > 50:
        target_pickaxe_angle = 0
        
    pickaxe_angle += (target_pickaxe_angle - pickaxe_angle) * 15 * dt

    # Update Particles
    for p in reversed(particles):
        p['x'] += p['vx']
        p['y'] += p['vy']
        p['vy'] += 0.5 # Gravity
        p['life'] -= 400 * dt
        if p['life'] <= 0:
            particles.remove(p)
            
    # Update Flash
    if flash_alpha > 0:
        flash_alpha -= 500 * dt
        flash_alpha = max(0, flash_alpha)

    # ==========================================
    # DRAWING
    # ==========================================
    screen.fill((5, 5, 5)) # Deep cave background
    
    # 1. Center Mine Shaft
    shaft_rect = pygame.Rect(SHAFT_X, SHAFT_Y, SHAFT_WIDTH, SHAFT_HEIGHT)
    pygame.draw.rect(screen, (10, 10, 10), shaft_rect) # Shaft background
    pygame.draw.rect(screen, (30, 30, 30), shaft_rect, 4) # Shaft border
    
    # Draw Grid with Shadow Overlay
    for c in range(COLS):
        for r in range(ROWS):
            b_type = grid[c][r]
            bx = SHAFT_X + c * BLOCK_SIZE
            by = SHAFT_Y + r * BLOCK_SIZE
            screen.blit(block_surfaces[b_type], (bx, by))
            
            # Shadow Overlay (deeper = darker)
            shadow_intensity = int((r / ROWS) * 200)
            shadow_surf = pygame.Surface((BLOCK_SIZE, BLOCK_SIZE), pygame.SRCALPHA)
            shadow_surf.fill((0, 0, 0, shadow_intensity))
            screen.blit(shadow_surf, (bx, by))
            
    # Draw Giant Pickaxe
    pickaxe_surf = pygame.Surface((120, 120), pygame.SRCALPHA)
    # Handle
    pygame.draw.rect(pickaxe_surf, (101, 67, 33), (55, 30, 10, 90))
    # Head (Diamond Pickaxe style)
    pygame.draw.polygon(pickaxe_surf, (50, 200, 200), [(60, 40), (10, 70), (20, 30), (60, 10), (100, 30), (110, 70)])
    
    rotated_pickaxe = pygame.transform.rotate(pickaxe_surf, pickaxe_angle)
    pr = rotated_pickaxe.get_rect(center=(SHAFT_X + SHAFT_WIDTH // 2, SHAFT_Y + SHAFT_HEIGHT - 30))
    screen.blit(rotated_pickaxe, pr)
    
    # Draw Particles
    for p in particles:
        alpha = max(0, min(255, int(p['life'])))
        if alpha > 0:
            psurf = pygame.Surface((p['size'], p['size']), pygame.SRCALPHA)
            psurf.fill((*p['color'], alpha))
            screen.blit(psurf, (int(p['x']), int(p['y'])))
            
    # Draw Flash
    if flash_alpha > 0:
        flash_surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        flash_surf.fill((255, 255, 255, int(flash_alpha)))
        screen.blit(flash_surf, (0, 0))

    # 2. Left Sidebar (Depth & Inventory)
    pygame.draw.rect(screen, (15, 15, 15), (0, 0, LEFT_PANEL_WIDTH, HEIGHT))
    pygame.draw.line(screen, (40, 40, 40), (LEFT_PANEL_WIDTH, 0), (LEFT_PANEL_WIDTH, HEIGHT), 2)
    
    depth_text = font_large.render(f"Y: {int(depth)}", True, (100, 255, 100))
    screen.blit(depth_text, (20, 40))
    
    inv_title = font_medium.render("INVENTORY", True, (150, 150, 150))
    screen.blit(inv_title, (20, 120))
    pygame.draw.line(screen, (40, 40, 40), (20, 150), (LEFT_PANEL_WIDTH - 20, 150), 2)
    
    y_offset = 180
    for b_type in BLOCK_TYPES:
        count = block_counts[b_type]
        icon = pygame.transform.scale(block_surfaces[b_type], (30, 30))
        screen.blit(icon, (20, y_offset))
        
        text = font_medium.render(f"{b_type}: {count}", True, (220, 220, 220))
        screen.blit(text, (60, y_offset + 2))
        y_offset += 50

    # 3. Right Sidebar (Chatters & Commands)
    right_x = WIDTH - RIGHT_PANEL_WIDTH
    pygame.draw.rect(screen, (15, 15, 15), (right_x, 0, RIGHT_PANEL_WIDTH, HEIGHT))
    pygame.draw.line(screen, (40, 40, 40), (right_x, 0), (right_x, HEIGHT), 2)
    
    # Top Chatters
    chat_title = font_medium.render("TOP CHATTERS", True, (150, 150, 150))
    screen.blit(chat_title, (right_x + 20, 40))
    pygame.draw.line(screen, (40, 40, 40), (right_x + 20, 70), (WIDTH - 20, 70), 2)
    
    y_offset = 90
    for name, score in top_chatters:
        name_text = font_small.render(name, True, (200, 200, 200))
        score_text = font_small.render(score, True, (255, 215, 0))
        screen.blit(name_text, (right_x + 20, y_offset))
        screen.blit(score_text, (WIDTH - 80, y_offset))
        y_offset += 35
        
    # Commands
    cmd_title = font_medium.render("COMMANDS", True, (150, 150, 150))
    screen.blit(cmd_title, (right_x + 20, 320))
    pygame.draw.line(screen, (40, 40, 40), (right_x + 20, 350), (WIDTH - 20, 350), 2)
    
    y_offset = 370
    for cmd in commands:
        cmd_text = font_small.render(cmd, True, (100, 200, 255))
        screen.blit(cmd_text, (right_x + 20, y_offset))
        y_offset += 35

    pygame.display.flip()

pygame.quit()
sys.exit()
`
