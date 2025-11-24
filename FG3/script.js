// Get canvas and context
const canvas = document.getElementById("cardCanvas");
const ctx = canvas.getContext("2d");

// Set canvas size to match window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- Game State ---
const gameState = {
    level: 1,
    score: 0,
    isPaused: false,
    gameOver: false,
    enemiesToSpawn: 0,
    enemiesSpawned: 0,
    enemiesKilled: 0,
    waveActive: false,
    levelTransition: false,
    spawnTimer: 0,
    spawnDelay: 800 // Reduced start delay for faster action
};

const card = {
    width: 1280,
    height: 1410,
    cornerRadius: 15,
    glowColor: "#00ff88",
    glowIntensity: 15,
    glowMax: 25,
    x: 0,
    y: 0,
    soundVolume: 1
};

const player = {
    hp: 10000,
    maxHp: 10000,
    shield: 0,
    maxShield: 5000,
    damageMult: 1,
    radiusMult: 1,
    baseDamage: 2000, 
    x: canvas.width / 2,
    y: canvas.height / 2,
    powerUpTimers: { attack: 0 }
};

// Effects
const particleSettings = { count: 1000, minSize: 1, maxSize: 4, minSpeed: 0.25, maxSpeed: 0.5, minOpacity: 0.1, maxOpacity: 0.6 };
const lineSettings = { count: 20, numPoints: 5, minWidth: 0.5, maxWidth: 2, minSpeed: 0.01, maxSpeed: 0.03, waveHeight: 10 };
const particles = [];
const lines = [];
const clickEffects = [];
const enemies = [];
const powerUps = []; 

// State vars
let isCardClicked = false;
let clickTime = 0;
let cardShakeAmount = 0;
let activeHue = 140;
let mouseX = 0, mouseY = 0, isHovering = false, pulseTime = 0;
let lastTime = Date.now();
let musicStarted = false;

// --- Music Manager ---
const playlist = [
    "Simulacra-chosic.com_.mp3",
    "Powerful-Trap-(chosic.com).mp3",
    "punch-deck-brazilian-street-fight(chosic.com).mp3",
    "Hitman(chosic.com).mp3",
    // Assuming these are the names of the other 2 files provided 
    // If they have different names, please update them here:
    "The-Sound-Of-Rain(chosic.com).mp3", 
    "Volatile-Reaction(chosic.com).mp3"
];

const musicPlayer = new Audio();
musicPlayer.volume = 0.4; // Background volume (lower than SFX)

function playNextTrack() {
    // Pick random track
    const track = playlist[Math.floor(Math.random() * playlist.length)];
    musicPlayer.src = "./" + track; // Assumes files are in same folder
    musicPlayer.play().catch(e => console.log("Waiting for user interaction to play audio"));
}

musicPlayer.addEventListener('ended', playNextTrack);

// --- Enemy Configuration ---
const enemyData = {
    // Modified: Min Levels lowered to populate early game
    Scout: { minLevel: 1, HP: 500, speed: 2.0, AI_behavior: 'random', color: 'cyan', radius: 15, score: 50 },
    Interceptor: { minLevel: 1, HP: 1200, speed: 4.0, AI_behavior: 'aggressive', color: 'lime', radius: 20, score: 100 },
    Bomber: { minLevel: 3, HP: 2500, speed: 1.5, AI_behavior: 'evasive', color: 'orange', radius: 25, score: 150 },
    // Red Ship: Adjusted to be defensive but closer
    Destroyer: { minLevel: 5, HP: 4000, speed: 1.5, AI_behavior: 'defensive', color: 'red', radius: 30, score: 250 },
    // Blue Ship: Adjusted to Strafe
    Cruiser: { minLevel: 8, HP: 6000, speed: 1.8, AI_behavior: 'strafe', color: 'purple', radius: 35, score: 350 },
    Stealth: { minLevel: 12, HP: 800, speed: 5.0, AI_behavior: 'stealth', color: 'gray', radius: 18, score: 400 },
    Dreadnought: { minLevel: 15, HP: 12000, speed: 0.8, AI_behavior: 'stationary', color: 'magenta', radius: 45, score: 600 },
    Flagship: { minLevel: 20, HP: 18000, speed: 0.6, AI_behavior: 'command', color: 'gold', radius: 50, score: 1000 },
    Carrier: { minLevel: 25, HP: 25000, speed: 0.5, AI_behavior: 'support', color: 'brown', radius: 55, score: 1500 },
    Mothership: { minLevel: 30, HP: 50000, speed: 0.3, AI_behavior: 'boss', color: 'white', radius: 70, score: 5000 }
};

