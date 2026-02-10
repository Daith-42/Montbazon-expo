// --- Éléments DOM ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        const hiddenCanvas = document.getElementById('hiddenCanvas');
        const hiddenCtx = hiddenCanvas.getContext('2d');
        
        const uploadInput = document.getElementById('upload');
        const gridSizeInput = document.getElementById('gridSize');
        const gridSizeDisplay = document.getElementById('gridSizeVal');
        const colorsGrid = document.getElementById('colors-grid');
        const activeColorPreview = document.getElementById('activeColorPreview');
        const notificationToast = document.getElementById('notification-toast');

        // --- État du jeu ---
        let CONFIG = {
            gridResolution: 12,
            pixelSize: 20,
            colorSimplification: 45
        };

        let GAME_STATE = {
            targetColors: [],
            userColors: [],
            activeErrors: [], // Animations d'erreur
            particles: [],    // Particules de victoire (confetti)
            width: 0,
            height: 0,
            currentColor: null,
            pixelsLeft: 0,    // Compteur pour la victoire
            isDrawing: false,
            isAnimating: false,
            isWon: false,
            revealOpacity: 0, // Pour l'animation finale
            currentImage: null // L'image source HD
        };

        function init() {
            resizeCanvas(32, 32);
            // Fond blanc par défaut
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0,0,canvas.width, canvas.height);
        }

        // --- Events ---

        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    GAME_STATE.currentImage = img;
                    startNewGame(img);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        });

        gridSizeInput.addEventListener('input', (e) => {
            CONFIG.gridResolution = parseInt(e.target.value);
            gridSizeDisplay.textContent = CONFIG.gridResolution;
            if(GAME_STATE.currentImage) {
                startNewGame(GAME_STATE.currentImage);
            }
        });

        canvas.addEventListener('mousedown', (e) => {
            if(GAME_STATE.isWon) return;
            GAME_STATE.isDrawing = true;
            paintAtCursor(e);
        });
        window.addEventListener('mouseup', () => GAME_STATE.isDrawing = false);
        canvas.addEventListener('mousemove', (e) => {
            if (GAME_STATE.isDrawing && !GAME_STATE.isWon) paintAtCursor(e);
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            if(!GAME_STATE.width) return;
            if(confirm("Voulez-vous vraiment effacer votre progression ?")) {
                resetUserCanvas();
                draw();
            }
        });

        document.getElementById('downloadBtn').addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = 'mon-oeuvre-restauree.png';
            link.href = canvas.toDataURL();
            link.click();
        });

        // --- Core Logic ---

        function startNewGame(img) {
            colorsGrid.innerHTML = '';
            
            const ratio = img.height / img.width;
            GAME_STATE.width = CONFIG.gridResolution;
            GAME_STATE.height = Math.floor(CONFIG.gridResolution * ratio);

            hiddenCanvas.width = GAME_STATE.width;
            hiddenCanvas.height = GAME_STATE.height;
            
            hiddenCtx.filter = "saturate(150%) contrast(110%)"; 
            hiddenCtx.drawImage(img, 0, 0, GAME_STATE.width, GAME_STATE.height);
            hiddenCtx.filter = "none";

            const imgData = hiddenCtx.getImageData(0, 0, GAME_STATE.width, GAME_STATE.height).data;
            
            GAME_STATE.targetColors = [];
            GAME_STATE.userColors = [];
            GAME_STATE.activeErrors = [];
            GAME_STATE.particles = [];
            GAME_STATE.isWon = false;
            GAME_STATE.revealOpacity = 0;
            GAME_STATE.pixelsLeft = 0;

            for (let y = 0; y < GAME_STATE.height; y++) {
                const rowTarget = [];
                const rowUser = [];
                for (let x = 0; x < GAME_STATE.width; x++) {
                    const i = (y * GAME_STATE.width + x) * 4;
                    
                    let r = imgData[i];
                    let g = imgData[i+1];
                    let b = imgData[i+2];

                    const snap = CONFIG.colorSimplification; 
                    r = Math.round(r / snap) * snap;
                    g = Math.round(g / snap) * snap;
                    b = Math.round(b / snap) * snap;
                    
                    r = Math.min(255, Math.max(0, r));
                    g = Math.min(255, Math.max(0, g));
                    b = Math.min(255, Math.max(0, b));

                    const hex = rgbToHex(r, g, b);
                    rowTarget.push(hex);
                    rowUser.push(null);
                    GAME_STATE.pixelsLeft++;
                }
                GAME_STATE.targetColors.push(rowTarget);
                GAME_STATE.userColors.push(rowUser);
            }

            resizeCanvas(GAME_STATE.width, GAME_STATE.height);
            generatePalette();
            draw();
        }

        function resetUserCanvas() {
            GAME_STATE.isWon = false;
            GAME_STATE.revealOpacity = 0;
            GAME_STATE.pixelsLeft = GAME_STATE.width * GAME_STATE.height;
            GAME_STATE.particles = [];
            for(let y=0; y<GAME_STATE.height; y++) {
                for(let x=0; x<GAME_STATE.width; x++) {
                    GAME_STATE.userColors[y][x] = null;
                }
            }
        }

        function resizeCanvas(gridW, gridH) {
            const maxWidth = Math.min(window.innerWidth * 0.9, 800);
            const maxHeight = window.innerHeight * 0.8;
            const sizeX = Math.floor(maxWidth / gridW);
            const sizeY = Math.floor(maxHeight / gridH);
            CONFIG.pixelSize = Math.max(1, Math.min(sizeX, sizeY));
            canvas.width = gridW * CONFIG.pixelSize;
            canvas.height = gridH * CONFIG.pixelSize;
        }

        function paintAtCursor(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;
            const gridX = Math.floor(mouseX / CONFIG.pixelSize);
            const gridY = Math.floor(mouseY / CONFIG.pixelSize);

            if (gridX >= 0 && gridX < GAME_STATE.width && gridY >= 0 && gridY < GAME_STATE.height) {
                
                const correctColor = GAME_STATE.targetColors[gridY][gridX];

                if(!GAME_STATE.currentColor) {
                    showToast("Veuillez choisir une nuance sur la palette.", "error");
                    return;
                }

                if (GAME_STATE.currentColor !== correctColor) {
                    triggerError(gridX, gridY);
                } else {
                    if (GAME_STATE.userColors[gridY][gridX] !== GAME_STATE.currentColor) {
                        
                        if(GAME_STATE.userColors[gridY][gridX] === null) {
                            GAME_STATE.pixelsLeft--;
                        }

                        GAME_STATE.userColors[gridY][gridX] = GAME_STATE.currentColor;
                        
                        if(GAME_STATE.pixelsLeft <= 0) {
                            triggerWin();
                        } else if(!GAME_STATE.isAnimating) {
                            draw(); 
                        }
                    }
                }
            }
        }

        function triggerWin() {
            GAME_STATE.isWon = true;
            GAME_STATE.revealOpacity = 0; 
            showToast("Chef-d'œuvre restauré avec succès !", "success");
            
            // Créer des confettis dorés et blancs
            for(let i=0; i<150; i++) {
                GAME_STATE.particles.push({
                    x: canvas.width / 2,
                    y: canvas.height / 2,
                    vx: (Math.random() - 0.5) * 15,
                    vy: (Math.random() - 0.5) * 15,
                    // Couleurs plus élégantes (Or, Blanc, Gris)
                    color: Math.random() > 0.5 ? '#c5a059' : (Math.random() > 0.5 ? '#ffffff' : '#cccccc'),
                    size: Math.random() * 6 + 3,
                    life: 1.0
                });
            }

            if (!GAME_STATE.isAnimating) {
                GAME_STATE.isAnimating = true;
                draw();
            }
        }

        // --- Rendering Logic ---

        function draw() {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (GAME_STATE.targetColors.length === 0) return;

            const now = Date.now();
            let needsRedraw = false;

            for (let y = 0; y < GAME_STATE.height; y++) {
                for (let x = 0; x < GAME_STATE.width; x++) {
                    const targetColor = GAME_STATE.targetColors[y][x];
                    const userColor = GAME_STATE.userColors[y][x];
                    
                    const px = x * CONFIG.pixelSize;
                    const py = y * CONFIG.pixelSize;
                    const ps = CONFIG.pixelSize;

                    if (!userColor) {
                        ctx.fillStyle = targetColor;
                        ctx.globalAlpha = 0.1; // Plus subtil
                        ctx.fillRect(px, py, ps, ps);
                        
                        ctx.fillStyle = targetColor;
                        ctx.globalAlpha = 0.3;
                        ctx.beginPath();
                        ctx.arc(px + ps/2, py + ps/2, ps/6, 0, Math.PI*2);
                        ctx.fill();
                    } else {
                        ctx.globalAlpha = 1.0;
                        ctx.fillStyle = userColor;
                        ctx.fillRect(px, py, ps, ps);
                    }

                    if(ps > 4) { 
                        ctx.globalAlpha = GAME_STATE.isWon ? Math.max(0, 0.05 - GAME_STATE.revealOpacity) : 0.05;
                        ctx.strokeStyle = "#000";
                        ctx.lineWidth = 1;
                        ctx.strokeRect(px, py, ps, ps);
                    }
                }
            }

            if (GAME_STATE.isWon && GAME_STATE.currentImage) {
                if (GAME_STATE.revealOpacity < 1) {
                    GAME_STATE.revealOpacity += 0.005; 
                    needsRedraw = true;
                }
                
                ctx.globalAlpha = Math.min(1, GAME_STATE.revealOpacity);
                ctx.drawImage(GAME_STATE.currentImage, 0, 0, canvas.width, canvas.height);
            }

            if (!GAME_STATE.isWon) {
                GAME_STATE.activeErrors = GAME_STATE.activeErrors.filter(err => now - err.startTime < 400);
                if (GAME_STATE.activeErrors.length > 0) {
                    needsRedraw = true;
                    GAME_STATE.activeErrors.forEach(err => {
                        const px = err.x * CONFIG.pixelSize;
                        const py = err.y * CONFIG.pixelSize;
                        const ps = CONFIG.pixelSize;
                        const progress = (now - err.startTime) / 400;
                        
                        // Rouge d'erreur un peu plus élégant
                        ctx.fillStyle = "#d64541";
                        ctx.globalAlpha = 0.8 * (1 - progress);
                        ctx.fillRect(px, py, ps, ps);
                    });
                }
            }

            if (GAME_STATE.isWon) {
                needsRedraw = true;
                GAME_STATE.particles = GAME_STATE.particles.filter(p => p.life > 0.01);
                
                GAME_STATE.particles.forEach(p => {
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.2; 
                    p.life *= 0.96; 

                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, p.size, p.size);
                });
            }

            ctx.globalAlpha = 1.0;

            if (needsRedraw) {
                requestAnimationFrame(draw);
            } else {
                GAME_STATE.isAnimating = false;
            }
        }

        // --- Helpers ---

        function triggerError(x, y) {
            GAME_STATE.activeErrors.push({ x, y, startTime: Date.now() });
            showToast("Teinte incorrecte.", "error");
            if (!GAME_STATE.isAnimating) {
                GAME_STATE.isAnimating = true;
                draw();
            }
        }

        let toastTimeout;
        function showToast(msg, type = "error") {
            notificationToast.textContent = msg;
            notificationToast.className = type; 
            notificationToast.classList.add("show");
            
            clearTimeout(toastTimeout);
            
            const duration = type === "success" ? 4000 : 1500;
            
            toastTimeout = setTimeout(() => {
                notificationToast.classList.remove("show");
            }, duration);
        }

        function generatePalette() {
            colorsGrid.innerHTML = '';
            const colorCounts = {};

            GAME_STATE.targetColors.forEach(row => {
                row.forEach(color => {
                    colorCounts[color] = (colorCounts[color] || 0) + 1;
                });
            });

            const sortedColors = Object.keys(colorCounts).sort((a, b) => colorCounts[b] - colorCounts[a]);

            sortedColors.forEach(color => {
                const div = document.createElement('div');
                div.className = 'color-swatch';
                div.style.backgroundColor = color;
                div.title = `Utilisé ${colorCounts[color]} fois`;
                div.onclick = () => setActiveColor(color, div);
                colorsGrid.appendChild(div);
            });

            if(sortedColors.length > 0) {
                setTimeout(() => setActiveColor(sortedColors[0], colorsGrid.firstChild), 0);
            }
        }

        function setActiveColor(color, element) {
            GAME_STATE.currentColor = color;
            document.querySelectorAll('.color-swatch').forEach(el => el.classList.remove('active'));
            if(element) element.classList.add('active');
            activeColorPreview.style.backgroundColor = color;
            activeColorPreview.style.borderColor = '#e0e0e0';
        }

        function rgbToHex(r, g, b) {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }

        // Start
        init();