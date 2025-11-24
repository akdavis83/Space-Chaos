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

// Game State Management
const gameState = {
	currentLevel: 1,
	maxLevel: 100,
	experience: 0,
	experienceToNextLevel: 100,
	powerUps: [],
	activePowerUps: [],
	waveNumber: 1,
	enemiesInWave: 0,
	waveActive: false,
	scoreMultiplier: 1,
	attackPower: 1,
	attackRange: 1,
	criticalChance: 0.05,
	gold: 0,
	difficulty: 1
};

// Level progression data
const levelData = {};
for (let i = 1; i <= 100; i++) {
	const tier = Math.floor(i / 10) + 1;
	const enemyTypes = [];
	
	if (tier >= 1) enemyTypes.push('Scout', 'Interceptor');
	if (tier >= 2) enemyTypes.push('Bomber', 'Destroyer');
	if (tier >= 3) enemyTypes.push('Cruiser', 'Dreadnought');
	if (tier >= 4) enemyTypes.push('Stealth');
	if (tier >= 5) enemyTypes.push('Flagship', 'Carrier');
	if (tier >= 6) enemyTypes.push('Mothership');
	
	levelData[i] = {
		enemies: enemyTypes,
		enemyCount: Math.min(5 + i * 2, 50),
		speedMultiplier: 1 + (i * 0.05),
		hpMultiplier: 1 + (i * 0.15)
	};
}

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
	level: 1,
	hp: 10000,
	maxHp: 10000,
	x: 0,
	y: 0
};

// Card description timer
let descriptionStartTime = Date.now();
const descriptionDisplayDuration = 3000;

const particleSettings = {
	count: 1000,
	minSize: 1,
	maxSize: 4,
	minSpeed: 0.25,
	maxSpeed: 0.5,
	minOpacity: 0.1,
	maxOpacity: 0.6
};

const lineSettings = {
	count: 0,
	minWidth: 0.5,
	maxWidth: 2,
	minSpeed: 0.01,
	maxSpeed: 0.03,
	minOpacity: 0.05,
	maxOpacity: 0.2,
	waveHeight: 10,
	numPoints: 5
};

const particles = [];
const lines = [];
const clickEffects = [];
const enemies = [];

let isCardClicked = false;
let clickTime = 0;
let cardShakeAmount = 0;
let activeHue = 140;
let mouseX = 0;
let mouseY = 0;
let isHovering = false;
let pulseTime = 0;
let score = 0;
let isPaused = false;
let gameOver = false;

// Enemy Data
const enemyData = {
	Scout: { LV: 1, HP: 1000, speed: 1, AI_behavior: 'random', color: 'cyan', radius: 15 },
	Interceptor: { LV: 2, HP: 2000, speed: 3, AI_behavior: 'aggressive', color: 'lime', radius: 20 },
	Bomber: { LV: 3, HP: 3000, speed: 1.5, AI_behavior: 'evasive', color: 'orange', radius: 25 },
	Destroyer: { LV: 4, HP: 4000, speed: 1.2, AI_behavior: 'defensive', color: 'red', radius: 30 },
	Cruiser: { LV: 5, HP: 5000, speed: 1, AI_behavior: 'patrol', color: 'purple', radius: 35 },
	Dreadnought: { LV: 6, HP: 6000, speed: 0.08, AI_behavior: 'stationary', color: 'magenta', radius: 40 },
	Stealth: { LV: 7, HP: 70, speed: 100, AI_behavior: 'stealth', color: 'gray', radius: 18 },
	Flagship: { LV: 8, HP: 8000, speed: 0.07, AI_behavior: 'command', color: 'gold', radius: 45 },
	Carrier: { LV: 9, HP: 9000, speed: 0.06, AI_behavior: 'support', color: 'brown', radius: 50 },
	Mothership: { LV: 10, HP: 10000, speed: 0.05, AI_behavior: 'boss', color: 'white', radius: 60 }
};

// PowerUp Types
const powerUpTypes = {
	attackBoost: { name: "Attack Boost", duration: 10000, effect: "attackPower", value: 2 },
	rangeBoost: { name: "Range Boost", duration: 15000, effect: "attackRange", value: 1.5 },
	speedBoost: { name: "Speed Boost", duration: 8000, effect: "playerSpeed", value: 2 },
	shield: { name: "Shield", duration: 20000, effect: "damageReduction", value: 0.5 },
	criticalBoost: { name: "Critical Strike", duration: 12000, effect: "criticalChance", value: 0.3 },
	goldMultiplier: { name: "Gold Rush", duration: 25000, effect: "goldMultiplier", value: 3 },
	scoreMultiplier: { name: "Score Multiplier", duration: 30000, effect: "scoreMultiplier", value: 2 },
	healthRegen: { name: "Health Regeneration", duration: 15000, effect: "healthRegen", value: 100 }
};

// Shop Items
const shopItems = {
	attackUpgrade: { name: "Attack Power", cost: 100, effect: "attackPower", value: 0.5 },
	rangeUpgrade: { name: "Attack Range", cost: 150, effect: "attackRange", value: 0.2 },
	healthUpgrade: { name: "Max Health", cost: 200, effect: "maxHp", value: 2000 },
	criticalUpgrade: { name: "Critical Chance", cost: 300, effect: "criticalChance", value: 0.05 },
	speedUpgrade: { name: "Player Speed", cost: 250, effect: "playerSpeed", value: 0.5 },
	goldMultiplierUpgrade: { name: "Gold Multiplier", cost: 500, effect: "goldMultiplier", value: 0.2 }
};

