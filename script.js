document.addEventListener("DOMContentLoaded", function () {
	// Elements
	const carousel = document.getElementById("memory-carousel");
	const cards = document.querySelectorAll(".memory-card");
	const prevBtn = document.getElementById("prev-btn");
	const nextBtn = document.getElementById("next-btn");
    const bgMusic = document.getElementById("bg-music");
    const leftSound = document.getElementById("left-sound");
    const rightSound = document.getElementById("right-sound");

	// Variables
	let currentIndex = 0;
	let startX, startY;
	let isDragging = false;
	let theta = 0;
	let radius = window.innerWidth <= 768 ? 250 : 400;
	const totalCards = cards.length;

	// Initialize
	function init() {
		// Position cards in a circle
		arrangeCards();

		// Add event listeners
		prevBtn.addEventListener("click", prevCard);
		nextBtn.addEventListener("click", nextCard);
		cards.forEach((card) => {
			card.addEventListener("click", flipCard);
		});

		// Touch/mouse events for dragging
		carousel.addEventListener("mousedown", dragStart);
		carousel.addEventListener("touchstart", dragStart, { passive: true });
		document.addEventListener("mousemove", drag);
		document.addEventListener("touchmove", drag, { passive: false });
		document.addEventListener("mouseup", dragEnd);
		document.addEventListener("touchend", dragEnd);

		// Keyboard navigation
		document.addEventListener("keydown", handleKeyDown);

		// Start ambient sound
		// playAmbientSound();
	}

	// Arrange cards in a circle
	function arrangeCards() {
		const angle = 360 / totalCards;
		cards.forEach((card, index) => {
			// Calculate the angle for this card
			const cardAngle = angle * index;
			// Convert to radians
			const rad = (cardAngle * Math.PI) / 180;
			// Calculate position
			const x = radius * Math.sin(rad);
			const z = radius * Math.cos(rad) * -1;

			// Apply transform
			card.style.transform = `rotateY(${cardAngle}deg) translateZ(${radius}px)`;

			// Store the card's index
			card.dataset.index = index;
		});
	}

	// Rotate carousel
	function rotateCarousel() {
		carousel.style.transform = `rotateY(${theta}deg)`;

		// Update current card index
		currentIndex = Math.round(Math.abs(theta / (360 / totalCards)) % totalCards);
		if (currentIndex >= totalCards) currentIndex = 0;
	}

	// Next card
	function nextCard() {
		leftSound.currentTime = 0;
		leftSound.play();
		theta -= 360 / totalCards; // Changed direction to match swipe
		rotateCarousel();
	}

	// Previous card
	function prevCard() {
		rightSound.currentTime = 0;
		rightSound.play();
		theta += 360 / totalCards; // Changed direction to match swipe
		rotateCarousel();
	}

	// Flip card
	function flipCard(e) {
		const card = e.currentTarget;
		const cardIndex = parseInt(card.dataset.index);

		// Only flip the current front-facing card
		if (cardIndex === currentIndex) {
			card.classList.toggle("flipped");
		}
	}

	// Drag functions
	function dragStart(e) {
		e.preventDefault(); // Prevent default behavior
		isDragging = true;
		startX = e.pageX || e.touches[0].pageX;
	}

	function drag(e) {
		if (!isDragging) return;
		e.preventDefault(); // Prevent default scrolling

		const currentX = e.pageX || (e.touches ? e.touches[0].pageX : startX);
		const diffX = currentX - startX;

		// Rotate based on drag distance - FIXED DIRECTION
		const sensitivity = 0.5;
		const newTheta = theta + diffX * sensitivity;

		carousel.style.transform = `rotateY(${newTheta}deg)`;
	}

	function dragEnd(e) {
		if (!isDragging) return;
		isDragging = false;

		const currentX =
			e.pageX || (e.changedTouches ? e.changedTouches[0].pageX : startX);
		const diffX = currentX - startX;

		// FIXED DIRECTION: If swiping right, show previous card (theta increases)
		// If swiping left, show next card (theta decreases)
		if (Math.abs(diffX) > 20) {
			if (diffX > 0) {
				prevCard(); // Swipe right to see previous card
			} else {
				nextCard(); // Swipe left to see next card
			}
		} else {
			// Snap to the closest card
			const anglePerCard = 360 / totalCards;
			const snapAngle = Math.round(theta / anglePerCard) * anglePerCard;
			theta = snapAngle;
			rotateCarousel();
		}
	}

	// Keyboard navigation
	function handleKeyDown(e) {
		if (e.key === "ArrowLeft") {
			nextCard(); // Changed to match swipe direction
		} else if (e.key === "ArrowRight") {
			prevCard(); // Changed to match swipe direction
		} else if (e.key === "Enter" || e.key === " ") {
			const currentCard = document.querySelector(
				`.memory-card[data-index="${currentIndex}"]`
			);
			if (currentCard) {
				currentCard.classList.toggle("flipped");
			}
		} else if (e.key === "s" || e.key === "S") {
            window.location.href = "s.html";
        } else if (e.key === "m" || e.key === "M") {
            window.location.href = "m.html";
        }
	}

	let hasInteracted = false;
	function startMusicOnFirstInteraction() {
		if (!hasInteracted) {
			hasInteracted = true;
			bgMusic.play().catch(e => console.error("BG music failed", e));
			document.removeEventListener("click", startMusicOnFirstInteraction);
			document.removeEventListener("keydown", startMusicOnFirstInteraction);
			document.removeEventListener("touchstart", startMusicOnFirstInteraction);
		}
	}

	document.addEventListener("click", startMusicOnFirstInteraction);
	document.addEventListener("keydown", startMusicOnFirstInteraction);
	document.addEventListener("touchstart", startMusicOnFirstInteraction);

	

	// Resize handler
	window.addEventListener("resize", () => {
		radius = window.innerWidth <= 768 ? 250 : 400;
		arrangeCards();
		rotateCarousel();
	});

	// Initialize the carousel
	init();
});