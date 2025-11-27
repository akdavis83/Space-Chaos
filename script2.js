// Get canvas and context
const canvas = document.getElementById("cardCanvas");
const ctx = canvas.getContext("2d");

// Set canvas size to match window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// Call resize initially and on window resize
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// --- Game State & Configuration ---
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
    spawnDelay: 1000 // ms between spawns
};

const card = {
    width: 1280,
    height: 1410,
    cornerRadius: 15,
    glowColor: "#00ff88",
    glowIntensity: 15,
    glowMax: 25,
    rotation: 0,
    glowHue: 140,
    glowSaturation: 100,
    glowLightness: 50,
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
    baseDamage: 2000, // increased base damage
    x: canvas.width / 2,
    y: canvas.height / 2,
    powerUpTimers: {
        attack: 0
    }
};

// Card description timer
let descriptionStartTime = Date.now();
const descriptionDisplayDuration = 3000; 

const particleSettings = {
    count: 1000, // Used as visual count AND base damage calculator
    minSize: 1,
    maxSize: 4,
    minSpeed: 0.25,
    maxSpeed: 0.5,
    minOpacity: 0.1,
    maxOpacity: 0.6
};

const lineSettings = {
    count: 20,
    minWidth: 0.5,
    maxWidth: 2,
    minSpeed: 0.01,
    maxSpeed: 0.03,
    minOpacity: 0.05,
    maxOpacity: 0.2,
    waveHeight: 10,
    numPoints: 5
};

// Arrays for game entities
const particles = [];
const lines = [];
const clickEffects = [];
const enemies = [];
const powerUps = []; 

// Interaction State
let isCardClicked = false;
let clickTime = 0;
let cardShakeAmount = 0;
let activeHue = 140;
let mouseX = 0;
let mouseY = 0;
let isHovering = false;
let pulseTime = 0;
let lastTime = Date.now(); // Delta time tracking

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

// --- Enemy Data & Configuration ---
// All enemies enabled and balanced
const enemyData = {
    Scout: { minLevel: 1, HP: 500, speed: 1.5, AI_behavior: 'random', color: 'cyan', radius: 15, score: 50 },
    Interceptor: { minLevel: 2, HP: 1200, speed: 3.5, AI_behavior: 'aggressive', color: 'lime', radius: 20, score: 100 },
    Bomber: { minLevel: 5, HP: 2500, speed: 1.2, AI_behavior: 'evasive', color: 'orange', radius: 25, score: 150 },
    Destroyer: { minLevel: 8, HP: 4000, speed: 1.0, AI_behavior: 'defensive', color: 'red', radius: 30, score: 250 },
    Cruiser: { minLevel: 12, HP: 6000, speed: 0.9, AI_behavior: 'patrol', color: 'purple', radius: 35, score: 350 },
    Stealth: { minLevel: 15, HP: 800, speed: 4.0, AI_behavior: 'stealth', color: 'gray', radius: 18, score: 400 },
    Dreadnought: { minLevel: 20, HP: 12000, speed: 0.5, AI_behavior: 'stationary', color: 'magenta', radius: 45, score: 600 },
    Flagship: { minLevel: 30, HP: 18000, speed: 0.4, AI_behavior: 'command', color: 'gold', radius: 50, score: 1000 },
    Carrier: { minLevel: 40, HP: 25000, speed: 0.3, AI_behavior: 'support', color: 'brown', radius: 55, score: 1500 },
    Mothership: { minLevel: 50, HP: 50000, speed: 0.2, AI_behavior: 'boss', color: 'white', radius: 70, score: 5000 }
};

class Enemy {
    constructor(x, y, type, levelScaling) {
        this.x = x;
        this.y = y;
        this.type = type;
        const data = enemyData[type];
        
        // Scale HP based on game level
        this.maxHP = data.HP * (1 + (levelScaling * 0.1)); 
        this.currentHP = this.maxHP;
        
        this.radius = data.radius;
        this.color = data.color;
        this.speed = data.speed * (1 + (levelScaling * 0.02)); // Speed increases slightly per level
        this.AI_behavior = data.AI_behavior;
        this.scoreVal = data.score;
        
        this.velocity = { x: 0, y: 0 };
        this.targetX = canvas.width / 2;
        this.targetY = canvas.height / 2;
        
        // Stealth-specific
        this.movementSpeed = 0;
        this.stealthVisibility = 1;
        if (this.type === 'Stealth') {
            this.isApproaching = true;
            this.isCloaking = false;
            this.cloakStartTime = 0;
            this.cloakDuration = 2000;
            this.attackAfterCloak = false;
            this.approachDistance = 200 + Math.random() * 100;
        }
    }

    draw() {
        if (this.type === 'Stealth' && this.stealthVisibility <= 0) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(this.velocity.y, this.velocity.x);
        ctx.rotate(angle);
        ctx.rotate(pulseTime * 0.01);
        this.drawEnhancedShip();
        ctx.restore();

        // Draw HP bar
        ctx.save();
        if (this.type === 'Stealth') ctx.globalAlpha = this.stealthVisibility;
        const hpBarWidth = this.radius * 2;
        const hpBarHeight = 5;
        const hpBarX = this.x - this.radius;
        const hpBarY = this.y - this.radius - 10;
        
        ctx.fillStyle = 'red';
        ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(hpBarX, hpBarY, (this.currentHP / this.maxHP) * hpBarWidth, hpBarHeight);
        ctx.restore();
    }
    