class Enemy {
    constructor(x, y, type, levelScaling) {
        this.x = x;
        this.y = y;
        this.type = type;
        const data = enemyData[type];
        
        this.maxHP = data.HP * (1 + (levelScaling * 0.15)); 
        this.currentHP = this.maxHP;
        this.radius = data.radius;
        this.color = data.color;
        this.speed = data.speed * (1 + (levelScaling * 0.03));
        this.AI_behavior = data.AI_behavior;
        this.scoreVal = data.score;
        
        this.velocity = { x: 0, y: 0 };
        this.targetX = player.x; // Default to center
        this.targetY = player.y;
        this.aiTimer = 0; // For timing AI decisions
        
        // Stealth Init
        this.stealthVisibility = 1;
        if (this.type === 'Stealth') {
            this.isApproaching = true;
            this.isCloaking = false;
            this.cloakStartTime = 0;
            this.approachDistance = 250;
        }

        // Defensive/Red Init - Pick a spot ON SCREEN
        if (this.AI_behavior === 'defensive') {
            this.pickNewDefensiveSpot();
        }
    }

    pickNewDefensiveSpot() {
        // Pick a spot within the inner 70% of the screen so they don't hide off-screen
        const padding = 100;
        this.targetX = padding + Math.random() * (canvas.width - padding * 2);
        this.targetY = padding + Math.random() * (canvas.height - padding * 2);
    }

