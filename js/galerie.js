// ==========================================
// CONFIGURATION API PEXELS
// ==========================================
const PEXELS_API_KEY = 'NEA8RWlMrAeAacEpeVVDiFqQexlyUHEbMRYOpoCQARPaznEvuzwcu8rs';

const CONFIG = {
    imageCount: 60,       // REDUIT : 1000 -> 60 pour la fluidité absolue
    gridRowHeight: 450,
    pixelSize: 4,         // Taille des "gros pixels" par défaut
    hoverPixelSize: 1,    // Devient net au survol
    scrollDamping: 0.08,  // Fluidité du scroll
};

const SEARCH_QUERIES = ['abstract', 'sculpture', 'cyberpunk', 'renaissance', 'statue'];

// Variables globales
let imageCollection = [];
let nodes = [];
let winW = window.innerWidth;
let winH = window.innerHeight;
let numColumns = 3;
let totalHeight = 0;

// État du scroll et souris
const scrollState = { current: 0, target: 0, lastTouchY: 0 };
const mouse = { x: 0, y: 0 };

// --- GESTION API (inchangé mais limité en nombre) ---
async function fetchImagesFromPexels() {
    if (!PEXELS_API_KEY) {
        console.error("Clé API manquante");
        return [];
    }

    const collectedImages = [];
    try {
        // On prend 2 thèmes au hasard pour varier
        const selectedQueries = SEARCH_QUERIES.sort(() => 0.5 - Math.random()).slice(0, 2);

        const promises = selectedQueries.map(query =>
            fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=40`, {
                headers: { Authorization: PEXELS_API_KEY }
            })
                .then(res => res.json())
                .then(data => data.photos ? data.photos.map(p => p.src.medium) : []) // src.medium suffit largement pour du pixel art
        );

        const results = await Promise.all(promises);
        results.forEach(arr => collectedImages.push(...arr));

        // On coupe strictement au nombre configuré
        return collectedImages.slice(0, CONFIG.imageCount);

    } catch (error) {
        console.error(error);
        return [];
    }
}

// --- CLASSE CANVAS OPTIMISÉE (SANS REFLET) ---
class PixelCanvas {
    constructor(url, index) {
        this.index = index;
        this.url = url;

        this.x = 0;
        this.y = 0;
        this.width = 300;
        this.height = 400; // Format portrait standard

        // Création du Canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimisation : pas de transparence
        this.canvas.className = 'gallery-canvas';
        this.canvas.style.position = 'absolute';

        document.getElementById('scene').appendChild(this.canvas);

        // Chargement Image
        this.img = new Image();
        this.img.crossOrigin = "Anonymous";
        this.img.onload = () => {
            this.isLoaded = true;
            this.resize();
            this.draw(CONFIG.pixelSize); // Premier dessin
        };
        this.img.src = url;

        this.isHovered = false;
        this.currentPixelSize = CONFIG.pixelSize;

        // Événements souris
        this.canvas.addEventListener('mouseenter', () => this.isHovered = true);
        this.canvas.addEventListener('mouseleave', () => this.isHovered = false);

        this.calcGridPosition();
    }

    calcGridPosition() {
        // Calcul simple de grille
        const col = this.index % numColumns;
        const row = Math.floor(this.index / numColumns);

        const colWidth = winW / numColumns;

        // Centrage dans la colonne
        this.width = Math.min(300, colWidth * 0.8);
        this.height = this.width * 1.4;

        this.x = (col * colWidth) + (colWidth - this.width) / 2;
        this.baseY = row * CONFIG.gridRowHeight + 100;

        this.resize();
    }

    resize() {
        // On ajuste la taille du canvas
        this.canvas.width = this.width;
        this.canvas.height = this.height; // Pas de x2 pour le reflet ici !

        // Désactive le lissage pour l'effet pixel art "Sharp"
        this.ctx.imageSmoothingEnabled = false;
    }

    update(scrollY) {
        if (!this.isLoaded) return;

        // 1. Calcul de la position verticale (Scroll infini)
        let relativeY = this.baseY - scrollY;
        let loopY = ((relativeY % totalHeight) + totalHeight) % totalHeight;
        if (loopY > totalHeight - this.height - 100) loopY -= totalHeight;

        // 2. Frustum Culling (Si hors écran, on ne dessine pas)
        if (loopY < -this.height || loopY > winH) {
            this.canvas.style.transform = `translate3d(-9999px, 0, 0)`; // On cache loin
            return;
        }

        // 3. Animation de la pixellisation
        let targetPixel = this.isHovered ? CONFIG.hoverPixelSize : CONFIG.pixelSize;
        // Transition douce de la pixellisation
        this.currentPixelSize += (targetPixel - this.currentPixelSize) * 0.1;

        // 4. Déplacement du Canvas (GPU)
        // On utilise translate3d pour forcer l'accélération matérielle
        this.canvas.style.transform = `translate3d(${this.x}px, ${loopY}px, 0)`;

        // 5. Redessiner seulement si la taille de pixel change (Optimisation majeure)
        if (Math.abs(this.currentPixelSize - targetPixel) > 0.1 || this.isHovered) {
            this.draw(Math.max(1, Math.floor(this.currentPixelSize)));
        }
    }

    draw(pxSize) {
        // Technique "Downscale / Upscale" pour effet pixel rapide
        // C'est beaucoup plus rapide que de dessiner des rectangles un par un

        const w = this.width;
        const h = this.height;

        // 1. On efface
        this.ctx.clearRect(0, 0, w, h);

        // 2. Astuce : on dessine l'image en tout petit...
        const tinyW = Math.ceil(w / pxSize);
        const tinyH = Math.ceil(h / pxSize);

        // On dessine l'image réduite (mémoire tampon interne du navigateur)
        this.ctx.drawImage(this.img, 0, 0, tinyW, tinyH);

        // 3. ...puis on l'étire en grand. Comme imageSmoothingEnabled = false, ça fait des pixels nets.
        this.ctx.drawImage(this.canvas, 0, 0, tinyW, tinyH, 0, 0, w, h);

        // PAS DE DESSIN DE REFLET ICI
    }
}

// --- INITIALISATION ---

function updateMetrics() {
    winW = window.innerWidth;
    winH = window.innerHeight;
    numColumns = winW < 800 ? 1 : (winW < 1400 ? 2 : 3);
    totalHeight = Math.ceil(CONFIG.imageCount / numColumns) * CONFIG.gridRowHeight;

    // Recalculer positions
    nodes.forEach(node => node.calcGridPosition());
}

async function init() {
    const line = document.getElementById('loader-line');
    if(line) line.style.width = "50%";

    const images = await fetchImagesFromPexels();

    updateMetrics();

    // Création des objets
    nodes = images.map((url, i) => new PixelCanvas(url, i));

    if(line) line.style.width = "100%";

    // Intro
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if(loader) gsap.to(loader, { opacity: 0, onComplete: () => loader.remove() });
        document.getElementById('api-status-text').innerText = `${nodes.length} œuvres (Mode Performance)`;
    }, 500);

    animate();
}

// --- BOUCLE PRINCIPALE ---
function animate() {
    requestAnimationFrame(animate);

    // Physique du Scroll
    scrollState.current += (scrollState.target - scrollState.current) * CONFIG.scrollDamping;

    // Gestion boucle infinie des valeurs
    if (Math.abs(scrollState.current) > totalHeight * 10) {
        scrollState.current %= totalHeight;
        scrollState.target %= totalHeight;
    }

    // Mise à jour de chaque toile
    nodes.forEach(node => node.update(scrollState.current));
}

// Events
window.addEventListener('wheel', e => scrollState.target += e.deltaY, { passive: true });
window.addEventListener('resize', updateMetrics);

// Lancement
init();