// Enemy Class
class Enemy {
	constructor(x, y, type) {
		this.x = x;
		this.y = y;
		this.type = type;
		this.LV = enemyData[type].LV;
		this.HP = enemyData[type].HP;
		this.currentHP = this.HP;
		this.radius = enemyData[type].radius;
		this.color = enemyData[type].color;
		this.speed = enemyData[type].speed;
		this.AI_behavior = enemyData[type].AI_behavior;
		this.velocity = { x: 0, y: 0 };
		this.targetX = canvas.width / 2;
		this.targetY = canvas.height / 2;
		
		// Stealth-specific properties
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
		if (this.type === 'Stealth' && this.stealthVisibility <= 0) {
			return;
		}
		
		ctx.save();
		ctx.translate(this.x, this.y);
		
		// Add rotation for movement direction
		const angle = Math.atan2(this.velocity.y, this.velocity.x);
		ctx.rotate(angle);
		
		// Add subtle animation rotation
		ctx.rotate(pulseTime * 0.01);

		// Draw enhanced 2D ship based on 3D models
		this.drawEnhancedShip();
		
		ctx.restore();

		// Draw HP bar
		ctx.save();
		if (this.type === 'Stealth') {
			ctx.globalAlpha = this.stealthVisibility;
		}
		const hpBarWidth = this.radius * 2;
		const hpBarHeight = 5;
		const hpBarX = this.x - this.radius;
		const hpBarY = this.y - this.radius - 15;
		ctx.fillStyle = 'red';
		ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
		ctx.fillStyle = 'green';
		ctx.fillRect(hpBarX, hpBarY, (this.currentHP / this.HP) * hpBarWidth, hpBarHeight);
		ctx.restore();
	}
	
	drawEnhancedShip() {
		const r = this.radius;
		
		switch (this.type) {
			case 'Scout':
				this.drawScoutEnhanced(r);
				break;
			case 'Interceptor':
				this.drawInterceptorEnhanced(r);
				break;
			case 'Bomber':
				this.drawBomberEnhanced(r);
				break;
			case 'Destroyer':
				this.drawDestroyerEnhanced(r);
				break;
			case 'Cruiser':
				this.drawCruiserEnhanced(r);
				break;
			case 'Dreadnought':
				this.drawDreadnoughtEnhanced(r);
				break;
			case 'Stealth':
				this.drawStealthEnhanced(r);
				break;
			case 'Flagship':
				this.drawFlagshipEnhanced(r);
				break;
			case 'Carrier':
				this.drawCarrierEnhanced(r);
				break;
			case 'Mothership':
				this.drawMothershipEnhanced(r);
				break;
			default:
				this.drawDefaultShip(r);
				break;
		}
	}
	