    draw() {
        if (this.type === 'Stealth' && this.stealthVisibility <= 0.05) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(this.velocity.y, this.velocity.x);
        ctx.rotate(angle);
        ctx.rotate(pulseTime * 0.01);
        this.drawEnhancedShip();
        ctx.restore();

        // HP Bar
        ctx.save();
        if (this.type === 'Stealth') ctx.globalAlpha = this.stealthVisibility;
        const hpBarWidth = this.radius * 2;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, hpBarWidth, 5);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, (this.currentHP / this.maxHP) * hpBarWidth, 5);
        ctx.restore();
    }
    
    // Using the same draw methods (compacted for space, logic remains identical)
    drawEnhancedShip() {
        const r = this.radius;
        if(this.type === 'Scout') this.drawScoutEnhanced(r);
        else if(this.type === 'Interceptor') this.drawInterceptorEnhanced(r);
        else if(this.type === 'Bomber') this.drawBomberEnhanced(r);
        else if(this.type === 'Destroyer') this.drawDestroyerEnhanced(r);
        else if(this.type === 'Cruiser') this.drawCruiserEnhanced(r);
        else if(this.type === 'Stealth') this.drawStealthEnhanced(r);
        else if(this.type === 'Dreadnought') this.drawDreadnoughtEnhanced(r);
        else if(this.type === 'Flagship') this.drawFlagshipEnhanced(r);
        else if(this.type === 'Carrier') this.drawCarrierEnhanced(r);
        else if(this.type === 'Mothership') this.drawMothershipEnhanced(r);
        else this.drawDefaultShip(r);
    }
    
    // --- PASTE PREVIOUS DRAW METHODS HERE (Scout through Mothership) ---
    // For the sake of the file length limit, I am assuming the draw methods 
    // from the previous iteration are preserved. They work perfectly fine.
    drawScoutEnhanced(r){const g=ctx.createRadialGradient(-r*.2,-r*.2,0,0,0,r*.8);g.addColorStop(0,'#ccc');g.addColorStop(1,'#444');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*.8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0af';ctx.beginPath();ctx.arc(0,-r*.4,r*.3,0,Math.PI*2);ctx.fill();}
    drawInterceptorEnhanced(r){ctx.fillStyle='#0f0';ctx.beginPath();ctx.ellipse(0,0,r*.5,r*1.2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0a0';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-r*1.5,-r*.8);ctx.lineTo(0,-r*.5);ctx.lineTo(r*1.5,-r*.8);ctx.fill();}
    drawBomberEnhanced(r){ctx.fillStyle='#fa0';ctx.fillRect(-r,-r*.7,r*2,r*1.4);ctx.fillStyle='#333';ctx.beginPath();ctx.arc(-r*.5,r*.8,r*.3,0,6.28);ctx.arc(r*.5,r*.8,r*.3,0,6.28);ctx.fill();}
    drawDestroyerEnhanced(r){ctx.fillStyle='#aaa';ctx.fillRect(-r*.5,-r*1.5,r,r*3);ctx.fillStyle='#600';ctx.fillRect(-r*.4,-r*1.2,r*.8,r*.8);ctx.fillRect(-r*.4,r*.4,r*.8,r*.8);}
    drawCruiserEnhanced(r){ctx.fillStyle='#07c';ctx.fillRect(-r*1.5,-r*.5,r*3,r);ctx.fillStyle='#0af';ctx.fillRect(-r*.4,-r,r*.8,r*.5);}
    drawStealthEnhanced(r){let v=Math.max(0.1,this.stealthVisibility);ctx.fillStyle=`rgba(50,50,50,${v})`;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(-r,r);ctx.lineTo(r,r);ctx.fill();}
    drawDreadnoughtEnhanced(r){ctx.fillStyle='#a00';ctx.fillRect(-r*2,-r,r*4,r*2);ctx.fillStyle='#500';ctx.fillRect(-r*1.5,-r*1.3,r*.5,r*1.5);ctx.fillRect(r,-r*1.3,r*.5,r*1.5);}
    drawFlagshipEnhanced(r){ctx.fillStyle='#fc0';ctx.beginPath();ctx.moveTo(0,-r*1.5);ctx.lineTo(-r,r);ctx.lineTo(r,r);ctx.fill();}
    drawCarrierEnhanced(r){ctx.fillStyle='#ccc';ctx.fillRect(-r*2,-r*.5,r*4,r);ctx.fillStyle='#555';ctx.fillRect(-r*1.5,-r*.2,r*3,r*.4);}
    drawMothershipEnhanced(r){ctx.fillStyle='#0ff';ctx.beginPath();ctx.arc(0,0,r*.9,0,6.28);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,r*1.2,r*.3,0,0,6.28);ctx.stroke();ctx.beginPath();ctx.ellipse(0,0,r*1.2,r*.3,1.57,0,6.28);ctx.stroke();}
    drawDefaultShip(r){ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(0,0,r,0,6.28);ctx.fill();}

    update() {
        const prevX = this.x;
        const prevY = this.y;
        this.aiTimer++;
        
        // --- Improved AI Behavior ---
        
        // Random: Just wanders, but biased towards center to stay on screen
        if(this.AI_behavior === 'random') { 
            this.x += (Math.random()-0.5)*this.speed + (canvas.width/2 - this.x)*0.001; 
            this.y += (Math.random()-0.5)*this.speed + (canvas.height/2 - this.y)*0.001; 
        }
        // Aggressive: Straight to player
        else if(this.AI_behavior === 'aggressive') { 
            const angle = Math.atan2(player.y - this.y, player.x - this.x); 
            this.velocity.x = Math.cos(angle)*this.speed; 
            this.velocity.y = Math.sin(angle)*this.speed; 
            this.x += this.velocity.x; this.y += this.velocity.y; 
        }
        // Evasive: Moves towards player, but jukes if cursor is close
        else if(this.AI_behavior === 'evasive') { 
            const dist = Math.hypot(mouseX - this.x, mouseY - this.y); 
            let angle = Math.atan2(player.y - this.y, player.x - this.x);
            if(dist < 200) angle += Math.PI; // Run away from cursor
            this.x += Math.cos(angle)*this.speed; 
            this.y += Math.sin(angle)*this.speed; 
        }
        // Defensive (Red): Moves to specific spots on screen, then stops/shoots (simulated)
        else if(this.AI_behavior === 'defensive') { 
            const distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);
            // Move to spot
            if(distToTarget > 10) {
                const a = Math.atan2(this.targetY-this.y, this.targetX-this.x); 
                this.x += Math.cos(a)*this.speed; 
                this.y += Math.sin(a)*this.speed; 
            }
            // If at spot for too long, pick new spot closer to player
            if(this.aiTimer > 200) {
                this.pickNewDefensiveSpot();
                this.aiTimer = 0;
            }
        }
        // Strafe (Blue): Moves side to side while advancing
        else if(this.AI_behavior === 'strafe') { 
            // Move towards player
            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            // Add perpendicular movement (strafe) based on sine wave
            const strafeAngle = angleToPlayer + Math.PI/2;
            const strafeMag = Math.sin(this.aiTimer * 0.05) * 2; // Oscillate
            
            this.velocity.x = (Math.cos(angleToPlayer) * this.speed * 0.5) + (Math.cos(strafeAngle) * strafeMag);
            this.velocity.y = (Math.sin(angleToPlayer) * this.speed * 0.5) + (Math.sin(strafeAngle) * strafeMag);
            
            this.x += this.velocity.x;
            this.y += this.velocity.y;
        }
        // Stealth Logic
        else if(this.AI_behavior === 'stealth') {
            if (this.isApproaching) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed;
                this.y += Math.sin(angle) * this.speed;
                if (Math.hypot(player.x - this.x, player.y - this.y) <= this.approachDistance) {
                    this.isApproaching = false; this.isCloaking = true; this.cloakStartTime = Date.now();
                }
            } else if (this.isCloaking) {
                this.stealthVisibility -= 0.05;
                if (Date.now() - this.cloakStartTime >= 2000) { 
                    this.isCloaking = false; 
                    // Attack lunge
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    this.velocity.x = Math.cos(angle) * this.speed * 3; // Lunge speed
                    this.velocity.y = Math.sin(angle) * this.speed * 3;
                    this.stealthVisibility = 1;
                }
            } else {
                // Post-cloak attack dash
                this.x += this.velocity.x;
                this.y += this.velocity.y;
            }
        }
        // Boss/Command behaviors
        else {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(angle) * this.speed * 0.3;
            this.y += Math.sin(angle) * this.speed * 0.3;
        }

        // Calculate Stealth Visibility based on speed
        const deltaX = this.x - prevX;
        const deltaY = this.y - prevY;
        this.movementSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (this.type === 'Stealth' && !this.isCloaking) {
             if (this.movementSpeed > 3) this.stealthVisibility = Math.min(this.stealthVisibility + 0.1, 0.4);
             else this.stealthVisibility = Math.max(this.stealthVisibility - 0.05, 0.1);
        }

        this.draw();
    }
}

