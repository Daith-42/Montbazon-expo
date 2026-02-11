 // ==========================================
        // CONFIGURATION API PEXELS
        // ==========================================
        const PEXELS_API_KEY = 'NEA8RWlMrAeAacEpeVVDiFqQexlyUHEbMRYOpoCQARPaznEvuzwcu8rs';
        // ==========================================

        const CONFIG = {
            imageCount: 1000,
            gridRowHeight: 450,
            basePixelSize: 1, 
            hoverPixelSize: 12, 
            mouseEase: 0.03,
            floatSpeed: 0.0005, 
            scrollDamping: 0.06,
        };

        const SEARCH_QUERIES = [
            'classic art', 'renaissance painting', 'abstract art', 
            'sculpture', 'oil painting texture', 'surrealism', 
            'gothic architecture', 'japanese art', 'modern art museum', 
            'impressionism', 'baroque', 'statue'
        ];

        let imageCollection = [];
        let winW = window.innerWidth;
        let winH = window.innerHeight;
        let numColumns = 1;
        let totalHeight = 0;

        // --- GESTION API ---
        async function fetchImagesFromPexels() {
            if (!PEXELS_API_KEY) {
                showError("Clé API manquante. Veuillez ajouter votre clé Pexels dans le code.");
                return [];
            }

            const statusEl = document.getElementById('loader-status');
            const collectedImages = [];
            
            try {
                statusEl.innerText = "Acquisition des œuvres...";
                
                const promises = SEARCH_QUERIES.map(query => 
                    fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=80&orientation=portrait`, {
                        headers: { Authorization: PEXELS_API_KEY }
                    })
                    .then(res => {
                        if (!res.ok) throw new Error("Erreur API");
                        return res.json();
                    })
                    .then(data => {
                        if (!data.photos) return [];
                        return data.photos.map(p => p.src.medium); 
                    })
                    .catch(e => [])
                );

                const results = await Promise.all(promises);
                results.forEach(arr => collectedImages.push(...arr));
                
                if (collectedImages.length === 0) throw new Error("Aucune image trouvée.");

                for (let i = collectedImages.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [collectedImages[i], collectedImages[j]] = [collectedImages[j], collectedImages[i]];
                }

                return collectedImages;

            } catch (error) {
                showError(error.message);
                return [];
            }
        }

        function showError(msg) {
            const errorEl = document.getElementById('api-error');
            document.getElementById('loader-status').style.display = 'none';
            document.getElementById('loader-line').style.display = 'none';
            errorEl.style.display = 'block';
            errorEl.innerText = msg;
        }

        // --- MOTEUR GRAPHIQUE ---
        const scrollState = {
            current: 0,
            target: 0,
            lastTouchY: 0
        };

        const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

        class FloatingMasterpiece {
            constructor(url, index) {
                this.url = url;
                this.index = index;
                this.loaded = false;

                this.x = 0;
                this.baseY = 0;
                // Profondeur de base pour le parallaxe
                this.depth = 0.5 + Math.random() * 0.5; 
                this.floatOffset = Math.random() * 3000;
                
                this.currentPixelSize = CONFIG.basePixelSize;
                this.targetPixelSize = CONFIG.basePixelSize;
                this.isActive = false; 
                
                // --- VARIABLES D'ANIMATION GSAP ---
                // Ces valeurs sont utilisées pour "perturber" la position normale
                // GSAP va les ramener à 0
                this.animZ = -3000 - Math.random() * 2000; // Commence très loin au fond
                this.animRotX = (Math.random() - 0.5) * 180; // Rotation aléatoire
                this.animRotY = (Math.random() - 0.5) * 180; // Rotation aléatoire
                this.animOpacity = 0; // Commence invisible

                this.container = document.createElement('div');
                this.container.className = 'image-container';
                this.container.style.display = 'none'; 
                this.container.style.opacity = '0'; 
                
                this.calcGridPosition();

                this.container.addEventListener('mouseenter', () => {
                    this.targetPixelSize = CONFIG.hoverPixelSize;
                });
                this.container.addEventListener('mouseleave', () => {
                    this.targetPixelSize = CONFIG.basePixelSize;
                });

                document.getElementById('scene').appendChild(this.container);

                this.img = new Image();
                this.img.crossOrigin = "Anonymous";
                this.img.src = url;
                this.img.onload = () => {
                    this.loaded = true;
                    this.calcDimensions();
                };
                this.img.onerror = () => {
                    this.container.remove();
                    this.loaded = false;
                };
            }

            calcGridPosition() {
                const col = this.index % numColumns;
                const row = Math.floor(this.index / numColumns);
                const colWidth = winW / numColumns;
                const jitterX = (Math.random() - 0.5) * (colWidth * 0.3); 
                this.x = (col * colWidth) + (colWidth / 2) + jitterX;
                const jitterY = (Math.random() - 0.5) * 50;
                this.baseY = (row * CONFIG.gridRowHeight) + (CONFIG.gridRowHeight / 2) + jitterY;
            }

            calcDimensions() {
                const aspectRatio = this.img.height / this.img.width;
                const maxColWidth = winW / numColumns;
                const targetWidth = Math.min(350, Math.max(150, maxColWidth * 0.7));
                
                this.width = targetWidth;
                this.height = this.width * aspectRatio;
                
                if (this.height > CONFIG.gridRowHeight * 0.9) {
                    this.height = CONFIG.gridRowHeight * 0.9;
                    this.width = this.height / aspectRatio;
                }
                
                this.container.style.width = `${this.width}px`;
                this.container.style.height = `${this.height}px`;
            }

            activate() {
                if (this.isActive || !this.loaded) return;

                this.canvas = document.createElement('canvas');
                this.canvas.width = this.width;
                this.canvas.height = this.height;
                this.ctx = this.canvas.getContext('2d', { alpha: false });

                this.offCanvas = document.createElement('canvas');
                this.offCanvas.width = this.width;
                this.offCanvas.height = this.height;
                this.offCtx = this.offCanvas.getContext('2d');

                this.container.appendChild(this.canvas);
                this.container.style.display = 'flex'; 
                this.container.style.zIndex = Math.floor(this.depth * 100);

                this.ctx.drawImage(this.img, 0, 0, this.width, this.height);
                this.isActive = true;
            }

            deactivate() {
                if (!this.isActive) return;
                this.container.innerHTML = '';
                this.container.style.display = 'none';
                this.canvas = null;
                this.ctx = null;
                this.offCanvas = null;
                this.offCtx = null;
                this.isActive = false;
            }

            update(time, scrollY) {
                if (!this.loaded) return;

                let relativeY = this.baseY - scrollY;
                let loopY = ((relativeY % totalHeight) + totalHeight) % totalHeight;

                if (loopY > totalHeight - this.height - 200) {
                    loopY -= totalHeight;
                }

                const margin = 500; 
                const isVisible = (loopY > -this.height - margin && loopY < winH + margin);

                if (isVisible) {
                    this.activate();
                    this.container.style.opacity = this.animOpacity; // Utilisation de la variable GSAP
                } else {
                    this.deactivate();
                    return;
                }

                // Animation Pixel
                const diff = this.targetPixelSize - this.currentPixelSize;
                if (Math.abs(diff) > 0.1) {
                    this.currentPixelSize += diff * 0.08;
                    this.render();
                } else if (this.currentPixelSize > 1.2) {
                    this.render();
                }

                // Calcul positions standard
                const parallaxX = (mouse.x - (winW / 2)) * this.depth * 0.02; 
                const parallaxY = (mouse.y - (winH / 2)) * this.depth * 0.02;
                
                const floatX = Math.sin(time * CONFIG.floatSpeed + this.floatOffset) * 10 * this.depth;
                const floatY = Math.cos(time * CONFIG.floatSpeed * 1.1 + this.floatOffset) * 10 * this.depth;
                
                const scale = (0.6 + (this.depth * 0.4));

                const finalX = this.x - (this.width / 2) + parallaxX + floatX;
                const finalY = loopY - (this.height / 2) + parallaxY + floatY;

                // --- COMBINAISON FINALE TRANSFORM ---
                // On ajoute translateZ et rotate3d basés sur les variables animées par GSAP
                // Cela crée l'effet de venue de loin
                this.container.style.transform = `
                    translate3d(${finalX}px, ${finalY}px, ${this.animZ}px) 
                    rotateX(${this.animRotX}deg)
                    rotateY(${this.animRotY}deg)
                    scale(${scale})
                `;
            }

            render() {
                if(!this.ctx) return;
                const pixelW = this.width / this.currentPixelSize;
                const pixelH = this.height / this.currentPixelSize;

                if (this.currentPixelSize <= 1.1) {
                     this.ctx.drawImage(this.img, 0, 0, this.width, this.height);
                     return;
                }

                this.offCtx.clearRect(0, 0, this.width, this.height);
                this.offCtx.drawImage(this.img, 0, 0, pixelW, pixelH);

                this.ctx.clearRect(0, 0, this.width, this.height);
                this.ctx.imageSmoothingEnabled = false; 
                this.ctx.drawImage(this.offCanvas, 0, 0, pixelW, pixelH, 0, 0, this.width, this.height);
            }
        }

        const nodes = [];

        function updateGridMetrics() {
            winW = window.innerWidth;
            winH = window.innerHeight;
            if (winW < 600) numColumns = 1;
            else if (winW < 1000) numColumns = 2;
            else if (winW < 1600) numColumns = 3;
            else numColumns = 4;
            const rows = Math.ceil(CONFIG.imageCount / numColumns);
            totalHeight = rows * CONFIG.gridRowHeight;
            nodes.forEach(node => {
                node.calcGridPosition();
                if(node.loaded) node.calcDimensions();
            });
        }

        async function initScene() {
            const line = document.getElementById('loader-line');
            line.style.width = "20%";

            let images = await fetchImagesFromPexels();
            if (images.length === 0) return;

            imageCollection = images;
            document.getElementById('api-status-text').innerText = `Connecté: ${images.length} œuvres`;
            document.getElementById('api-status-text').style.color = "#4ade80";

            line.style.width = "70%";
            document.getElementById('loader-status').innerText = "Alignement des dimensions...";

            updateGridMetrics();

            for(let i = 0; i < CONFIG.imageCount; i++) {
                const url = imageCollection[i % imageCollection.length];
                nodes.push(new FloatingMasterpiece(url, i));
            }

            line.style.width = "100%";

            setTimeout(() => {
                const loader = document.getElementById('loader');
                
                gsap.to(loader, {
                    opacity: 0,
                    duration: 0.8,
                    onComplete: () => loader.remove()
                });

                gsap.to(["#ui-layer", ".scroll-indicator", ".api-status"], {
                    opacity: 1,
                    duration: 1.5,
                    delay: 0.5,
                    ease: "power2.out"
                });

                // --- ANIMATION DE L'ESPACE (THE BIG REVEAL) ---
                // On anime les propriétés virtuelles de chaque noeud
                // De valeurs chaotiques (Z loin, rotations) à 0 (position grille parfaite)
                
                gsap.to(nodes, {
                    animZ: 0, // Ramène les images du fond de l'éther vers Z=0
                    animRotX: 0, // Redresse les images
                    animRotY: 0,
                    animOpacity: 1, // Rend visible
                    duration: 2.5, // Animation longue et majestueuse
                    stagger: {
                        amount: 2, // Étale l'arrivée des images sur 2 secondes
                        from: "random" // Ordre aléatoire pour un effet nuée/étoiles
                    },
                    ease: "power3.out", // Décélération douce à la fin
                    delay: 0.2
                });

            }, 1000);
            
            animate();
        }

        window.addEventListener('wheel', (e) => {
            scrollState.target += e.deltaY;
        });

        window.addEventListener('touchstart', (e) => {
            scrollState.lastTouchY = e.touches[0].clientY;
        });

        window.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const delta = scrollState.lastTouchY - touchY;
            scrollState.target += delta * 2.5; 
            scrollState.lastTouchY = touchY;
            e.preventDefault(); 
        }, { passive: false });


        let time = 0;
        function animate() {
            requestAnimationFrame(animate);
            time += 1;

            mouse.x += (mouse.targetX - mouse.x) * CONFIG.mouseEase;
            mouse.y += (mouse.targetY - mouse.y) * CONFIG.mouseEase;
            
            scrollState.current += (scrollState.target - scrollState.current) * CONFIG.scrollDamping;

            if (scrollState.current > totalHeight) {
                scrollState.current -= totalHeight;
                scrollState.target -= totalHeight;
            } else if (scrollState.current < 0) {
                scrollState.current += totalHeight;
                scrollState.target += totalHeight;
            }

            for (let i = 0; i < nodes.length; i++) {
                nodes[i].update(time, scrollState.current);
            }
        }

        window.addEventListener('mousemove', (e) => {
            mouse.targetX = e.clientX;
            mouse.targetY = e.clientY;
        });

        window.addEventListener('resize', () => {
            updateGridMetrics();
        });

        initScene();