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
MINE_COLS = 7
COLS = MINE_COLS + 2 # 1 bedrock on each side
ROWS = 14
BLOCK_SIZE = 48
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
pygame.display.set_caption("Vertical Mining - Cinematic Edition")
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
screen_shake = 0.0

pickaxe_angle = 0.0
target_pickaxe_angle = 0.0
command_queue = []

# ==========================================
# RENDERING HELPERS
# ==========================================
block_surfaces = {}

def create_block_surface(b_type):
    surf = pygame.Surface((BLOCK_SIZE, BLOCK_SIZE))
    colors = BLOCK_COLORS[b_type]
    
    # Base Color
    surf.fill(colors["base"])
    
    # 3D Beveling
    bevel = 5
    pygame.draw.polygon(surf, colors["high"], [(0, 0), (BLOCK_SIZE, 0), (BLOCK_SIZE-bevel, bevel), (bevel, bevel)])
    pygame.draw.polygon(surf, colors["high"], [(0, 0), (bevel, bevel), (bevel, BLOCK_SIZE-bevel), (0, BLOCK_SIZE)])
    pygame.draw.polygon(surf, colors["shadow"], [(0, BLOCK_SIZE), (BLOCK_SIZE, BLOCK_SIZE), (BLOCK_SIZE-bevel, BLOCK_SIZE-bevel), (bevel, BLOCK_SIZE-bevel)])
    pygame.draw.polygon(surf, colors["shadow"], [(BLOCK_SIZE, 0), (BLOCK_SIZE-bevel, bevel), (BLOCK_SIZE-bevel, BLOCK_SIZE-bevel), (BLOCK_SIZE, BLOCK_SIZE)])
    
    # Inner detail (Pixel Art Look)
    inner = pygame.Rect(bevel, bevel, BLOCK_SIZE - bevel*2, BLOCK_SIZE - bevel*2)
    pygame.draw.rect(surf, (255, 255, 255, 15), inner)
    
    # Ambient Occlusion (soft inner shadow)
    ao_surf = pygame.Surface((BLOCK_SIZE, BLOCK_SIZE), pygame.SRCALPHA)
    pygame.draw.rect(ao_surf, (0, 0, 0, 40), ao_surf.get_rect(), 2)
    surf.blit(ao_surf, (0, 0))
    
    # TNT Label
    if b_type == "TNT":
        tnt_font = pygame.font.SysFont("Arial", 14, bold=True)
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
    global depth, flash_alpha, screen_shake
    if col == 0 or col == COLS - 1: return # Cannot mine bedrock
        
    b_type = grid[col][row]
    block_counts[b_type] += 1
    
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
        screen_shake = 25.0
        for c in range(1, COLS - 1):
            for r in range(3): # Clear bottom 3 rows
                target_r = ROWS - 1
                tb_type = grid[c][target_r]
                block_counts[tb_type] += 1
                
                tx = SHAFT_X + c * BLOCK_SIZE + BLOCK_SIZE // 2
                ty = SHAFT_Y + target_r * BLOCK_SIZE + BLOCK_SIZE // 2
                spawn_particles(tx, ty, BLOCK_COLORS[tb_type]["base"], count=5)
                
                for i in range(target_r, 0, -1):
                    grid[c][i] = grid[c][i-1]
                grid[c][0] = get_random_block()
        depth -= 3

# ==========================================
# MAIN LOOP
# ==========================================
last_mine_time = pygame.time.get_ticks()
last_cmd_time = pygame.time.get_ticks()
MINE_RATE_MS = 150
pulse_time = 0