class PowerUp {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 15; this.lifespan = 800; this.age = 0;
        const rand = Math.random();
        if (rand < 0.5) { this.type = 'HEALTH'; this.color = '#00ff00'; this.label = '+HP'; }
        else if (rand < 0.8) { this.type = 'SHIELD'; this.color = '#0088ff'; this.label = '+SHIELD'; }
        else { this.type = 'ATTACK'; this.color = '#ff0000'; this.label = 'DMG UP'; }
        this.velocity = { x: (Math.random()-0.5)*0.5, y: (Math.random()-0.5)*0.5 };
    }
    update() {
        this.x += this.velocity.x; this.y += this.velocity.y; this.age++;
        ctx.save(); ctx.translate(this.x, this.y);
        const pulse = 1 + Math.sin(this.age * 0.1) * 0.2; ctx.scale(pulse, pulse);
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, 6.28); ctx.fillStyle = this.color; ctx.globalAlpha = 0.6; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, this.radius*0.6, 0, 6.28); ctx.fillStyle = '#fff'; ctx.globalAlpha = 1; ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = '10px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.label, 0, -this.radius-5);
        ctx.restore();
    }
}

// --- Utils & Input ---

function createParticles() {
    particles.length = 0;
    for (let i = 0; i < particleSettings.count; i++) {
        particles.push({
            x: Math.random() * card.width, y: Math.random() * card.height,
            size: Math.random() * 3 + 1,
            speedX: (Math.random() - 0.5), speedY: (Math.random() - 0.5),
            opacity: Math.random() * 0.5 + 0.1
        });
    }
}