	// Original ship drawing methods
	drawScoutEnhanced(r) {
		// Main body (metallic sphere effect)
		const gradient = ctx.createRadialGradient(-r*0.2, -r*0.2, 0, 0, 0, r*0.8);
		gradient.addColorStop(0, '#cccccc');
		gradient.addColorStop(0.7, '#888888');
		gradient.addColorStop(1, '#444444');
		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.arc(0, 0, r*0.8, 0, Math.PI * 2);
		ctx.fill();
		
		// Cockpit (glowing blue)
		ctx.fillStyle = '#00aaff';
		ctx.shadowColor = '#00aaff';
		ctx.shadowBlur = 10;
		ctx.beginPath();
		ctx.arc(0, -r*0.4, r*0.3, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
		
		// Wings with metallic effect
		ctx.fillStyle = '#666666';
		ctx.fillRect(-r*1.2, -r*0.2, r*0.4, r*0.8);
		ctx.fillRect(r*0.8, -r*0.2, r*0.4, r*0.8);
		
		// Wing highlights
		ctx.fillStyle = '#999999';
		ctx.fillRect(-r*1.15, -r*0.15, r*0.3, r*0.1);
		ctx.fillRect(r*0.85, -r*0.15, r*0.3, r*0.1);
	}
	
	drawInterceptorEnhanced(r) {
		// Main body (elongated with gradient)
		const bodyGradient = ctx.createLinearGradient(0, -r*1.2, 0, r*1.2);
		bodyGradient.addColorStop(0, '#00ff00');
		bodyGradient.addColorStop(0.5, '#00cc00');
		bodyGradient.addColorStop(1, '#008800');
		ctx.fillStyle = bodyGradient;
		ctx.beginPath();
		ctx.ellipse(0, 0, r*0.5, r*1.2, 0, 0, Math.PI * 2);
		ctx.fill();
		
		// Angular wings
		ctx.fillStyle = '#00aa00';
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(-r*1.5, -r*0.8);
		ctx.lineTo(-r*1.2, -r*0.6);
		ctx.lineTo(0, -r*0.5);
		ctx.fill();
		
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(r*1.5, -r*0.8);
		ctx.lineTo(r*1.2, -r*0.6);
		ctx.lineTo(0, -r*0.5);
		ctx.fill();
		
		// Engine glow
		ctx.fillStyle = '#00ffff';
		ctx.shadowColor = '#00ffff';
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.arc(0, r*0.8, r*0.2, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
	}
	
	drawBomberEnhanced(r) {
		// Main body (boxy with orange gradient)
		const bodyGradient = ctx.createLinearGradient(-r, 0, r, 0);
		bodyGradient.addColorStop(0, '#ffaa00');
		bodyGradient.addColorStop(0.5, '#ff8800');
		bodyGradient.addColorStop(1, '#cc6600');
		ctx.fillStyle = bodyGradient;
		ctx.fillRect(-r, -r*0.7, r*2, r*1.4);
		
		// Body highlights
		ctx.fillStyle = '#ffcc44';
		ctx.fillRect(-r*0.9, -r*0.6, r*1.8, r*0.2);
		
		// Bombs (dark metallic)
		ctx.fillStyle = '#333333';
		ctx.shadowColor = '#666666';
		ctx.shadowBlur = 5;
		ctx.beginPath();
		ctx.arc(-r*0.5, r*0.8, r*0.3, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(r*0.5, r*0.8, r*0.3, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
		
		// Bomb highlights
		ctx.fillStyle = '#555555';
		ctx.beginPath();
		ctx.arc(-r*0.5, r*0.7, r*0.1, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(r*0.5, r*0.7, r*0.1, 0, Math.PI * 2);
		ctx.fill();
	}
	
	drawStealthEnhanced(r) {
		// Calculate visibility based on movement (0 = nearly invisible, 1 = fully visible)
		const baseOpacity = 0.1;
		const visibility = Math.max(baseOpacity, this.stealthVisibility);
		
		// Angular stealth body with dynamic opacity
		ctx.fillStyle = `rgba(34, 34, 34, ${visibility * 0.8})`;
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (i * Math.PI * 2) / 6;
			const x = Math.cos(angle) * r;
			const y = Math.sin(angle) * r;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();
		
		// Stealth coating effect with dynamic visibility
		const stealthGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
		stealthGradient.addColorStop(0, `rgba(68, 68, 68, ${visibility * 0.6})`);
		stealthGradient.addColorStop(0.7, `rgba(34, 34, 34, ${visibility * 0.4})`);
		stealthGradient.addColorStop(1, `rgba(17, 17, 17, ${visibility * 0.7})`);
		ctx.fillStyle = stealthGradient;
		ctx.beginPath();
		for (let i = 0; i < 6; i++) {
			const angle = (i * Math.PI * 2) / 6;
			const x = Math.cos(angle) * r * 0.8;
			const y = Math.sin(angle) * r * 0.8;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();
		
		// Movement distortion effect - only visible when moving
		if (this.movementSpeed > 0.3) {
			// Create shimmer/distortion effect
			const distortionIntensity = Math.min(this.movementSpeed / 2, 1);
			
			// Distortion outline
			ctx.strokeStyle = `rgba(100, 150, 255, ${distortionIntensity * 0.4})`;
			ctx.lineWidth = 2;
			ctx.setLineDash([5, 5]);
			ctx.lineDashOffset = pulseTime * 2;
			ctx.stroke();
			ctx.setLineDash([]);
		} else {
			// Subtle energy field when stationary
			ctx.strokeStyle = `rgba(100, 100, 255, ${visibility * 0.2})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}
	}
	
	drawDefaultShip(r) {
		ctx.fillStyle = this.color;
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, Math.PI * 2);
		ctx.fill();
		
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 2;
		ctx.stroke();
	}

	update() {
		// Store previous position to calculate movement
		const prevX = this.x;
		const prevY = this.y;
		
		// AI Behavior
		switch (this.AI_behavior) {
			case 'random':
				this.x += (Math.random() - 0.5) * this.speed;
				this.y += (Math.random() - 0.5) * this.speed;
				break;
			case 'aggressive':
				const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
				this.velocity.x = Math.cos(angleToPlayer) * this.speed;
				this.velocity.y = Math.sin(angleToPlayer) * this.speed;
				this.x += this.velocity.x;
				this.y += this.velocity.y;
				break;
			case 'evasive':
				// Move away from player if too close
				const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
				if (distToPlayer < 200) {
					const angleAwayFromPlayer = Math.atan2(this.y - player.y, this.x - player.x);
					this.velocity.x = Math.cos(angleAwayFromPlayer) * this.speed;
					this.velocity.y = Math.sin(angleAwayFromPlayer) * this.speed;
					this.x += this.velocity.x;
					this.y += this.velocity.y;
				} else {
					// Random movement otherwise
					this.x += (Math.random() - 0.5) * this.speed * 0.5;
					this.y += (Math.random() - 0.5) * this.speed * 0.5;
				}
				break;
			case 'defensive':
				// Stay near a fixed point or patrol a small area
				const distToTarget = Math.hypot(this.targetX - this.x, this.targetY - this.y);
				if (distToTarget > 50) {
					const angleToTarget = Math.atan2(this.targetY - this.y, this.targetX - this.x);
					this.velocity.x = Math.cos(angleToTarget) * this.speed * 0.5;
					this.velocity.y = Math.sin(angleToTarget) * this.speed * 0.5;
					this.x += this.velocity.x;
					this.y += this.velocity.y;
				} else {
					// Small random movements around target
					this.x += (Math.random() - 0.5) * this.speed * 0.1;
					this.y += (Math.random() - 0.5) * this.speed * 0.1;
				}
				break;
			case 'patrol':
				// Simple horizontal patrol
				if (this.x > canvas.width - this.radius || this.x < this.radius) {
					this.velocity.x *= -1;
				}
				this.x += this.velocity.x;
				break;
			case 'stationary':
				// No movement
				break;
			case 'stealth':
				if (this.isApproaching) {
					const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
					this.velocity.x = Math.cos(angleToPlayer) * this.speed;
					this.velocity.y = Math.sin(angleToPlayer) * this.speed;
					this.x += this.velocity.x;
					this.y += this.velocity.y;

					const distToBase = Math.hypot(player.x - this.x, player.y - this.y);
					if (distToBase <= this.approachDistance) {
						this.isApproaching = false;
						this.isCloaking = true;
						this.cloakStartTime = Date.now();
						this.velocity.x = 0;
						this.velocity.y = 0;
					}
				} else if (this.isCloaking) {
					this.stealthVisibility = 0;
					if (Date.now() - this.cloakStartTime >= this.cloakDuration) {
						this.isCloaking = false;
						this.attackAfterCloak = true;
						this.stealthVisibility = 1;
					}
				} else if (this.attackAfterCloak) {
					const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
					this.velocity.x = Math.cos(angleToPlayer) * this.speed;
					this.velocity.y = Math.sin(angleToPlayer) * this.speed;
					this.x += this.velocity.x;
					this.y += this.velocity.y;
				}
				break;
			case 'command':
				// Slow, deliberate movement towards player
				const angleToPlayerCommand = Math.atan2(player.y - this.y, player.x - this.x);
				this.velocity.x = Math.cos(angleToPlayerCommand) * this.speed * 0.5;
				this.velocity.y = Math.sin(angleToPlayerCommand) * this.speed * 0.5;
				this.x += this.velocity.x;
				this.y += this.velocity.y;
				break;
			case 'support':
				// Circular movement around a point (e.g., player)
				const centerX = player.x + 100 * Math.cos(pulseTime * 0.05);
				const centerY = player.y + 100 * Math.sin(pulseTime * 0.05);
				const angleToCenter = Math.atan2(centerY - this.y, centerX - this.x);
				this.velocity.x = Math.cos(angleToCenter) * this.speed;
				this.velocity.y = Math.sin(angleToCenter) * this.speed;
				this.x += this.velocity.x;
				this.y += this.velocity.y;
				break;
			case 'boss':
				// Complex, slow, imposing movement (e.g., oscillate and move towards player)
				this.x += Math.sin(pulseTime * 0.02) * this.speed * 0.5;
				this.y += Math.cos(pulseTime * 0.03) * this.speed * 0.5;
				const angleToPlayerBoss = Math.atan2(player.y - this.y, player.x - this.x);
				this.velocity.x = Math.cos(angleToPlayerBoss) * this.speed * 0.1;
				this.velocity.y = Math.sin(angleToPlayerBoss) * this.speed * 0.1;
				this.x += this.velocity.x;
				this.y += this.velocity.y;
				break;
		}
		
		// Calculate movement speed for stealth effect
		const deltaX = this.x - prevX;
		const deltaY = this.y - prevY;
		this.movementSpeed = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		
		// Update stealth visibility based on movement
		if (this.type === 'Stealth') {
			// Movement threshold - ships become visible when moving faster than this
			const movementThreshold = 2;
			const maxVisibility = 0.3; // Maximum visibility when moving fast
			
			if (this.movementSpeed > movementThreshold) {
				// Moving fast - increase visibility
				const speedRatio = Math.min(this.movementSpeed / (movementThreshold * 3), 1);
				this.stealthVisibility = Math.min(this.stealthVisibility + 0.1, maxVisibility * speedRatio);
			} else {
				// Moving slowly or stationary - decrease visibility
				this.stealthVisibility = Math.max(this.stealthVisibility - 0.05, 0.1);
			}
		}

		this.draw();
	}
}

// Pre-allocate arrays
for (let i = 0; i < particleSettings.count; i++) {
	particles.push({
		x: 0,
		y: 0,
		size: 0,
		speedX: 0,
		speedY: 0,
		opacity: 0
	});
}

for (let i = 0; i < lineSettings.count; i++) {
	const points = [];
	for (let j = 0; j < lineSettings.numPoints; j++) {
		points.push({ x: 0, y: 0, originalY: 0 });
	}
	lines.push({
		points: points,
		width: 0,
		speed: 0,
		offset: 0,
		opacity: 0,
		color: ""
	});
}

const clickEffectPool = [];
const MAX_CLICK_EFFECTS = 500000;
for (let i = 0; i < MAX_CLICK_EFFECTS; i++) {
	clickEffectPool.push({
		type: "",
		x: 0,
		y: 0,
		radius: 0,
		maxRadius: 0,
		opacity: 0,
		color: "",
		speedX: 0,
		speedY: 0,
		size: 0,
		decay: 0,
		angle: 0,
		length: 0,
		maxLength: 0,
		width: 0
	});
}

function getClickEffect() {
	if (clickEffectPool.length > 0) {
		return clickEffectPool.pop();
	} else {
		return {
			type: "",
			x: 0,
			y: 0,
			radius: 0,
			maxRadius: 0,
			opacity: 0,
			color: "",
			speedX: 0,
			speedY: 0,
			size: 0,
			decay: 0,
			angle: 0,
			length: 0,
			maxLength: 0,
			width: 0
		};
	}
}

function returnClickEffect(effect) {
	if (clickEffects.length < MAX_CLICK_EFFECTS) {
		clickEffectPool.push(effect);
	}
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
			const point = {
				x: j * (card.width / (lineSettings.numPoints - 1)),
				y: startY + Math.random() * 30 - 15,
				originalY: startY + Math.random() * 30 - 15
			};
			points.push(point);
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

function createClickEffect(x, y) {
	let numClickParticles = Math.min(2000, 200 * gameState.attackPower);
	let ringRadius = 800 * gameState.attackRange;
	let damage = particleSettings.count * gameState.attackPower;
	
	if (Math.random() < gameState.criticalChance) {
		damage *= 2;
		ringRadius *= 1.5;
		showNotification("CRITICAL HIT!", 1000);
	}
	
	if (x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height) {
		isCardClicked = true;
		clickTime = 0;
		cardShakeAmount = 5;

		// Ring effect
		let ringEffect = getClickEffect();
		ringEffect.type = "ring";
		ringEffect.x = x;
		ringEffect.y = y;
		ringEffect.radius = ringRadius;
		ringEffect.maxRadius = ringRadius;
		ringEffect.opacity = 1;
		ringEffect.color = `hsl(${activeHue}, 100%, 50%)`;
		clickEffects.push(ringEffect);

		// Particles
		for (let i = 0; i < numClickParticles; i++) {
			let particleEffect = getClickEffect();
			const angle = Math.random() * Math.PI * 2;
			const speed = Math.random() * 4 + 2;
			particleEffect.type = "particle";
			particleEffect.x = x;
			particleEffect.y = y;
			particleEffect.speedX = Math.cos(angle) * speed;
			particleEffect.speedY = Math.sin(angle) * speed;
			particleEffect.size = Math.random() * 300 + 20;
			particleEffect.opacity = 1;
			particleEffect.decay = Math.random() * 0.04 + 0.02;
			particleEffect.color = `hsl(${activeHue + Math.random() * 30 - 15}, 100%, 60%)`;
			clickEffects.push(particleEffect);
		}

		// Burst lines
		for (let i = 0; i < 8; i++) {
			let burstLineEffect = getClickEffect();
			burstLineEffect.type = "burstLine";
			burstLineEffect.x = x;
			burstLineEffect.y = y;
			burstLineEffect.angle = (i / 8) * Math.PI * 2;
			burstLineEffect.length = 0;
			burstLineEffect.maxLength = Math.random() * 500 + 300;
			burstLineEffect.width = Math.random() * 2 + 1;
			burstLineEffect.opacity = 1;
			burstLineEffect.speed = Math.random() * 5 + 3;
			burstLineEffect.decay = Math.random() * 0.05 + 0.02;
			burstLineEffect.color = `hsl(${activeHue + Math.random() * 30 - 15}, 100%, 60%)`;
			clickEffects.push(burstLineEffect);
		}

		lines.forEach((line) => {
			line.color = `hsl(${activeHue}, 100%, 60%)`;
		});
	}
}

function updateCardPosition() {
	card.x = canvas.width / 2 - card.width / 2;
	card.y = canvas.height / 2 - card.height / 2;
	player.x = canvas.width / 2;
	player.y = canvas.height / 2;
}

canvas.addEventListener("mousemove", (e) => {
	const rect = canvas.getBoundingClientRect();
	mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
	mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
	isHovering = true;
});

canvas.addEventListener("mouseleave", () => {
	isHovering = false;
});

canvas.addEventListener("click", (e) => {
	const rect = canvas.getBoundingClientRect();
	const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
	const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
	createClickEffect(clickX, clickY);

	// Check for enemy clicks
	let enemyClicked = false;
	const damage = particleSettings.count;
	const ringEffect = clickEffects.find(effect => effect.type === 'ring');

	if (ringEffect) {
		for (let i = enemies.length - 1; i >= 0; i--) {
			const enemy = enemies[i];
			const dist = Math.hypot(ringEffect.x - enemy.x, ringEffect.y - enemy.y);

			if (dist < ringEffect.radius) {
				enemy.currentHP -= damage;
				if (enemy.currentHP <= 0) {
					enemies.splice(i, 1);
					score += enemy.LV * 100; // Score based on enemy LV
					gameState.gold += enemy.LV * 10;
					gameState.experience += enemy.LV * 10;
					document.getElementById('score').innerHTML = score;
				}
				enemyClicked = true;
			}
		}
	}

	if (isCardClicked) {
		const soundKeys = Object.keys(sounds);
		const randomSound = soundKeys[Math.floor(Math.random() * soundKeys.length)];
		sounds[randomSound]();
	}
});

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

function drawBackgroundEffects() {
	ctx.save();
	roundedRect(card.x, card.y, card.width, card.height, card.cornerRadius);
	ctx.clip();

	// Draw gradient background
	const gradient = ctx.createLinearGradient(
		card.x,
		card.y,
		card.x + card.width,
		card.y + card.height
	);
	gradient.addColorStop(0, "#1a1a1a");
	gradient.addColorStop(1, "#0c0c0c");
	ctx.fillStyle = gradient;
	ctx.fillRect(card.x, card.y, card.width, card.height);

	// Draw flowing lines
	for (const line of lines) {
		ctx.beginPath();
		ctx.moveTo(card.x + line.points[0].x, card.y + line.points[0].y);
		for (let i = 0; i < lineSettings.numPoints; i++) {
			const point = line.points[i];
			point.y =
				point.originalY +
				Math.sin(pulseTime * line.speed + line.offset + i * 0.5) *
					lineSettings.waveHeight;
			if (i > 0) {
				ctx.lineTo(card.x + point.x, card.y + point.y);
			}
		}
		ctx.strokeStyle = line.color
			.replace("rgb", "rgba")
			.replace(")", `, ${line.opacity})`);
		ctx.lineWidth = line.width;
		ctx.stroke();
	}

	// Draw particles
	for (const particle of particles) {
		particle.x += particle.speedX;
		particle.y += particle.speedY;
		if (particle.x < 0) particle.x = card.width;
		if (particle.x > card.width) particle.x = 0;
		if (particle.y < 0) particle.y = card.height;
		if (particle.y > card.height) particle.y = 0;

		ctx.beginPath();
		ctx.arc(
			card.x + particle.x,
			card.y + particle.y,
			particle.size,
			0,
			Math.PI * 2
		);
		ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
		ctx.fill();
	}

	// Subtle noise texture
	for (let i = 0; i < 100; i++) {
		const x = card.x + Math.random() * card.width;
		const y = card.y + Math.random() * card.height;
		const size = Math.random() * 0.8;
		const opacity = Math.random() * 0.04;
		ctx.beginPath();
		ctx.arc(x, y, size, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
		ctx.fill();
	}

	ctx.restore();
}

function drawClickEffects() {
	for (let i = clickEffects.length - 1; i >= 0; i--) {
		const effect = clickEffects[i];

		if (effect.type === "ring") {
			effect.radius += 2;
			effect.opacity -= 0.02;
			if (effect.radius >= effect.maxRadius || effect.opacity <= 0) {
				returnClickEffect(effect);
				clickEffects.splice(i, 1);
				continue;
			}
			ctx.beginPath();
			ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
			ctx.strokeStyle = effect.color
				.replace("rgb", "rgba")
				.replace(")", `, ${effect.opacity})`);
			ctx.lineWidth = 2;
			ctx.stroke();
		} else if (effect.type === "particle") {
			effect.x += effect.speedX;
			effect.speedX *= 0.95;
			effect.y += effect.speedY;
			effect.speedY *= 0.95;
			effect.opacity -= effect.decay;
			if (effect.opacity <= 0) {
				returnClickEffect(effect);
				clickEffects.splice(i, 1);
				continue;
			}
			ctx.beginPath();
			ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
			ctx.fillStyle = effect.color
				.replace(")", `, ${effect.opacity})`)
				.replace("rgb", "rgba");
			ctx.fill();
		} else if (effect.type === "burstLine") {
			if (effect.length < effect.maxLength) {
				effect.length += effect.speed;
			} else {
				effect.opacity -= effect.decay;
			}
			if (effect.opacity <= 0) {
				returnClickEffect(effect);
				clickEffects.splice(i, 1);
				continue;
			}
			const endX = effect.x + Math.cos(effect.angle) * effect.length;
			const endY = effect.y + Math.sin(effect.angle) * effect.length;
			ctx.beginPath();
			ctx.moveTo(effect.x, effect.y);
			ctx.lineTo(endX, endY);
			ctx.strokeStyle = effect.color
				.replace(")", `, ${effect.opacity})`)
				.replace("hsl", "hsla");
			ctx.lineWidth = effect.width;
			ctx.stroke();
		}
	}
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

	// Draw background
	const gradient = ctx.createLinearGradient(
		shiftedX,
		shiftedY,
		shiftedX + card.width,
		shiftedY + card.height
	);
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
			point.y =
				point.originalY +
				Math.sin(pulseTime * line.speed + line.offset + i * 0.5) *
					lineSettings.waveHeight;
			if (i > 0) {
				ctx.lineTo(shiftedX + point.x, shiftedY + point.y);
			}
		}
		ctx.strokeStyle = line.color
			.replace("rgb", "rgba")
			.replace(")", `, ${line.opacity})`);
		ctx.lineWidth = line.width;
		ctx.stroke();
	}

	// Draw particles
	for (const particle of particles) {
		particle.x += particle.speedX;
		particle.y += particle.speedY;
		if (particle.x < 0) particle.x = card.width;
		if (particle.x > card.width) particle.x = 0;
		if (particle.y < 0) particle.y = card.height;
		if (particle.y > card.height) particle.y = 0;

		ctx.beginPath();
		ctx.arc(
			shiftedX + particle.x,
			shiftedY + particle.y,
			particle.size,
			0,
			Math.PI * 2
		);
		ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
		ctx.fill();
	}

	// Noise texture
	for (let i = 0; i < 100; i++) {
		const x = shiftedX + Math.random() * card.width;
		const y = shiftedY + Math.random() * card.height;
		const size = Math.random() * 0.8;
		const opacity = Math.random() * 0.04;
		ctx.beginPath();
		ctx.arc(x, y, size, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
		ctx.fill();
	}

	ctx.restore();

	// Card border
	ctx.strokeStyle = "#333";
	ctx.lineWidth = 2;
	roundedRect(shiftedX, shiftedY, card.width, card.height, card.cornerRadius);
	ctx.stroke();

	// Card title
	ctx.fillStyle = "#fff";
	ctx.font = "bold 24px Arial";
	ctx.textAlign = "center";
	ctx.fillText("SPACE CHAOS", shiftedX + card.width / 2, shiftedY + 50);

	// Card image
	const centerX = shiftedX + card.width / 2;
	const centerY = shiftedY + card.height / 2;
	ctx.save();
	ctx.translate(centerX, centerY);
	ctx.rotate(pulseTime * 0.4);

	ctx.beginPath();
	for (let i = 0; i < 5; i++) {
		const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
		const radius = 70;
		const x = radius * Math.cos(angle);
		const y = radius * Math.sin(angle);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.strokeStyle = `hsl(${activeHue}, 100%, 60%)`;
	ctx.lineWidth = 3;
	ctx.stroke();

	ctx.beginPath();
	ctx.arc(0, 0, 40, 0, Math.PI * 2);
	ctx.fillStyle = `rgba(0, 255, 136, 0.2)`;
	ctx.fill();
	ctx.strokeStyle = `hsl(${activeHue}, 100%, 60%)`;
	ctx.lineWidth = 2;
	ctx.stroke();

	ctx.restore();

	// Display Player Stats
	ctx.fillStyle = "#fff";
	ctx.font = "bold 20px Arial";
	ctx.textAlign = "center";
	ctx.fillText(`LV${player.level}`, centerX, centerY - 10);
	ctx.font = "16px Arial";
	ctx.fillText(`${formatNumber(player.hp)}/${formatNumber(player.maxHp)} HP`, centerX, centerY + 20);

	// Card description - disappears after a few seconds
	const currentTime = Date.now();
	const elapsedTime = currentTime - descriptionStartTime;
	
	if (elapsedTime < descriptionDisplayDuration) {
		// Calculate fade out effect in the last 500ms
		let opacity = 1;
		if (elapsedTime > descriptionDisplayDuration - 1000) {
			const fadeTime = elapsedTime - (descriptionDisplayDuration - 1000);
			opacity = 1 - (fadeTime / 1000);
		}
		
		ctx.fillStyle = `rgba(204, 204, 204, ${opacity})`;
		ctx.font = "16px Arial";
		ctx.textAlign = "center";
		ctx.fillText("Move your cursor to", centerX, centerY + 100);
		ctx.fillText("DEFEND YOUR BASE", centerX, centerY + 125);
		ctx.fillText("Click to activate ATTACKS!", centerX, centerY + 150);
	}

	// Card footer
	ctx.fillStyle = "#888";
	ctx.font = "12px Arial";
	ctx.fillText("DEFEND YOUR BASE!", centerX, shiftedY + card.height - 20);
}

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num;
}

// Notification System
const notificationCenter = document.getElementById('notification-center');
const notificationMessage = document.getElementById('notification-message');
let notificationTimeout;

function showNotification(message, duration = 10000) {
    clearTimeout(notificationTimeout);
    notificationMessage.textContent = message;
    notificationCenter.style.display = 'block';
    notificationCenter.classList.add('show');

    notificationTimeout = setTimeout(() => {
        notificationCenter.classList.remove('show');
        setTimeout(() => {
            notificationCenter.style.display = 'none';
        }, 500);
    }, duration);
}

function restartGame() {
    player.hp = player.maxHp;
    score = 0;
    enemies.length = 0;
    gameOver = false;
    gameState.currentLevel = 1;
    gameState.experience = 0;
    gameState.gold = 0;
    gameState.activePowerUps = [];
    document.getElementById('restart-button').style.display = 'none';
    initGame();
}

let lastHealthNotification = 0;
const healthNotificationCooldown = 5000;

function animate() {
	requestAnimationFrame(animate);
    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
        document.getElementById('restart-button').style.display = 'block';
        return;
    }
    if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.font = "48px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
        
        // Show control instructions
        ctx.font = "24px Arial";
        ctx.fillText("Press P to resume", canvas.width / 2, canvas.height / 2 + 60);
        ctx.fillText("Press M for menu", canvas.width / 2, canvas.height / 2 + 90);
        return;
    }
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	updateCardPosition();
	pulseTime += 0.02;

	const centerX = card.x + card.width / 2;
	const centerY = card.y + card.height / 2;
	let glowSize = card.glowIntensity;
	let hue = 140;

	if (isHovering) {
		const dx = mouseX - centerX;
		const dy = mouseY - centerY;
		const distance = Math.sqrt(dx * dx + dy * dy);
		glowSize = card.glowIntensity + Math.max(0, card.glowMax - distance / 10);
		hue = (((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 360) % 360;
		lines.forEach((line) => {
			line.color = `hsl(${hue}, 100%, 60%)`;
		});
	} else {
		glowSize = card.glowIntensity + Math.sin(pulseTime) * 5;
	}

	activeHue = hue;

	ctx.shadowBlur = glowSize * (isCardClicked ? 1.5 : 1);
	ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;

	drawCardContent();
	ctx.shadowBlur = 0;
	drawClickEffects();
	

    enemies.forEach((enemy, index) => {
        enemy.update();

        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

        if (dist - enemy.radius - 40 < 1) {
            player.hp -= enemy.currentHP;
            enemies.splice(index, 1);
            if (player.hp <= 0) {
                gameOver = true;
                showNotification("BASE DESTROYED! GAME OVER!", 5000);
            } else if (player.hp / player.maxHp < 0.2 && (Date.now() - lastHealthNotification > healthNotificationCooldown)) {
                showNotification("WARNING: BASE HEALTH CRITICAL!", 3000);
                lastHealthNotification = Date.now();
            }
        }
    });
}

// Control Panel Functions
function createControlPanel() {
	const panel = document.createElement("div");
	panel.className = "control-panel";

	// Card Size Controls
	const sizeHeader = document.createElement("h3");
	sizeHeader.className = "control-group";
	sizeHeader.textContent = "Card Size";
	panel.appendChild(sizeHeader);
	panel.appendChild(
		createSliderControl(
			"Width",
			"card-width",
			200,
			1280,
			card.width,
			(value) => {
				card.width = value;
				updateCardPosition();
				createParticles();
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Height",
			"card-height",
			400,
			800,
			card.height,
			(value) => {
				card.height = value;
				updateCardPosition();
				createParticles();
				createLines();
			}
		)
	);

	// Sound Controls
	const soundHeader = document.createElement("h3");
	soundHeader.className = "control-group";
	soundHeader.textContent = "Sound SFX";
	panel.appendChild(soundHeader);
	panel.appendChild(
		createSliderControl(
			"Volume",
			"sound-volume",
			0,
			1,
			card.soundVolume,
			(value) => {
				card.soundVolume = value;
			}
		)
	);

	// Glow Controls
	const glowHeader = document.createElement("h3");
	glowHeader.className = "control-group";
	glowHeader.textContent = "Glow Controls";
	panel.appendChild(glowHeader);
	panel.appendChild(
		createSliderControl(
			"Intensity",
			"glow-intensity",
			0,
			30,
			card.glowIntensity,
			(value) => {
				card.glowIntensity = value;
			}
		)
	);
	panel.appendChild(
		createSliderControl("Max", "glow-max", 10, 50, card.glowMax, (value) => {
			card.glowMax = value;
		})
	);

	// Particle Controls
	const particleHeader = document.createElement("h3");
	particleHeader.className = "control-group";
	particleHeader.textContent = "Particle Controls";
	panel.appendChild(particleHeader);
	panel.appendChild(
		createSliderControl(
			"Count",
			"particle-count",
			0,
			500,
			particleSettings.count,
			(value) => {
				particleSettings.count = value;
				createParticles();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Min Size",
			"particle-min-size",
			0.1,
			5,
			particleSettings.minSize,
			(value) => {
				particleSettings.minSize = value;
				createParticles();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Max Size",
			"particle-max-size",
			0.1,
			5,
			particleSettings.maxSize,
			(value) => {
				particleSettings.maxSize = value;
				createParticles();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Min Speed",
			"particle-min-speed",
			0,
			1,
			particleSettings.minSpeed,
			(value) => {
				particleSettings.minSpeed = value;
				createParticles();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Max Speed",
			"particle-max-speed",
			0,
			1,
			particleSettings.maxSpeed,
			(value) => {
				particleSettings.maxSpeed = value;
				createParticles();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Min Opacity",
			"particle-min-opacity",
			0,
			1,
			particleSettings.minOpacity,
			(value) => {
				particleSettings.minOpacity = value;
				createParticles();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Max Opacity",
			"particle-max-opacity",
			0,
			1,
			particleSettings.maxOpacity,
			(value) => {
				particleSettings.maxOpacity = value;
				createParticles();
			}
		)
	);

	const lineHeader = document.createElement("h3");
	lineHeader.textContent = "Line Controls";
	lineHeader.style.marginTop = "20px";
	panel.appendChild(lineHeader);
	panel.appendChild(
		createSliderControl(
			"Count",
			"line-count",
			0,
			50,
			lineSettings.count,
			(value) => {
				lineSettings.count = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Min Width",
			"line-min-width",
			0.1,
			5,
			lineSettings.minWidth,
			(value) => {
				lineSettings.minWidth = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Max Width",
			"line-max-width",
			0.1,
			3,
			lineSettings.maxWidth,
			(value) => {
				lineSettings.maxWidth = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Min Speed",
			"line-min-speed",
			0,
			0.1,
			lineSettings.minSpeed,
			(value) => {
				lineSettings.minSpeed = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Max Speed",
			"line-max-speed",
			0,
			0.1,
			lineSettings.maxSpeed,
			(value) => {
				lineSettings.maxSpeed = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Min Opacity",
			"line-min-opacity",
			0,
			0.5,
			lineSettings.minOpacity,
			(value) => {
				lineSettings.minOpacity = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Max Opacity",
			"line-max-opacity",
			0,
			0.5,
			lineSettings.maxOpacity,
			(value) => {
				lineSettings.maxOpacity = value;
				createLines();
			}
		)
	);
	panel.appendChild(
		createSliderControl(
			"Wave Height",
			"line-wave-height",
			1,
			30,
			lineSettings.waveHeight,
			(value) => {
				lineSettings.waveHeight = value;
			}
		)
	);

	const randomizeBtn = document.createElement("button");
	randomizeBtn.className = "control-btn";
	randomizeBtn.textContent = "Randomize All";
	randomizeBtn.style.marginTop = "20px";
	randomizeBtn.addEventListener("click", randomizeAllSettings);
	panel.appendChild(randomizeBtn);

	const toggleBtn = document.createElement("button");
	toggleBtn.className = "toggle-controls-btn";
	panel.classList.add("hidden");
	toggleBtn.textContent = "Show Controls";
	
	const wrapper = document.getElementById('wrapper');
	const observer = new MutationObserver(() => {
		if (wrapper.classList.contains('show-menu')) {
			toggleBtn.classList.add('show-toggle');
		} else {
			toggleBtn.classList.remove('show-toggle');
			panel.classList.add("hidden");
			panel.classList.remove("show-controls");
			toggleBtn.textContent = "Show Controls";
		}
	});
	observer.observe(wrapper, { attributes: true, attributeFilter: ['class'] });
	
	toggleBtn.addEventListener("click", () => {
		panel.classList.toggle("hidden");
		panel.classList.toggle("show-controls");
		toggleBtn.textContent = panel.classList.contains("hidden") ? "Show Controls" : "Hide Controls";
	});
	
	document.body.appendChild(toggleBtn);
	document.body.appendChild(panel);
	return panel;
}

function randomizeAllSettings() {
	card.glowIntensity = Math.random() * 30;
	card.glowMax = Math.random() * 40 + 10;
	
	particleSettings.count = Math.floor(Math.random() * 250);
	particleSettings.minSize = Math.random() * 4.9 + 0.1;
	particleSettings.maxSize = Math.random() * 4.9 + 0.1;
	if (particleSettings.maxSize < particleSettings.minSize)
		particleSettings.maxSize = particleSettings.minSize;
	
	lineSettings.count = Math.floor(Math.random() * 25);
	lineSettings.minWidth = Math.random() * 2.9 + 0.1;
	lineSettings.maxWidth = Math.random() * 2.9 + 0.1;
	if (lineSettings.maxWidth < lineSettings.minWidth)
		lineSettings.maxWidth = lineSettings.minWidth;
	lineSettings.waveHeight = Math.random() * 29 + 1;

	createParticles();
	createLines();
}

function createSliderControl(label, id, min, max, value, onChange) {
	const container = document.createElement("div");
	container.className = "slider-control";

	const labelEl = document.createElement("label");
	labelEl.textContent = label + ": ";
	labelEl.htmlFor = id;

	const valueEl = document.createElement("span");
	valueEl.className = "value-display";
	valueEl.textContent = value.toFixed(2);

	const slider = document.createElement("input");
	slider.type = "range";
	slider.id = id;
	slider.min = min;
	slider.max = max;
	slider.step = (max - min) / 100;
	slider.value = value;

	slider.addEventListener("input", () => {
		const val = parseFloat(slider.value);
		valueEl.textContent = val.toFixed(2);
		onChange(val);
	});

	container.appendChild(labelEl);
	container.appendChild(valueEl);
	container.appendChild(slider);
	return container;
}

// Shop Functions
function createShopUI() {
	const shopPanel = document.createElement('div');
	shopPanel.id = 'shop-panel';
	shopPanel.className = 'shop-panel';
	shopPanel.style.display = 'none';
	
	shopPanel.innerHTML = `
		<h2>Space Shop</h2>
		<div class="shop-items">
			${Object.entries(shopItems).map(([key, item]) => `
				<div class="shop-item" data-item="${key}">
					<span class="item-name">${item.name}</span>
					<span class="item-cost">${item.cost} Gold</span>
					<button class="buy-btn">Buy</button>
				</div>
			`).join('')}
		</div>
		<button class="close-shop-btn">Close Shop</button>
	`;
	
	document.body.appendChild(shopPanel);
	
	shopPanel.querySelectorAll('.buy-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const itemKey = e.target.closest('.shop-item').dataset.item;
			buyUpgrade(itemKey);
		});
	});
	
	shopPanel.querySelector('.close-shop-btn').addEventListener('click', () => {
		shopPanel.style.display = 'none';
	});
}

function buyUpgrade(itemKey) {
	const item = shopItems[itemKey];
	
	if (gameState.gold >= item.cost) {
		gameState.gold -= item.cost;
		
		switch (item.effect) {
			case 'attackPower':
				gameState.attackPower += item.value;
				break;
			case 'attackRange':
				gameState.attackRange += item.value;
				break;
			case 'maxHp':
				player.maxHp += item.value;
				player.hp += item.value;
				break;
			case 'criticalChance':
				gameState.criticalChance += item.value;
				break;
			case 'playerSpeed':
				break;
			case 'goldMultiplier':
				gameState.goldMultiplier += item.value;
				break;
		}
		
		shopItems[itemKey].cost = Math.floor(item.cost * 1.5);
		showNotification(`Purchased: ${item.name}!`, 2000);
	} else {
		showNotification("Not enough gold!", 2000);
	}
}

// Sound effects functions
const sounds = {
	portal: () => {
		const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		const osc = audioCtx.createOscillator();
		const lfo = audioCtx.createOscillator();
		const gainNode = audioCtx.createGain();
		const lfoGain = audioCtx.createGain();

		lfo.frequency.value = 10;
		lfoGain.gain.value = 100;
		lfo.connect(lfoGain);
		lfoGain.connect(osc.frequency);

		osc.frequency.value = 400;
		osc.type = "sawtooth";

		osc.connect(gainNode);
		gainNode.connect(audioCtx.destination);

		gainNode.gain.value = 0.1;
		gainNode.gain.exponentialRampToValueAtTime(
			0.0001,
			audioCtx.currentTime + 1.2
		);

		osc.start();
		lfo.start();
		osc.stop(audioCtx.currentTime + 1.2);
		lfo.stop(audioCtx.currentTime + 1.2);
	},

	crystal: () => {
		const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

		// Play a sequence of crystal tones
		const notes = [1200, 1400, 1600, 1800, 2000];
		notes.forEach((freq, i) => {
			setTimeout(() => {
				const osc = audioCtx.createOscillator();
				const gain = audioCtx.createGain();

				osc.connect(gain);
				gain.connect(audioCtx.destination);

				osc.type = "sine";
				osc.frequency.value = freq;

				gain.gain.value = 0.1;
				gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);

				osc.start();
				osc.stop(audioCtx.currentTime + 0.8);
			}, i * 100);
		});
	},

	bubbles: () => {
		const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

		// Create a series of bubbles with varying characteristics
		for (let i = 0; i < 5; i++) {
			setTimeout(() => {
				const osc = audioCtx.createOscillator();
				const gain = audioCtx.createGain();

				osc.connect(gain);
				gain.connect(audioCtx.destination);

				// Each bubble has a different base frequency
				const baseFreq = 300 + Math.random() * 500;
				osc.type = "sine";
				osc.frequency.value = baseFreq;

				// Quick frequency shift - the key characteristic
				osc.frequency.exponentialRampToValueAtTime(
					baseFreq * 2.2,
					audioCtx.currentTime + 0.06
				);

				// Amplitude envelope for bubble-like shape
				gain.gain.value = 0;
				gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
				gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

				osc.start();
				osc.stop(audioCtx.currentTime + 0.12);
			}, i * 80 + Math.random() * 40);
		}
	}
};

// Keyboard controls
window.addEventListener('keydown', (e) => {
	if (e.key === 'p') {
		isPaused = !isPaused;
		if (!isPaused) {
			animate();
		} else {
			const wrapper = document.getElementById('wrapper');
			if (wrapper && !wrapper.classList.contains('show-menu')) {
				wrapper.classList.add('show-menu');
			}
		}
	}
	if (e.key === 'm' || e.key === 'M') {
		const wrapper = document.getElementById('wrapper');
		if (wrapper) wrapper.classList.toggle('show-menu');
	}
	if (e.key === 'u' || e.key === 'U') {
		const shopPanel = document.getElementById('shop-panel');
		if (shopPanel) {
			shopPanel.style.display = shopPanel.style.display === 'none' ? 'block' : 'none';
		}
	}
});

// Initialize everything
function initGame() {
	createShopUI();
	updateCardPosition();
	createParticles();
	createLines();
	createControlPanel();
	
	setTimeout(() => startNextWave(), 3000);
	showNotification("Welcome to Space Chaos! Defend your base!", 5000);
	
	animate();
}

// Start the game
initGame();