running = True
while running:
    dt = clock.tick(FPS) / 1000.0
    current_time = pygame.time.get_ticks()
    pulse_time += dt
    
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
            flash_alpha = 255.0
            screen_shake = 35.0
            for c in range(1, COLS - 1):
                for r in range(ROWS - 1, 9, -1):
                    grid[c][r] = grid[c][r - 10]
                for r in range(10):
                    grid[c][r] = get_random_block()
                tx = SHAFT_X + c * BLOCK_SIZE + BLOCK_SIZE // 2
                ty = SHAFT_Y + (ROWS - 1) * BLOCK_SIZE
                spawn_particles(tx, ty, (255, 255, 255), count=15)
            depth -= 10
        elif cmd.startswith("!drop "):
            item = cmd.split(" ")[1]
            if item in BLOCK_TYPES:
                c = random.randint(1, COLS - 2)
                grid[c][0] = item

    # Auto Mining
    if current_time - last_mine_time > MINE_RATE_MS:
        target_col = random.randint(1, COLS - 2)
        mine_block(target_col, ROWS - 1)
        depth -= 1
        target_pickaxe_angle = -45 if target_col < COLS // 2 else 45
        last_mine_time = current_time

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
            
    # Update Effects
    if flash_alpha > 0:
        flash_alpha = max(0, flash_alpha - 500 * dt)
    if screen_shake > 0:
        screen_shake = max(0, screen_shake - 60 * dt)

    shake_x = random.uniform(-screen_shake, screen_shake) if screen_shake > 0 else 0
    shake_y = random.uniform(-screen_shake, screen_shake) if screen_shake > 0 else 0

    # ==========================================
    # DRAWING
    # ==========================================
    screen.fill((2, 2, 2)) # Deep cave background
    
    # 1. Center Mine Shaft
    shaft_rect = pygame.Rect(SHAFT_X + shake_x, SHAFT_Y + shake_y, SHAFT_WIDTH, SHAFT_HEIGHT)
    pygame.draw.rect(screen, (5, 5, 5), shaft_rect)
    pygame.draw.rect(screen, (30, 30, 30), shaft_rect, 4)
    
    # Draw Grid with Dynamic Depth Lighting
    for c in range(COLS):
        for r in range(ROWS):
            b_type = grid[c][r]
            bx = SHAFT_X + c * BLOCK_SIZE + shake_x
            by = SHAFT_Y + r * BLOCK_SIZE + shake_y
            screen.blit(block_surfaces[b_type], (bx, by))
            
            # Dynamic Depth Lighting (Vignette & Fog)
            shadow_intensity = min(240, int((r / ROWS) * 200 + 40))
            shadow_surf = pygame.Surface((BLOCK_SIZE, BLOCK_SIZE), pygame.SRCALPHA)
            shadow_surf.fill((0, 0, 0, shadow_intensity))
            screen.blit(shadow_surf, (bx, by))
            
    # Draw Giant Pickaxe
    pickaxe_surf = pygame.Surface((120, 120), pygame.SRCALPHA)
    pygame.draw.rect(pickaxe_surf, (101, 67, 33), (55, 20, 12, 100)) # Handle
    pygame.draw.polygon(pickaxe_surf, (50, 200, 200), [(60, 30), (0, 60), (10, 20), (60, 0), (110, 20), (120, 60)]) # Head
    
    rotated_pickaxe = pygame.transform.rotate(pickaxe_surf, pickaxe_angle)
    pr = rotated_pickaxe.get_rect(center=(SHAFT_X + SHAFT_WIDTH // 2 + shake_x, SHAFT_Y + SHAFT_HEIGHT - 30 + shake_y))
    screen.blit(rotated_pickaxe, pr)
    
    # Draw Particles
    for p in particles:
        alpha = max(0, min(255, int(p['life'])))
        if alpha > 0:
            psurf = pygame.Surface((p['size'], p['size']), pygame.SRCALPHA)
            psurf.fill((*p['color'], alpha))
            screen.blit(psurf, (int(p['x'] + shake_x), int(p['y'] + shake_y)))
            
    # Draw Flash
    if flash_alpha > 0:
        flash_surf = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        flash_surf.fill((255, 255, 255, int(flash_alpha)))
        screen.blit(flash_surf, (0, 0))

    # 2. Left Sidebar (Glassmorphism)
    sidebar_bg = pygame.Surface((LEFT_PANEL_WIDTH, HEIGHT), pygame.SRCALPHA)
    sidebar_bg.fill((10, 15, 25, 200))
    screen.blit(sidebar_bg, (0, 0))
    pygame.draw.line(screen, (40, 50, 70), (LEFT_PANEL_WIDTH, 0), (LEFT_PANEL_WIDTH, HEIGHT), 2)
    
    # Pulsing LIVE indicator
    pulse_alpha = int((math.sin(pulse_time * 5) * 0.5 + 0.5) * 255)
    pygame.draw.circle(screen, (255, 0, 0, pulse_alpha), (30, 40), 10)
    pygame.draw.circle(screen, (255, 0, 0), (30, 40), 6)
    screen.blit(font_medium.render("LIVE", True, (255, 255, 255)), (50, 28))

    # Depth Counter
    depth_str = f"DEPTH: {int(depth):,}m"
    depth_text = font_large.render(depth_str, True, (100, 255, 100))
    screen.blit(depth_text, (20, 80))
    
    inv_title = font_small.render("INVENTORY", True, (150, 160, 180))
    screen.blit(inv_title, (20, 150))
    
    y_offset = 200
    for b_type in BLOCK_TYPES:
        count = block_counts[b_type]
        icon = pygame.transform.scale(block_surfaces[b_type], (32, 32))
        screen.blit(icon, (20, y_offset))
        text = font_medium.render(f"{b_type}: {count}", True, (220, 230, 240))
        screen.blit(text, (70, y_offset + 4))
        y_offset += 55

    # 3. Right Sidebar
    right_x = WIDTH - RIGHT_PANEL_WIDTH
    right_bg = pygame.Surface((RIGHT_PANEL_WIDTH, HEIGHT), pygame.SRCALPHA)
    right_bg.fill((10, 15, 25, 200))
    screen.blit(right_bg, (right_x, 0))
    pygame.draw.line(screen, (40, 50, 70), (right_x, 0), (right_x, HEIGHT), 2)
    
    chat_title = font_small.render("TOP CHATTERS", True, (150, 160, 180))
    screen.blit(chat_title, (right_x + 20, 40))
    
    y_offset = 80
    for name, score in [("1. GamerPro99", "15.2K"), ("2. UzbekNinja", "12.8K"), ("3. BlockMaster", "9.5K")]:
        screen.blit(font_small.render(name, True, (200, 210, 220)), (right_x + 20, y_offset))
        screen.blit(font_small.render(score, True, (255, 215, 0)), (WIDTH - 80, y_offset))
        y_offset += 35
        
    cmd_title = font_small.render("COMMANDS", True, (100, 150, 255))
    screen.blit(cmd_title, (right_x + 20, 320))
    
    y_offset = 360
    for cmd in ["> !drop TNT", "> !mega (Mega TNT)", "> !nuke (Clear 10 rows)", "> !siu (Celebration)"]:
        screen.blit(font_small.render(cmd, True, (150, 200, 255)), (right_x + 20, y_offset))
        y_offset += 35

    pygame.display.flip()

pygame.quit()
sys.exit()
`