function createLines() {
    lines.length = 0;
    for (let i = 0; i < lineSettings.count; i++) {
        const points = [];
        const startY = Math.random() * card.height;
        for (let j = 0; j < lineSettings.numPoints; j++) {
            points.push({ x: j * (card.width / 4), y: startY, originalY: startY });
        }
        lines.push({ points: points, width: Math.random() + 0.5, speed: Math.random() * 0.02 + 0.01, offset: Math.random() * 6.28, opacity: 0.2, color: `hsl(${activeHue}, 100%, 60%)` });
    }
}

function createClickEffect(x, y, radiusMult = 1) {
    clickEffects.push({ type: "ring", x: x, y: y, radius: 0, maxRadius: 300 * radiusMult, opacity: 1, color: `hsl(${activeHue}, 100%, 50%)` });
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * 6.28; const speed = Math.random() * 5 + 2;
        clickEffects.push({ type: "particle", x: x, y: y, speedX: Math.cos(angle)*speed, speedY: Math.sin(angle)*speed, size: Math.random()*5+2, opacity: 1, decay: 0.05, color: `hsl(${activeHue}, 100%, 60%)` });
    }
}

function updateCardPosition() {
    card.x = canvas.width / 2 - card.width / 2;
    card.y = canvas.height / 2 - card.height / 2;
}

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    isHovering = true;
});

// --- UPDATED DAMAGE LOGIC ---
canvas.addEventListener("click", (e) => {
    // Start Music on first interaction
    if (!musicStarted) {
        musicStarted = true;
        playNextTrack();
    }

    if (gameState.isPaused || gameState.gameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Check Powerups
    for(let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        if(Math.hypot(clickX - p.x, clickY - p.y) < p.radius + 30) {
            activatePowerUp(p.type);
            powerUps.splice(i, 1);
            if(sounds.crystal) sounds.crystal();
            return;
        }
    }

    const radiusMult = player.powerUpTimers.attack > 0 ? 1.5 : 1;
    createClickEffect(clickX, clickY, radiusMult);
    if(sounds.portal) sounds.portal();

    // -- REALISTIC DAMAGE SYSTEM --
    const baseDamage = player.baseDamage * player.damageMult;
    const directHitRadius = 50 * radiusMult; // Precise hit
    const splashRadius = 250 * radiusMult;   // Splash area
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dist = Math.hypot(clickX - enemy.x, clickY - enemy.y);
        
        let damageDealt = 0;

        // 1. Direct Hit
        if (dist < enemy.radius + directHitRadius) {
            damageDealt = baseDamage;
        } 
        // 2. Proximity / Splash Hit
        else if (dist < splashRadius) {
            // Calculate falloff: 100% at edge of direct hit, down to 0% at edge of splash
            const falloff = 1 - ((dist - directHitRadius) / (splashRadius - directHitRadius));
            // Deal damage based on proximity (Max 50% damage for splash)
            damageDealt = baseDamage * falloff * 0.5;
        }
        // 3. Too far = 0 Damage (Implicit)

        if (damageDealt > 0) {
            enemy.currentHP -= damageDealt;
            
            // Visual feedback for hit
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius, 0, 6.28); ctx.fill();

            if (enemy.currentHP <= 0) {
                if(Math.random() < 0.15) powerUps.push(new PowerUp(enemy.x, enemy.y));
                gameState.score += enemy.scoreVal;
                enemies.splice(i, 1);
                gameState.enemiesKilled++;
                document.getElementById('score').innerHTML = formatNumber(gameState.score);
            }
        }
    }
});