    // (Keep all your existing drawEnhancedShip logic here)
    // For brevity in this response, I am calling a shared function, 
    // but in your file keep the full switch/case and individual draw methods.
    drawEnhancedShip() {
        const r = this.radius;
        // Check existing drawing functions in original code - reused here
        if(this['draw'+this.type+'Enhanced']) {
           this['draw'+this.type+'Enhanced'](r);
        } else {
            // Fallback if specific method not found (though you have them all)
            this.drawDefaultShip(r);
        }
    }
    
    // ... INSERT ALL YOUR DRAW METHODS (drawScoutEnhanced, etc) HERE ...
    // Paste the draw methods from your original script.js here
    
    drawScoutEnhanced(r) { /* Paste original code */ 
        const gradient = ctx.createRadialGradient(-r*0.2, -r*0.2, 0, 0, 0, r*0.8); gradient.addColorStop(0, '#cccccc'); gradient.addColorStop(0.7, '#888888'); gradient.addColorStop(1, '#444444'); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, r*0.8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#00aaff'; ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, -r*0.4, r*0.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#666666'; ctx.fillRect(-r*1.2, -r*0.2, r*0.4, r*0.8); ctx.fillRect(r*0.8, -r*0.2, r*0.4, r*0.8);
    }
    drawInterceptorEnhanced(r) { /* Paste original code */ 
        const bodyGradient = ctx.createLinearGradient(0, -r*1.2, 0, r*1.2); bodyGradient.addColorStop(0, '#00ff00'); bodyGradient.addColorStop(0.5, '#00cc00'); bodyGradient.addColorStop(1, '#008800'); ctx.fillStyle = bodyGradient; ctx.beginPath(); ctx.ellipse(0, 0, r*0.5, r*1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#00aa00'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r*1.5, -r*0.8); ctx.lineTo(-r*1.2, -r*0.6); ctx.lineTo(0, -r*0.5); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r*1.5, -r*0.8); ctx.lineTo(r*1.2, -r*0.6); ctx.lineTo(0, -r*0.5); ctx.fill(); ctx.fillStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(0, r*0.8, r*0.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    drawBomberEnhanced(r) { /* Paste original code */ 
         const bodyGradient = ctx.createLinearGradient(-r, 0, r, 0); bodyGradient.addColorStop(0, '#ffaa00'); bodyGradient.addColorStop(0.5, '#ff8800'); bodyGradient.addColorStop(1, '#cc6600'); ctx.fillStyle = bodyGradient; ctx.fillRect(-r, -r*0.7, r*2, r*1.4); ctx.fillStyle = '#ffcc44'; ctx.fillRect(-r*0.9, -r*0.6, r*1.8, r*0.2); ctx.fillStyle = '#333333'; ctx.shadowColor = '#666666'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(-r*0.5, r*0.8, r*0.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(r*0.5, r*0.8, r*0.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#555555'; ctx.beginPath(); ctx.arc(-r*0.5, r*0.7, r*0.1, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(r*0.5, r*0.7, r*0.1, 0, Math.PI * 2); ctx.fill();
    }
    drawDestroyerEnhanced(r) { /* Paste original code */ 
        const bodyGradient = ctx.createLinearGradient(0, -r*1.5, 0, r*1.5); bodyGradient.addColorStop(0, '#dddddd'); bodyGradient.addColorStop(0.5, '#bbbbbb'); bodyGradient.addColorStop(1, '#888888'); ctx.fillStyle = bodyGradient; ctx.fillRect(-r*0.5, -r*1.5, r, r*3); ctx.fillStyle = '#999999'; ctx.fillRect(-r*0.4, -r*1.4, r*0.8, r*0.2); ctx.fillRect(-r*0.4, r*1.2, r*0.8, r*0.2); ctx.fillStyle = '#777777'; ctx.fillRect(-r*0.4, -r*1.2, r*0.8, r*0.8); ctx.fillRect(-r*0.4, r*0.4, r*0.8, r*0.8); ctx.fillStyle = '#aaaaaa'; ctx.fillRect(-r*0.3, -r*1.1, r*0.6, r*0.1); ctx.fillRect(-r*0.3, r*0.5, r*0.6, r*0.1); ctx.fillStyle = '#444444'; ctx.fillRect(-r*0.1, -r*1.6, r*0.2, r*0.4); ctx.fillRect(-r*0.1, r*1.2, r*0.2, r*0.4);
    }
    drawCruiserEnhanced(r) { /* Paste original code */ 
        const bodyGradient = ctx.createLinearGradient(-r*1.5, 0, r*1.5, 0); bodyGradient.addColorStop(0, '#0099ff'); bodyGradient.addColorStop(0.5, '#0077cc'); bodyGradient.addColorStop(1, '#0055aa'); ctx.fillStyle = bodyGradient; ctx.fillRect(-r*1.5, -r*0.5, r*3, r); ctx.fillStyle = '#0077cc'; ctx.fillRect(-r*0.4, -r*1, r*0.8, r*0.5); ctx.fillStyle = '#00aaff'; ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 5; ctx.fillRect(-r*0.3, -r*0.9, r*0.6, r*0.1); ctx.shadowBlur = 0; ctx.fillStyle = '#00bbff'; ctx.fillRect(-r*1.4, -r*0.4, r*2.8, r*0.1); ctx.fillRect(-r*1.4, r*0.3, r*2.8, r*0.1);
    }
    drawDreadnoughtEnhanced(r) { /* Paste original code */ 
        const bodyGradient = ctx.createLinearGradient(-r*2, 0, r*2, 0); bodyGradient.addColorStop(0, '#ff4444'); bodyGradient.addColorStop(0.5, '#cc0000'); bodyGradient.addColorStop(1, '#880000'); ctx.fillStyle = bodyGradient; ctx.fillRect(-r*2, -r, r*4, r*2); ctx.fillStyle = '#aa0000'; ctx.fillRect(-r*1.9, -r*0.9, r*3.8, r*0.2); ctx.fillRect(-r*1.9, r*0.7, r*3.8, r*0.2); ctx.fillStyle = '#555555'; ctx.fillRect(-r*1.5, -r*1.3, r*0.5, r*1.5); ctx.fillRect(-r*0.25, -r*1.3, r*0.5, r*1.5); ctx.fillRect(r*1, -r*1.3, r*0.5, r*1.5); ctx.fillStyle = '#333333'; ctx.fillRect(-r*1.35, -r*1.5, r*0.2, r*0.8); ctx.fillRect(-r*0.1, -r*1.5, r*0.2, r*0.8); ctx.fillRect(r*1.15, -r*1.5, r*0.2, r*0.8); ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(-r*1.25, -r*1.5, r*0.1, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, -r*1.5, r*0.1, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(r*1.25, -r*1.5, r*0.1, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    drawStealthEnhanced(r) { /* Paste original code */ 
        const baseOpacity = 0.1; const visibility = Math.max(baseOpacity, this.stealthVisibility); ctx.fillStyle = `rgba(34, 34, 34, ${visibility * 0.8})`; ctx.beginPath(); for (let i = 0; i < 6; i++) { const angle = (i * Math.PI * 2) / 6; const x = Math.cos(angle) * r; const y = Math.sin(angle) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); const stealthGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r); stealthGradient.addColorStop(0, `rgba(68, 68, 68, ${visibility * 0.6})`); stealthGradient.addColorStop(0.7, `rgba(34, 34, 34, ${visibility * 0.4})`); stealthGradient.addColorStop(1, `rgba(17, 17, 17, ${visibility * 0.7})`); ctx.fillStyle = stealthGradient; ctx.beginPath(); for (let i = 0; i < 6; i++) { const angle = (i * Math.PI * 2) / 6; const x = Math.cos(angle) * r * 0.8; const y = Math.sin(angle) * r * 0.8; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.fill(); if (this.movementSpeed > 0.3) { const distortionIntensity = Math.min(this.movementSpeed / 2, 1); ctx.strokeStyle = `rgba(100, 150, 255, ${distortionIntensity * 0.4})`; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = pulseTime * 2; ctx.stroke(); ctx.setLineDash([]); for (let i = 0; i < 8; i++) { const shimmerAngle = (i * Math.PI * 2) / 8; const shimmerRadius = r * (0.9 + Math.sin(pulseTime * 3 + i) * 0.1); const shimmerX = Math.cos(shimmerAngle) * shimmerRadius; const shimmerY = Math.sin(shimmerAngle) * shimmerRadius; ctx.fillStyle = `rgba(150, 200, 255, ${distortionIntensity * 0.2})`; ctx.beginPath(); ctx.arc(shimmerX, shimmerY, 2, 0, Math.PI * 2); ctx.fill(); } } else { ctx.strokeStyle = `rgba(100, 100, 255, ${visibility * 0.2})`; ctx.lineWidth = 1; ctx.stroke(); }
    }
    drawFlagshipEnhanced(r) { /* Paste original code */ 
        const bodyGradient = ctx.createLinearGradient(0, -r*1.5, 0, r); bodyGradient.addColorStop(0, '#ffff00'); bodyGradient.addColorStop(0.5, '#ffcc00'); bodyGradient.addColorStop(1, '#ff9900'); ctx.fillStyle = bodyGradient; ctx.beginPath(); ctx.moveTo(0, -r*1.5); ctx.lineTo(-r, r); ctx.lineTo(r, r); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffaa00'; ctx.fillRect(-r*0.3, -r*0.8, r*0.6, r*0.4); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 5; ctx.fillRect(-r*0.25, -r*0.7, r*0.5, r*0.1); ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.ellipse(0, r*0.5, r*1.2, r*0.3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; for (let i = 0; i < 8; i++) { const angle = (i * Math.PI * 2) / 8; const x = Math.cos(angle) * r * 1.2; const y = r * 0.5 + Math.sin(angle) * r * 0.3; ctx.fillStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 5; ctx.beginPath(); ctx.arc(x, y, r*0.05, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
    }
    drawCarrierEnhanced(r) { /* Paste original code */ 
        const bodyGradient = ctx.createLinearGradient(0, -r*0.5, 0, r*0.5); bodyGradient.addColorStop(0, '#dddddd'); bodyGradient.addColorStop(0.5, '#cccccc'); bodyGradient.addColorStop(1, '#999999'); ctx.fillStyle = bodyGradient; ctx.fillRect(-r*2, -r*0.5, r*4, r); ctx.fillStyle = '#555555'; ctx.fillRect(-r*1.5, -r*0.2, r*3, r*0.4); ctx.fillStyle = '#ffff00'; for (let i = 0; i < 6; i++) { const x = -r*1.3 + (i * r*0.5); ctx.fillRect(x, -r*0.1, r*0.1, r*0.2); } ctx.fillStyle = '#333333'; ctx.fillRect(-r*1.8, -r*0.4, r*0.3, r*0.8); ctx.fillRect(r*1.5, -r*0.4, r*0.3, r*0.8); ctx.fillStyle = '#aaaaaa'; ctx.fillRect(-r*0.2, -r*0.8, r*0.4, r*0.3); ctx.fillStyle = '#00aaff'; ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 3; ctx.fillRect(-r*0.15, -r*0.7, r*0.3, r*0.05); ctx.shadowBlur = 0;
    }
    drawMothershipEnhanced(r) { /* Paste original code */ 
        const coreGradient = ctx.createRadialGradient(-r*0.3, -r*0.3, 0, 0, 0, r*0.9); coreGradient.addColorStop(0, '#00ffff'); coreGradient.addColorStop(0.5, '#00cccc'); coreGradient.addColorStop(1, '#008888'); ctx.fillStyle = coreGradient; ctx.beginPath(); ctx.arc(0, 0, r*0.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, r*0.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(0, 0, r*1.2, r*0.3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0, r*1.2, r*0.3, Math.PI/2, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; for (let ring = 0; ring < 2; ring++) { for (let i = 0; i < 12; i++) { const angle = (i * Math.PI * 2) / 12; const rotation = ring * Math.PI / 2; const x = Math.cos(angle + rotation) * r * 1.2; const y = Math.sin(angle + rotation) * r * 0.3; ctx.fillStyle = '#00ffff'; ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, r*0.03, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; } }
    }
    drawDefaultShip(r) { 
        ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); 
    }

    update() {
        const prevX = this.x;
        const prevY = this.y;
        
        // --- AI LOGIC (Same as original but compacted) ---
        if(this.AI_behavior === 'random') { this.x += (Math.random()-0.5)*this.speed; this.y += (Math.random()-0.5)*this.speed; }
        else if(this.AI_behavior === 'aggressive') { const angle = Math.atan2(player.y - this.y, player.x - this.x); this.velocity.x = Math.cos(angle)*this.speed; this.velocity.y = Math.sin(angle)*this.speed; this.x += this.velocity.x; this.y += this.velocity.y; }
        else if(this.AI_behavior === 'evasive') { const dist = Math.hypot(player.x - this.x, player.y - this.y); if(dist < 200) { const a = Math.atan2(this.y - player.y, this.x - player.x); this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed; } else { this.x += (Math.random()-0.5)*this.speed*0.5; this.y += (Math.random()-0.5)*this.speed*0.5; } }
        else if(this.AI_behavior === 'defensive') { const dist = Math.hypot(this.targetX - this.x, this.targetY - this.y); if(dist > 50) { const a = Math.atan2(this.targetY-this.y, this.targetX-this.x); this.x += Math.cos(a)*this.speed*0.5; this.y += Math.sin(a)*this.speed*0.5; } else { this.x += (Math.random()-0.5)*this.speed*0.1; this.y += (Math.random()-0.5)*this.speed*0.1; } }
        else if(this.AI_behavior === 'patrol') { if (this.x > canvas.width - this.radius || this.x < this.radius) this.velocity.x *= -1; this.x += this.velocity.x; }
        else if(this.AI_behavior === 'stealth') {
            if (this.isApproaching) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed;
                this.y += Math.sin(angle) * this.speed;
                if (Math.hypot(player.x - this.x, player.y - this.y) <= this.approachDistance) {
                    this.isApproaching = false; this.isCloaking = true; this.cloakStartTime = Date.now();
                }
            } else if (this.isCloaking) {
                this.stealthVisibility = 0;
                if (Date.now() - this.cloakStartTime >= this.cloakDuration) { this.isCloaking = false; this.attackAfterCloak = true; this.stealthVisibility = 1; }
            } else if (this.attackAfterCloak) {
                const angle = Math.atan2(player.y - this.y, player.x - this.x);
                this.x += Math.cos(angle) * this.speed;
                this.y += Math.sin(angle) * this.speed;
            }
        }
        else if(this.AI_behavior === 'command' || this.AI_behavior === 'boss') {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(angle) * this.speed * 0.2;
            this.y += Math.sin(angle) * this.speed * 0.2;
        }
        else if(this.AI_behavior === 'support') {
             const cx = player.x + 300 * Math.cos(pulseTime * 0.05); const cy = player.y + 300 * Math.sin(pulseTime * 0.05); const a = Math.atan2(cy - this.y, cx - this.x); this.x += Math.cos(a)*this.speed; this.y += Math.sin(a)*this.speed;
        }

        const deltaX = this.x - prevX;
        const deltaY = this.y - prevY;
        this.movementSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Update stealth visibility
        if (this.type === 'Stealth') {
             if (this.movementSpeed > 300.5) this.stealthVisibility = Math.min(this.stealthVisibility + 0.1, 0.08);
             else this.stealthVisibility = Math.max(this.stealthVisibility - 0.05, 0.1);
        }

        this.draw();
    }
}

// --- PowerUp Class ---
const POWERUP_TYPES = {
    HEALTH: { color: '#00ff00', label: '+HP' },
    SHIELD: { color: '#0088ff', label: '+SHIELD' },
    ATTACK: { color: '#ff0000', label: 'DMG UP' }
};

class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.lifespan = 800; // frames
        this.age = 0;
        
        const rand = Math.random();
        if (rand < 0.5) this.type = 'HEALTH';
        else if (rand < 0.8) this.type = 'SHIELD';
        else this.type = 'ATTACK';
        
        this.color = POWERUP_TYPES[this.type].color;
        this.velocity = {
            x: (Math.random() - 0.5) * 0.5,
            y: (Math.random() - 0.5) * 0.5
        };
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.age++;
        this.draw();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        const pulse = 1 + Math.sin(this.age * 0.1) * 0.2;
        ctx.scale(pulse, pulse);
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.6 * (1 - this.age / this.lifespan);
        ctx.fill();
        
        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 1 * (1 - this.age / this.lifespan);
        ctx.fill();
        
        // Label
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(POWERUP_TYPES[this.type].label, 0, -this.radius - 5);
        
        ctx.restore();
    }
}


// --- Initialization Helpers ---

// Pre-allocate particles
for (let i = 0; i < particleSettings.count; i++) {
    particles.push({ x: 0, y: 0, size: 0, speedX: 0, speedY: 0, opacity: 0 });
}

// Pre-allocate lines
for (let i = 0; i < lineSettings.count; i++) {
    const points = [];
    for (let j = 0; j < lineSettings.numPoints; j++) {
        points.push({ x: 0, y: 0, originalY: 0 });
    }
    lines.push({ points: points, width: 0, speed: 0, offset: 0, opacity: 0, color: "" });
}

function createParticles() {
    particles.length = 0;
    for (let i = 0; i < particleSettings.count; i++) {
        particles.push({
            x: Math.random() * card.width,
            y: Math.random() * card.height,
            size: Math.random() * (particleSettings.maxSize - particleSettings.minSize) + particleSettings.minSize,
            speedX: Math.random() * (particleSettings.maxSpeed * 2) - particleSettings.maxSpeed,
            speedY: Math.random() * (particleSettings.maxSpeed * 2) - particleSettings.maxSpeed,
            opacity: Math.random() * (particleSettings.maxOpacity - particleSettings.minOpacity) + particleSettings.minOpacity
        });
    }
}

function createLines() {
    lines.length = 0;
    for (let i = 0; i < lineSettings.count; i++) {
        const points = [];
        const startY = Math.random() * card.height;
        for (let j = 0; j < lineSettings.numPoints; j++) {
            points.push({
                x: j * (card.width / (lineSettings.numPoints - 1)),
                y: startY + Math.random() * 30 - 15,
                originalY: startY + Math.random() * 30 - 15
            });
        }
        lines.push({
            points: points,
            width: Math.random() * (lineSettings.maxWidth - lineSettings.minWidth) + lineSettings.minWidth,
            speed: Math.random() * (lineSettings.maxSpeed - lineSettings.minSpeed) + lineSettings.minSpeed,
            offset: Math.random() * Math.PI * 2,
            opacity: Math.random() * (lineSettings.maxOpacity - lineSettings.minOpacity) + lineSettings.minOpacity,
            color: `hsl(${activeHue}, 100%, 60%)`
        });
    }
}

// --- Effects Logic ---

function createClickEffect(x, y) {
    const isAttackBoosted = player.powerUpTimers.attack > 0;
    let numClickParticles = 100;

    if (x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height) {
        isCardClicked = true;
        clickTime = 0;
        cardShakeAmount = 5;

        // Visual distinction for attack boost
        const effectColor = isAttackBoosted ? `hsl(0, 100%, 50%)` : `hsl(${activeHue}, 100%, 50%)`;
        const radiusMulti = isAttackBoosted ? 2.0 : 1.0;

        // Ring effect
        clickEffects.push({
            type: "ring",
            x: x,
            y: y,
            radius: 0,
            maxRadius: 800 * radiusMulti,
            opacity: 1,
            color: effectColor
        });

        // Particles
        for (let i = 0; i < numClickParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            clickEffects.push({
                type: "particle",
                x: x,
                y: y,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                size: Math.random() * 10 + 2,
                opacity: 1,
                decay: Math.random() * 0.04 + 0.02,
                color: effectColor
            });
        }
        
        // Play click sound
        if(sounds.portal) sounds.portal();
    }
}

function updateCardPosition() {
    card.x = canvas.width / 2 - card.width / 2;
    card.y = canvas.height / 2 - card.height / 2;
}

// --- Input Handling ---

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    isHovering = true;
});

canvas.addEventListener("mouseleave", () => { isHovering = false; });

canvas.addEventListener("click", (e) => {
    if (gameState.isPaused || gameState.gameOver) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Check for PowerUp Clicks first
    for(let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        const dist = Math.hypot(clickX - p.x, clickY - p.y);
        if(dist < p.radius + 30) { // generous click radius
            activatePowerUp(p.type);
            powerUps.splice(i, 1);
            if(sounds.crystal) sounds.crystal();
            return; // Don't fire weapon if clicking a powerup
        }
    }

    createClickEffect(clickX, clickY);

    // Check for enemy damage (Hit Scan / AoE from Ring)
    const damage = player.baseDamage * player.damageMult;
    const attackRadius = 800 * player.radiusMult;
    
    // We actually apply damage when the ring expands in update loop? 
    // Simplified: Apply instant damage for better game feel on click, 
    // visual effect catches up.
    
    // Using ring effect logic for area damage
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        // Only damage if inside the max radius of the attack
        const dist = Math.hypot(clickX - enemy.x, clickY - enemy.y);
        if (dist < attackRadius) {
            enemy.currentHP -= damage;
            // Visual hit indicator could go here
            if (enemy.currentHP <= 0) {
                // Drop powerup chance
                if(Math.random() < 0.15) { // 15% chance
                    powerUps.push(new PowerUp(enemy.x, enemy.y));
                }
                
                gameState.score += enemy.scoreVal;
                enemies.splice(i, 1);
                gameState.enemiesKilled++;
                
                document.getElementById('score').innerHTML = formatNumber(gameState.score);
            }
        }
    }
});

function activatePowerUp(type) {
    if(type === 'HEALTH') {
        player.hp = Math.min(player.hp + 3000, player.maxHp);
        showNotification("HP REPAIRED!", 2000);
    } else if(type === 'SHIELD') {
        player.shield = Math.min(player.shield + 2500, player.maxShield);
        showNotification("SHIELDS RECHARGED!", 2000);
    } else if(type === 'ATTACK') {
        player.damageMult = 2.5;
        player.radiusMult = 1.5;
        player.powerUpTimers.attack = 600; // 10 seconds approx @ 60fps
        showNotification("WEAPON OVERCHARGE!", 2000);
    }
}

// --- Drawing Utils ---

function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

function drawCardContent() {
    let cardOffsetX = 0;
    let cardOffsetY = 0;

    if (isCardClicked) {
        clickTime += 0.1;
        cardShakeAmount *= 0.9;
        if (clickTime > 2 || cardShakeAmount < 0.1) {
            isCardClicked = false;
            cardShakeAmount = 0;
        }
        cardOffsetX = Math.sin(clickTime * 10) * cardShakeAmount;
        cardOffsetY = Math.cos(clickTime * 8) * cardShakeAmount;
    }

    const shiftedX = card.x + cardOffsetX;
    const shiftedY = card.y + cardOffsetY;

    ctx.save();
    roundedRect(shiftedX, shiftedY, card.width, card.height, card.cornerRadius);
    ctx.clip();

    // Background Gradient
    const gradient = ctx.createLinearGradient(shiftedX, shiftedY, shiftedX + card.width, shiftedY + card.height);
    gradient.addColorStop(0, "#1a1a1a");
    gradient.addColorStop(1, "#0c0c0c");
    ctx.fillStyle = gradient;
    ctx.fillRect(shiftedX, shiftedY, card.width, card.height);

    // Draw lines
    for (const line of lines) {
        ctx.beginPath();
        ctx.moveTo(shiftedX + line.points[0].x, shiftedY + line.points[0].y);
        for (let i = 0; i < lineSettings.numPoints; i++) {
            const point = line.points[i];
            point.y = point.originalY + Math.sin(pulseTime * line.speed + line.offset + i * 0.5) * lineSettings.waveHeight;
            if (i > 0) ctx.lineTo(shiftedX + point.x, shiftedY + point.y);
        }
        ctx.strokeStyle = line.color.replace("rgb", "rgba").replace(")", `, ${line.opacity})`);
        ctx.lineWidth = line.width;
        ctx.stroke();
    }

    // Draw particles inside card
    for (const particle of particles) {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        if (particle.x < 0) particle.x = card.width;
        if (particle.x > card.width) particle.x = 0;
        if (particle.y < 0) particle.y = card.height;
        if (particle.y > card.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(shiftedX + particle.x, shiftedY + particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
        ctx.fill();
    }

    ctx.restore();

    // Card Border
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    // Shield Visual
    if(player.shield > 0) {
        ctx.strokeStyle = `rgba(0, 136, 255, ${0.3 + (Math.sin(pulseTime)*0.2)})`;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#0088ff';
    }
    roundedRect(shiftedX, shiftedY, card.width, card.height, card.cornerRadius);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center UI
    const centerX = shiftedX + card.width / 2;
    const centerY = shiftedY + card.height / 2;

    // Rotating Base Graphic
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(pulseTime * 0.4);
    
    // Change core color if Attack boost is active
    const coreColor = player.powerUpTimers.attack > 0 ? `hsl(0, 100%, 60%)` : `hsl(${activeHue}, 100%, 60%)`;

    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const radius = 70;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fillStyle = player.powerUpTimers.attack > 0 ? `rgba(255, 0, 0, 0.2)` : `rgba(0, 255, 136, 0.2)`;
    ctx.fill();
    ctx.restore();

    // Stats Text
    ctx.fillStyle = "#fff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`WAVE ${gameState.level}`, centerX, centerY - 25);
    
    // HP
    let hpColor = player.hp < player.maxHp * 0.3 ? '#ff3333' : '#fff';
    ctx.fillStyle = hpColor;
    ctx.font = "18px Arial";
    ctx.fillText(`${formatNumber(player.hp)} HP`, centerX, centerY + 20);
    
    // Shield
    if(player.shield > 0) {
        ctx.fillStyle = "#0088ff";
        ctx.font = "16px Arial";
        ctx.fillText(`${formatNumber(player.shield)} SHIELD`, centerX, centerY + 40);
    }
    
    // Attack Timer
    if(player.powerUpTimers.attack > 0) {
        ctx.fillStyle = "#ff0000";
        ctx.font = "bold 14px Arial";
        ctx.fillText(`DMG BOOST: ${(player.powerUpTimers.attack / 60).toFixed(1)}s`, centerX, centerY + 60);
    }

    // Tutorial Text
    if (Date.now() - descriptionStartTime < descriptionDisplayDuration) {
        ctx.fillStyle = `rgba(204, 204, 204, 1)`;
        ctx.font = "16px Arial";
        ctx.fillText("Move cursor to DEFEND", centerX, centerY + 100);
        ctx.fillText("Click to ATTACK", centerX, centerY + 125);
    }
}

function drawClickEffects() {
    for (let i = clickEffects.length - 1; i >= 0; i--) {
        const effect = clickEffects[i];
        if (effect.type === "ring") {
            effect.radius += 15; // Faster expansion
            effect.opacity -= 0.05;
            if (effect.opacity <= 0) {
                clickEffects.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
            ctx.strokeStyle = effect.color.replace("hsl", "hsla").replace(")", `, ${effect.opacity})`);
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (effect.type === "particle") {
            effect.x += effect.speedX;
            effect.y += effect.speedY;
            effect.opacity -= effect.decay;
            if (effect.opacity <= 0) {
                clickEffects.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
            ctx.fillStyle = effect.color.replace("hsl", "hsla").replace(")", `, ${effect.opacity})`);
            ctx.fill();
        }
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.floor(num);
}

// --- Logic Manager ---

function startNextLevel() {
    gameState.level++;
    gameState.enemiesToSpawn = 10 + Math.floor(gameState.level * 1.5);
    gameState.enemiesSpawned = 0;
    gameState.enemiesKilled = 0;
    gameState.waveActive = true;
    gameState.levelTransition = false;
    
    // Scale enemy stats in data? 
    // We handle scaling in Enemy constructor using level param
    
    showNotification(`WAVE ${gameState.level} INCOMING`, 3000);
}

function getEnemyTypeForLevel(level) {
    const availableTypes = Object.keys(enemyData).filter(type => enemyData[type].minLevel <= level);
    
    // Weighted random? Or just random from available?
    // Let's bias towards higher level enemies as level increases
    if (availableTypes.length === 0) return 'Scout';
    
    // 70% chance for a "common" enemy (lower tier), 30% for "elite" (newest tier)
    if(Math.random() > 0.3 && availableTypes.length > 2) {
        // Return a random type excluding the newest 2
        return availableTypes[Math.floor(Math.random() * (availableTypes.length - 2))];
    } else {
        // Return one of the top 2 tiers available
        return availableTypes[availableTypes.length - 1 - Math.floor(Math.random() * Math.min(2, availableTypes.length))];
    }
}

function spawnLogic(dt) {
    gameState.spawnTimer += dt;
    
    if (gameState.waveActive && 
        gameState.enemiesSpawned < gameState.enemiesToSpawn && 
        gameState.spawnTimer > gameState.spawnDelay) {
            
        gameState.spawnTimer = 0;
        
        // Dynamic spawn rate: Faster as level increases
        gameState.spawnDelay = Math.max(200, 1000 - (gameState.level * 8));

        const type = getEnemyTypeForLevel(gameState.level);
        const config = enemyData[type];
        
        // Spawn from edges
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -50 : canvas.width + 50;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? -50 : canvas.height + 50;
        }
        
        const enemy = new Enemy(x, y, type, gameState.level);
        
        // Specific AI Targets
        if (enemy.AI_behavior === 'defensive') {
            enemy.targetX = canvas.width / 2 + (Math.random() - 0.5) * 400;
            enemy.targetY = canvas.height / 2 + (Math.random() - 0.5) * 400;
        } else if (enemy.AI_behavior === 'patrol') {
            enemy.velocity.x = enemy.speed * (Math.random() < 0.5 ? 1 : -1);
        } else if (['aggressive', 'command', 'boss'].includes(enemy.AI_behavior)) {
            // calculated in update
        }
        
        enemies.push(enemy);
        gameState.enemiesSpawned++;
    }
    
    // Check Wave Clear
    if (gameState.waveActive && 
        gameState.enemiesSpawned === gameState.enemiesToSpawn && 
        enemies.length === 0) {
        
        gameState.waveActive = false;
        gameState.levelTransition = true;
        showNotification("WAVE CLEARED!", 3000);
        
        setTimeout(() => {
            if(!gameState.gameOver) startNextLevel();
        }, 4000);
    }
}

// --- Notification System ---
const notificationCenter = document.getElementById('notification-center');
const notificationMessage = document.getElementById('notification-message');
let notificationTimeout;

function showNotification(message, duration = 3000) {
    clearTimeout(notificationTimeout);
    notificationMessage.textContent = message;
    notificationCenter.style.display = 'block';
    notificationCenter.classList.add('show');

    notificationTimeout = setTimeout(() => {
        notificationCenter.classList.remove('show');
        setTimeout(() => { notificationCenter.style.display = 'none'; }, 500);
    }, duration);
}

function restartGame() {
    player.hp = player.maxHp;
    player.shield = 0;
    gameState.score = 0;
    gameState.level = 0; // Will become 1 in startNextLevel
    enemies.length = 0;
    powerUps.length = 0;
    gameState.gameOver = false;
    document.getElementById('restart-button').style.display = 'none';
    startNextLevel();
    animate();
}


// --- Main Loop ---

function animate() {
    if (gameState.gameOver) return;

    if (gameState.isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(animate);
        return;
    }

    const now = Date.now();
    const dt = now - lastTime;
    lastTime = now;
    
    // Spawn Logic
    spawnLogic(dt);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updateCardPosition();
    pulseTime += 0.05;

    // Power Up Timers
    if(player.powerUpTimers.attack > 0) {
        player.powerUpTimers.attack--;
        if(player.powerUpTimers.attack <= 0) {
            player.damageMult = 1;
            player.radiusMult = 1;
            showNotification("WEAPONS NORMALIZING", 1000);
        }
    }

    // Dynamic Background effects
    let glowSize = card.glowIntensity;
    let hue = 140;

    if (isHovering) {
        const dx = mouseX - (card.x + card.width/2);
        const dy = mouseY - (card.y + card.height/2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        glowSize = card.glowIntensity + Math.max(0, card.glowMax - distance / 10);
        hue = (((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 360) % 360;
        lines.forEach((line) => { line.color = `hsl(${hue}, 100%, 60%)`; });
    } else {
        glowSize = card.glowIntensity + Math.sin(pulseTime) * 5;
    }
    activeHue = hue;

    ctx.shadowBlur = glowSize * (isCardClicked ? 1.5 : 1);
    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;

    drawCardContent(); // Draws background, base, etc
    
    drawClickEffects();
    
    // Update and Draw PowerUps
    for(let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.update();
        if(p.age > p.lifespan) powerUps.splice(i, 1);
    }

    // Update and Draw Enemies
    enemies.forEach((enemy, index) => {
        enemy.update();

        // Check Collision with Base
        // Simple circle collision
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        
        // 200 is approx base radius visual
        if (dist < 100 + enemy.radius) {
            let dmg = enemy.currentHP; // Kamikaze damage
            
            // Shield absorbs first
            if(player.shield > 0) {
                if(player.shield >= dmg) {
                    player.shield -= dmg;
                    dmg = 0;
                } else {
                    dmg -= player.shield;
                    player.shield = 0;
                }
            }
            
            player.hp -= dmg;
            enemies.splice(index, 1);
            gameState.enemiesKilled++;
            
            if (player.hp <= 0) {
                gameState.gameOver = true;
                drawGameOver();
            } else {
                cardShakeAmount = 20;
                isCardClicked = true; // trigger visual shake
            }
        }
    });
    
    if(!gameState.gameOver) requestAnimationFrame(animate);
}

function drawGameOver() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff3333";
    ctx.font = "bold 60px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BASE DESTROYED", canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText(`Waves Survived: ${gameState.level}`, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillText(`Score: ${formatNumber(gameState.score)}`, canvas.width / 2, canvas.height / 2 + 50);
    
    document.getElementById('restart-button').style.display = 'block';
}

// Controls
window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') {
        gameState.isPaused = !gameState.isPaused;
        if (!gameState.isPaused) animate();
        else document.getElementById('wrapper').classList.add('show-menu');
    }
    if (e.key === 'm' || e.key === 'M') {
        document.getElementById('wrapper').classList.toggle('show-menu');
    }
});

// Start Game
createParticles();
createLines();
// Initial setup handled by animate loop variables
gameState.enemiesToSpawn = 10;
gameState.waveActive = true;
animate();

// --- Sound Stubs (Same as before) ---
const sounds = {
    portal: () => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.frequency.value = 400 + Math.random()*200;
        osc.type = "triangle";
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 0.05;
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    },
    crystal: () => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.frequency.value = 1200;
        osc.type = "sine";
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = 0.1;
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }

};