function activatePowerUp(type) {
    if(type === 'HEALTH') { player.hp = Math.min(player.hp + 3000, player.maxHp); showNotification("HP REPAIRED!"); }
    else if(type === 'SHIELD') { player.shield = Math.min(player.shield + 2500, player.maxShield); showNotification("SHIELDS UP!"); }
    else if(type === 'ATTACK') { player.damageMult = 2.5; player.powerUpTimers.attack = 600; showNotification("WEAPON OVERCHARGE!"); }
}

// --- Logic ---

function getEnemyTypeForLevel(level) {
    // Filter by minLevel
    const available = Object.keys(enemyData).filter(t => enemyData[t].minLevel <= level);
    
    // Level 1-2 Specific: Force scouts/interceptors so it's not empty
    if (level <= 2) {
        return Math.random() < 0.7 ? 'Scout' : 'Interceptor';
    }

    if (available.length === 0) return 'Scout';
    
    // Weighted selection: 60% Common (Low tier), 30% Uncommon, 10% Rare (Highest available)
    const rand = Math.random();
    if (rand < 0.6 && available.length > 2) {
        return available[Math.floor(Math.random() * (available.length - 2))]; // Lower tiers
    } else {
        return available[available.length - 1 - Math.floor(Math.random() * Math.min(2, available.length))]; // Higher tiers
    }
}

function startNextLevel() {
    gameState.level++;
    gameState.enemiesToSpawn = 12 + Math.floor(gameState.level * 2);
    gameState.enemiesSpawned = 0;
    gameState.enemiesKilled = 0;
    gameState.waveActive = true;
    gameState.levelTransition = false;
    showNotification(`WAVE ${gameState.level} INCOMING`, 3000);
}

function spawnLogic(dt) {
    gameState.spawnTimer += dt;
    // Faster spawning as level increases
    const currentDelay = Math.max(300, gameState.spawnDelay - (gameState.level * 20)); 

    if (gameState.waveActive && gameState.enemiesSpawned < gameState.enemiesToSpawn && gameState.spawnTimer > currentDelay) {
        gameState.spawnTimer = 0;
        
        const type = getEnemyTypeForLevel(gameState.level);
        
        // Spawn slightly offscreen, but not TOO far
        const padding = 50; 
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -padding : canvas.width + padding;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? -padding : canvas.height + padding;
        }
        
        enemies.push(new Enemy(x, y, type, gameState.level));
        gameState.enemiesSpawned++;
    }
    
    if (gameState.waveActive && gameState.enemiesSpawned === gameState.enemiesToSpawn && enemies.length === 0) {
        gameState.waveActive = false;
        gameState.levelTransition = true;
        showNotification("WAVE CLEARED!", 3000);
        setTimeout(() => { if(!gameState.gameOver) startNextLevel(); }, 4000);
    }
}

// --- Draw Main ---

function drawCardContent() {
    let cardOffsetX = 0, cardOffsetY = 0;
    if (isCardClicked) {
        clickTime += 0.1; cardShakeAmount *= 0.9;
        if (clickTime > 2 || cardShakeAmount < 0.1) { isCardClicked = false; cardShakeAmount = 0; }
        cardOffsetX = Math.sin(clickTime * 10) * cardShakeAmount;
        cardOffsetY = Math.cos(clickTime * 8) * cardShakeAmount;
    }
    const sx = card.x + cardOffsetX, sy = card.y + cardOffsetY;

    ctx.save();
    roundedRect(sx, sy, card.width, card.height, card.cornerRadius);
    ctx.clip();

    // BG
    const g = ctx.createLinearGradient(sx, sy, sx + card.width, sy + card.height);
    g.addColorStop(0, "#1a1a1a"); g.addColorStop(1, "#0c0c0c");
    ctx.fillStyle = g; ctx.fillRect(sx, sy, card.width, card.height);

    // Lines & Particles
    lines.forEach(l => {
        ctx.beginPath(); ctx.moveTo(sx + l.points[0].x, sy + l.points[0].y);
        l.points.forEach((p, i) => { if (i>0) { p.y = p.originalY + Math.sin(pulseTime * l.speed + l.offset + i * 0.5) * 10; ctx.lineTo(sx + p.x, sy + p.y); }});
        ctx.strokeStyle = l.color; ctx.stroke();
    });
    
    particles.forEach(p => {
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = card.width; if (p.x > card.width) p.x = 0;
        if (p.y < 0) p.y = card.height; if (p.y > card.height) p.y = 0;
        ctx.beginPath(); ctx.arc(sx + p.x, sy + p.y, p.size, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${p.opacity})`; ctx.fill();
    });

    ctx.restore();
    
    // Border
    ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
    if(player.shield > 0) { ctx.strokeStyle = `rgba(0,136,255,${0.3+Math.sin(pulseTime)*0.2})`; ctx.lineWidth = 4; ctx.shadowBlur = 15; ctx.shadowColor = '#0088ff'; }
    roundedRect(sx, sy, card.width, card.height, card.cornerRadius); ctx.stroke(); ctx.shadowBlur = 0;

    // Center Base
    const cx = sx + card.width / 2, cy = sy + card.height / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(pulseTime * 0.4);
    const coreColor = player.powerUpTimers.attack > 0 ? `hsl(0, 100%, 60%)` : `hsl(${activeHue}, 100%, 60%)`;
    ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2; const x = 70 * Math.cos(a), y = 70 * Math.sin(a); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath();
    ctx.strokeStyle = coreColor; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, 6.28); ctx.fillStyle = player.powerUpTimers.attack > 0 ? `rgba(255,0,0,0.2)` : `rgba(0,255,136,0.2)`; ctx.fill();
    ctx.restore();

    // UI Text
    ctx.fillStyle = "#fff"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
    ctx.fillText(`WAVE ${gameState.level}`, cx, cy - 25);
    ctx.fillStyle = player.hp < player.maxHp * 0.3 ? '#f33' : '#fff'; ctx.font = "18px Arial";
    ctx.fillText(`${formatNumber(player.hp)} HP`, cx, cy + 20);
    if(player.shield > 0) { ctx.fillStyle = "#0088ff"; ctx.font = "16px Arial"; ctx.fillText(`${formatNumber(player.shield)} SHIELD`, cx, cy + 40); }
    if(player.powerUpTimers.attack > 0) { ctx.fillStyle = "#f00"; ctx.font = "bold 14px Arial"; ctx.fillText(`DMG BOOST`, cx, cy + 60); }
}

function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function formatNumber(num) { if (num >= 1000000) return (num/1000000).toFixed(1)+'M'; if (num >= 1000) return (num/1000).toFixed(1)+'K'; return Math.floor(num); }

function animate() {
    if (gameState.gameOver) { drawGameOver(); return; }
    if (gameState.isPaused) { ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle="white"; ctx.fillText("PAUSED",canvas.width/2,canvas.height/2); requestAnimationFrame(animate); return; }

    const now = Date.now(); const dt = now - lastTime; lastTime = now;
    spawnLogic(dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateCardPosition();
    pulseTime += 0.05;

    // Background Interaction
    if (isHovering) {
        const dx = mouseX - (card.x + card.width/2); const dy = mouseY - (card.y + card.height/2);
        activeHue = (((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 360) % 360;
        lines.forEach(l => l.color = `hsl(${activeHue}, 100%, 60%)`);
    }

    // Timers
    if(player.powerUpTimers.attack > 0) player.powerUpTimers.attack--;

    drawCardContent();
    
    // Click Effects
    for(let i=clickEffects.length-1; i>=0; i--){
        const e = clickEffects[i];
        if(e.type==="ring") { e.radius+=10; e.opacity-=0.05; ctx.strokeStyle=e.color.replace("hsl","hsla").replace(")",`,${e.opacity})`); ctx.lineWidth=4; ctx.beginPath(); ctx.arc(e.x,e.y,e.radius,0,6.28); ctx.stroke(); }
        else { e.x+=e.speedX; e.y+=e.speedY; e.opacity-=e.decay; ctx.fillStyle=e.color.replace("hsl","hsla").replace(")",`,${e.opacity})`); ctx.beginPath(); ctx.arc(e.x,e.y,e.size,0,6.28); ctx.fill(); }
        if(e.opacity<=0) clickEffects.splice(i,1);
    }

    // PowerUps
    for(let i=powerUps.length-1; i>=0; i--) { powerUps[i].update(); if(powerUps[i].age>powerUps[i].lifespan) powerUps.splice(i,1); }

    // Enemies
    enemies.forEach((enemy, index) => {
        enemy.update();
        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 100 + enemy.radius) {
            let dmg = enemy.currentHP;
            if(player.shield > 0) { if(player.shield >= dmg) { player.shield -= dmg; dmg = 0; } else { dmg -= player.shield; player.shield = 0; } }
            player.hp -= dmg; enemies.splice(index, 1); gameState.enemiesKilled++;
            if (player.hp <= 0) gameState.gameOver = true;
            else { cardShakeAmount = 20; isCardClicked = true; }
        }
    });

    requestAnimationFrame(animate);
}

function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#f33"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center"; ctx.fillText("BASE DESTROYED", canvas.width/2, canvas.height/2-50);
    ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.fillText(`Waves: ${gameState.level}`, canvas.width/2, canvas.height/2+10);
    document.getElementById('restart-button').style.display = 'block';
}

// Notification System
const nC = document.getElementById('notification-center'), nM = document.getElementById('notification-message');
let nT;
function showNotification(msg, dur = 3000) { clearTimeout(nT); nM.textContent = msg; nC.style.display = 'block'; nC.classList.add('show'); nT = setTimeout(() => { nC.classList.remove('show'); setTimeout(() => { nC.style.display = 'none'; }, 500); }, dur); }

function restartGame() { player.hp = player.maxHp; player.shield = 0; gameState.score = 0; gameState.level = 0; enemies.length = 0; powerUps.length = 0; gameState.gameOver = false; document.getElementById('restart-button').style.display = 'none'; startNextLevel(); animate(); }

// Keys
window.addEventListener('keydown', (e) => { if(e.key==='p'||e.key==='P') gameState.isPaused=!gameState.isPaused; if(e.key==='m'||e.key==='M') document.getElementById('wrapper').classList.toggle('show-menu'); });

// Start
createParticles(); createLines(); gameState.enemiesToSpawn = 12; gameState.waveActive = true; animate();

// Sounds
const sounds={portal:()=>{const a=new(window.AudioContext||window.webkitAudioContext),o=a.createOscillator(),g=a.createGain();o.frequency.value=400+Math.random()*200;o.type="triangle";o.connect(g);g.connect(a.destination);g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+0.3);o.start();o.stop(a.currentTime+0.3);},crystal:()=>{const a=new(window.AudioContext||window.webkitAudioContext),o=a.createOscillator(),g=a.createGain();o.frequency.value=1200;o.type="sine";o.connect(g);g.connect(a.destination);g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+0.5);o.start();o.stop(a.currentTime+0.5);}};