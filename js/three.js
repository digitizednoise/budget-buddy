import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pixelationPass } from 'three/addons/tsl/display/PixelationPassNode.js';
import { GEMINI_API_KEY } from './config.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const HARDCODED_GEMINI_API_KEY = GEMINI_API_KEY;
const BUDDY_SYSTEM_PROMPT = 'You are Budget Buddy, a friendly tamagotchi-like finance companion. Keep answers encouraging, practical, and concise. Help users with budgeting, saving, spending tradeoffs, and healthy money habits. Use plain language and suggest one actionable next step when possible.';
const PIXEL_SIZE = 4;
const NORMAL_EDGE_STRENGTH = 0.7;
const DEPTH_EDGE_STRENGTH = 0.4;

function appendChatMessage(chatLog, role, text) {
    const message = document.createElement('article');
    message.className = `chat-message chat-message-${role}`;

    const label = document.createElement('span');
    label.className = 'chat-message-label';
    label.textContent = role === 'user' ? 'You' : 'Buddy';

    const body = document.createElement('p');
    body.textContent = text;

    message.append(label, body);
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function appendChatMessageHTML(chatLog, role, html) {
    const message = document.createElement('article');
    message.className = `chat-message chat-message-${role}`;

    const label = document.createElement('span');
    label.className = 'chat-message-label';
    label.textContent = role === 'user' ? 'You' : 'Buddy';

    const body = document.createElement('p');
    body.innerHTML = html;

    message.append(label, body);
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
}

function showTypingIndicator(chatLog) {
    const indicator = document.createElement('article');
    indicator.className = 'chat-message chat-message-model chat-typing-indicator';

    const label = document.createElement('span');
    label.className = 'chat-message-label';
    label.textContent = 'Buddy';

    const dots = document.createElement('div');
    dots.className = 'chat-typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    indicator.append(label, dots);
    chatLog.appendChild(indicator);
    chatLog.scrollTop = chatLog.scrollHeight;
    return indicator;
}

function typingThenMessage(chatLog, delay, appendFn) {
    return new Promise((resolve) => {
        const indicator = showTypingIndicator(chatLog);
        setTimeout(() => {
            indicator.remove();
            appendFn();
            resolve();
        }, delay);
    });
}

function setupGamesOverlay() {
    const overlay = document.getElementById('games-overlay');
    const closeBtn = document.getElementById('games-close');
    if (!overlay || !closeBtn) return;

    const open = () => {
        overlay.removeAttribute('inert');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('open');
    };
    const close = () => {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        overlay.setAttribute('inert', '');
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    document.addEventListener('open-games-overlay', open);
}

function getGeminiResponseText(data) {
    const parts = data?.candidates?.[0]?.content?.parts ?? [];

    return parts
        .map((part) => part.text || '')
        .join('\n')
        .trim();
}

function trimConversationHistory(history, maxMessages = 16) {
    if (history.length <= maxMessages) {
        return;
    }

    history.splice(0, history.length - maxMessages);
}

class BudgetBuddyScene {
    #ui = null;
    #scene = null;
    #camera = null;
    #renderer = null;
    #renderPipeline = null;
    #controls = null;
    #clock = new THREE.Clock();
    #pet = null;
    #conversationHistory = [];
    #calmColor = new THREE.Color().setStyle('#ECC1A9').convertSRGBToLinear();
    #energizedColor = new THREE.Color().setStyle('#ECC1A9').convertSRGBToLinear();
    #debugUI = null;
    #debugMode = false;
    #cameraTarget = null;
    #controlsTarget = null;
    #lastRendererWidth = 0;
    #lastRendererHeight = 0;
    #resizeFrameId = 0;
    #cameraTransition = null;
    #sceneFocusCameraPosition = new THREE.Vector3(1.78, 0.90, 3.32);
    #sceneFocusCameraTarget = new THREE.Vector3(1.94, 0.44, 0.06);
    #clickMeLabel = null;
    #buddyHovered = false;
    #plate = null;
    #cancelCount = 0;

    async init() {
        if (!WebGPU.isAvailable()) {
            document.body.appendChild(WebGPU.getErrorMessage());
            return;
        }

        this.#setupLayout();
        this.#setupScene();
        await this.#setupRenderer();
        this.#setupPostProcessing();
        this.#setupControls();
        this.#setupDebugTool();
        this.#setupChat();
        this.#setupUiActions();
        this.#setupBuddyHoverRing();
        this.#setupResizeHandling();
        this.#updateRendererSize();
        this.#startRenderLoop();
    }

    #setupLayout() {
        const app = document.querySelector('.home-shell');

        if (!app) {
            throw new Error('Missing required `.home-shell` root in index.html.');
        }

        this.#ui = {
            root: app,
            rendererHost: app.querySelector('.renderer-host'),
            buddyChat: app.querySelector('.buddy-chat'),
            chatInputLane: app.querySelector('.scene-chat-input-lane'),
            ctaButton: app.querySelector('.primary-cta'),
            chatLog: app.querySelector('.chat-log'),
            chatForm: app.querySelector('.chat-form'),
            chatInput: app.querySelector('.chat-input'),
            chatSend: app.querySelector('.chat-send')
        };

        const missingUiNodes = Object.entries(this.#ui)
            .filter(([, element]) => !element)
            .map(([key]) => key);

        if (missingUiNodes.length > 0) {
            throw new Error(`Missing required UI elements in index.html: ${missingUiNodes.join(', ')}`);
        }
    }

    #setupScene() {
        this.#scene = new THREE.Scene();
        this.#scene.background = new THREE.Color(0xF0F8EA);

        this.#camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
        this.#camera.position.set(0, 1.35, 3.9);
        this.#camera.lookAt(0, 0.8, 0);

        const loader = new THREE.TextureLoader();
        const checkerTexture = loader.load('assets/checker.png');
        checkerTexture.wrapS = THREE.RepeatWrapping;
        checkerTexture.wrapT = THREE.RepeatWrapping;
        checkerTexture.repeat.set(9, 9);
        checkerTexture.magFilter = THREE.NearestFilter;

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(18, 18),
            new THREE.MeshStandardMaterial({
                map: checkerTexture,
                color: 0xF0F8EA,
                roughness: 0.9,
                metalness: 0.02
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.08;
        this.#scene.add(floor);

        const ambient = new THREE.AmbientLight(0x8da4ff, 0.95);
        this.#scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.55);
        keyLight.position.set(2.2, 4.1, 2.8);
        this.#scene.add(keyLight);

        const rimLight = new THREE.PointLight(0x84dcff, 1.2, 8);
        rimLight.position.set(-1.9, 2.3, -1.6);
        this.#scene.add(rimLight);

        this.#pet = this.#createPetModel();
        this.#scene.add(this.#pet.group);

        this.#plate = this.#createPlate();
        this.#plate.visible = false;
        this.#scene.add(this.#plate);
    }

    #createPlate() {
        const group = new THREE.Group();
        const mat = this.#pet.accentMaterial;
        const rimMat = new THREE.MeshToonMaterial({ color: 0xFFD700 }); // Golden yellow rim

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.03, 48), mat);
        base.position.y = 0;

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.028, 10, 48), rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.022;

        group.add(base, rim);
        group.position.set(0.25, 0.021, 1.3);
        return group;
    }

    #addFoodToPlate(count) {
        if (!this.#plate) return;

        const toonMat = (hex) => new THREE.MeshToonMaterial({ color: new THREE.Color().setStyle(hex).convertSRGBToLinear() });

        const foods = {
            1: () => {
                // cherry: red sphere + tiny stem
                const g = new THREE.Group();
                const berry = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), toonMat('#e53935'));
                berry.position.y = 0.055;
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), toonMat('#4caf50'));
                stem.position.y = 0.12;
                g.add(berry, stem);
                g.position.set(-0.15, 0.03, 0.05);
                return g;
            },
            2: () => {
                // fried egg: white disc + yellow yolk
                const g = new THREE.Group();
                const white = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.018, 16), toonMat('#fffde7'));
                const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 10), toonMat('#fdd835'));
                yolk.position.y = 0.03;
                g.add(white, yolk);
                g.position.set(0.13, 0.03, -0.1);
                return g;
            },
            3: () => {
                // cupcake: cylinder base + dome top
                const g = new THREE.Group();
                const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 12), toonMat('#d7a26e'));
                const icing = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), toonMat('#f48fb1'));
                icing.position.y = 0.08;
                g.add(cup, icing);
                g.position.set(0.05, 0.03, 0.15);
                return g;
            },
            4: () => {
                // carrot: orange cone + green top
                const g = new THREE.Group();
                const body = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 8), toonMat('#f57c00'));
                body.rotation.z = Math.PI;
                body.position.y = 0.085;
                const top = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), toonMat('#388e3c'));
                top.position.y = 0.185;
                g.add(body, top);
                g.position.set(-0.14, 0.03, -0.15);
                return g;
            },
            5: () => {
                // donut: torus
                const g = new THREE.Group();
                const donut = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.032, 8, 20), toonMat('#a0522d'));
                donut.rotation.x = Math.PI / 2;
                donut.position.y = 0.032;
                const glaze = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 20), toonMat('#f06292'));
                glaze.rotation.x = Math.PI / 2;
                glaze.position.y = 0.046;
                g.add(donut, glaze);
                g.position.set(0.17, 0.03, 0.05);
                return g;
            },
            6: () => {
                // turkey: body + head + legs + tail fan
                const g = new THREE.Group();
                const brownMat = toonMat('#8d5524');
                const darkBrownMat = toonMat('#5d3010');
                const tanMat = toonMat('#d4956a');

                // body
                const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), brownMat);
                body.scale.set(1, 1.15, 0.9);
                body.position.y = 0.18;

                // head
                const head = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 10), tanMat);
                head.position.set(0, 0.37, 0.13);

                // beak
                const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), toonMat('#ffa000'));
                beak.rotation.x = -Math.PI / 2;
                beak.position.set(0, 0.36, 0.22);

                // wattle
                const wattle = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), toonMat('#e53935'));
                wattle.position.set(0, 0.325, 0.205);

                // drumstick helper: cylinder + ball end
                const makeLeg = (xOff) => {
                    const lg = new THREE.Group();
                    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.13, 8), darkBrownMat);
                    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 8), darkBrownMat);
                    bone.position.y = 0.065;
                    knob.position.y = 0;
                    lg.add(bone, knob);
                    lg.position.set(xOff, 0.03, 0.12);
                    lg.rotation.x = 0.35;
                    return lg;
                };
                const leftLeg = makeLeg(-0.1);
                const rightLeg = makeLeg(0.1);

                // tail feathers: 5 flat quads fanned out behind
                const featherMat = toonMat('#bf360c');
                const featherColors = ['#bf360c','#e65100','#f57c00','#ffa000','#ffca28'];
                for (let i = 0; i < 5; i++) {
                    const angle = -0.55 + i * 0.275;
                    const fm = toonMat(featherColors[i]);
                    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.012), fm);
                    feather.position.set(Math.sin(angle) * 0.15, 0.24 + Math.cos(angle) * 0.09, -0.14);
                    feather.rotation.z = -angle;
                    g.add(feather);
                }

                g.add(body, head, beak, wattle, leftLeg, rightLeg);
                g.position.set(0, 0.02, 0);
                g.scale.set(1.15, 1.15, 1.15);
                return g;
            },
        };

        const foodIndex = ((count - 1) % 6) + 1;
        const builder = foods[foodIndex];
        if (!builder) return;

        const food = builder();
        food.userData.isFood = true;

        // drop-in animation: start above and fall to resting position
        const restY = food.position.y;
        food.position.y = restY + 0.6; // Start higher for better visual impact
        this.#plate.add(food);

        const start = performance.now();
        const duration = 600; // Slower, more satisfying drop

        const drop = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            
            // Simple bounce effect
            let bounce;
            if (progress < 0.6) {
                // Initial fall
                bounce = (progress / 0.6) ** 2;
            } else if (progress < 0.8) {
                // First bounce up
                const p = (progress - 0.6) / 0.2;
                bounce = 1 - Math.sin(p * Math.PI) * 0.15;
            } else {
                // Final settle
                const p = (progress - 0.8) / 0.2;
                bounce = 1 - Math.sin(p * Math.PI) * 0.05;
            }

            food.position.y = restY + 0.6 * (1 - bounce);

            if (progress < 1) {
                requestAnimationFrame(drop);
            } else {
                food.position.y = restY;
            }
        };
        requestAnimationFrame(drop);
    }

    #createPetModel() {
        const pet = new THREE.Group();

        const bodyMaterial = new THREE.MeshToonMaterial({ color: new THREE.Color().setStyle('#ECC1A9').convertSRGBToLinear(), roughness: 0.4, metalness: 0.08 });
        const accentMaterial = new THREE.MeshToonMaterial({ color: new THREE.Color().setStyle('#D8F5C8').convertSRGBToLinear(), roughness: 0.55, metalness: 0.02 });
        const eyeMaterial = new THREE.MeshToonMaterial({ color: 0x151515 });

        const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 32), bodyMaterial);
        body.position.y = 0.6;

        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 24), accentMaterial);
        belly.position.set(0, 0.36, 0.38);

        const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 16), bodyMaterial);
        leftEar.position.set(-0.28, 1.16, -0.05);
        leftEar.rotation.z = 0.2;

        const rightEar = leftEar.clone();
        rightEar.position.x = 0.28;
        rightEar.rotation.z = -0.2;

        const eyeGeometry = new THREE.SphereGeometry(0.05, 12, 12);
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.18, 0.72, 0.54);

        const rightEye = leftEye.clone();
        rightEye.position.x = 0.18;

        const smile = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 24, Math.PI), bodyMaterial);
        smile.position.set(0, 0.58, 0.57);
        smile.rotation.z = Math.PI;

        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.25, 4, 12), bodyMaterial);
        tail.position.set(0.47, 0.65, -0.12);
        tail.rotation.z = -1.1;
        tail.rotation.x = 0.7;

        const happyEyeGeo = new THREE.TorusGeometry(0.07, 0.016, 6, 16, Math.PI);
        const leftHappyEye = new THREE.Mesh(happyEyeGeo, eyeMaterial);
        leftHappyEye.position.set(-0.18, 0.73, 0.56);
        leftHappyEye.scale.set(0, 0, 0);

        const rightHappyEye = new THREE.Mesh(happyEyeGeo, eyeMaterial);
        rightHappyEye.position.set(0.18, 0.73, 0.56);
        rightHappyEye.scale.set(0, 0, 0);

        pet.add(body, belly, leftEar, rightEar, leftEye, rightEye, smile, tail, leftHappyEye, rightHappyEye);

        return {
            group: pet,
            bodyMaterial,
            accentMaterial,
            leftEye,
            rightEye,
            leftHappyEye,
            rightHappyEye,
            tail,
            isHappy: false,
        };
    }

    async #setupRenderer() {
        this.#renderer = new THREE.WebGPURenderer({ antialias: true });
        this.#renderer.setPixelRatio(window.devicePixelRatio);
        this.#renderer.setClearColor(0xF0F8EA, 1);
        this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.#renderer.toneMappingExposure = 1.07;
        await this.#renderer.init();

        this.#renderer.domElement.style.backgroundColor = '#F0F8EA';

        this.#ui.rendererHost.appendChild(this.#renderer.domElement);
    }

    #setupPostProcessing() {
        const pixelationUniforms = {
            pixelSize: THREE.TSL.uniform(PIXEL_SIZE),
            normalEdgeStrength: THREE.TSL.uniform(NORMAL_EDGE_STRENGTH),
            depthEdgeStrength: THREE.TSL.uniform(DEPTH_EDGE_STRENGTH)
        };

        this.#renderPipeline = new THREE.RenderPipeline(this.#renderer);
        this.#renderPipeline.outputNode = pixelationPass(
            this.#scene,
            this.#camera,
            pixelationUniforms.pixelSize,
            pixelationUniforms.normalEdgeStrength,
            pixelationUniforms.depthEdgeStrength
        );
    }

    #setupControls() {
        this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement);
        this.#controls.target.set(0, 0.8, 0);
        this.#controls.enableDamping = true;
        this.#controls.enabled = false;
        this.#controls.update();
    }

    #setupChat() {
        const log = this.#ui.chatLog;

        typingThenMessage(log, 900, () =>
            appendChatMessage(log, 'model', 'Hey! I am your Budget Buddy. Ask me anything about saving, spending, or setting up a simple budget.')
        ).then(() =>
            typingThenMessage(log, 1100, () =>
                appendChatMessageHTML(log, 'model', 'Need help feeding me? Play some <button class="games-link" onclick="document.dispatchEvent(new CustomEvent(\'open-games-overlay\'))">games</button> with me to learn about personal finance!')
            )
        ).then(() => {
            if (!HARDCODED_GEMINI_API_KEY || !HARDCODED_GEMINI_API_KEY.trim()) {
                typingThenMessage(log, 800, () =>
                    appendChatMessage(log, 'model', 'Gemini API key not found. Please add your key to `js/config.js` to enable chat.')
                );
            }
        });

        this.#ui.chatForm.addEventListener('submit', (event) => {
            this.#handleChatSubmit(event);
        });
    }

    #setupUiActions() {
        this.#ui.ctaButton.addEventListener('click', () => {
            this.#enterSceneFocus();
        }, { once: true });

        this.#ui.rendererHost.addEventListener('click', () => {
            this.#enterSceneFocus();
        }, { once: true });

        document.addEventListener('subscription-cancelled', () => {
            this.#triggerHappyEyes();
            this.#cancelCount++;
            this.#addFoodToPlate(this.#cancelCount);
        });
    }

    #triggerHappyEyes() {
        this.#pet.isHappy = true;
        this.#pet.leftEye.scale.set(0, 0, 0);
        this.#pet.rightEye.scale.set(0, 0, 0);
        this.#pet.leftHappyEye.scale.set(1, 1, 1);
        this.#pet.rightHappyEye.scale.set(1, 1, 1);

        setTimeout(() => {
            this.#pet.isHappy = false;
            this.#pet.leftEye.scale.set(1, 1, 1);
            this.#pet.rightEye.scale.set(1, 1, 1);
            this.#pet.leftHappyEye.scale.set(0, 0, 0);
            this.#pet.rightHappyEye.scale.set(0, 0, 0);
        }, 2500);
    }

    #updateClickMeLabel() {
        if (!this.#clickMeLabel) return;
        const isExpanded = this.#ui.root.classList.contains('scene-expanded');
        if (isExpanded) {
            this.#clickMeLabel.style.opacity = '0';
            return;
        }

        const rect = this.#renderer.domElement.getBoundingClientRect();
        const buddyPos = new THREE.Vector3();
        this.#pet.group.getWorldPosition(buddyPos);
        buddyPos.project(this.#camera);

        const x = (buddyPos.x * 0.5 + 0.5) * rect.width;
        const y = (-buddyPos.y * 0.5 + 0.5) * rect.height + 35;

        this.#clickMeLabel.style.left = `${x}px`;
        this.#clickMeLabel.style.top = `${y}px`;
        this.#clickMeLabel.style.opacity = '1';
    }

    #setupBuddyHoverRing() {
        const ring = document.createElement('div');
        ring.className = 'buddy-hover-ring';
        this.#ui.rendererHost.appendChild(ring);

        const label = document.createElement('div');
        label.className = 'buddy-click-label';
        label.textContent = 'Click Me!';
        this.#ui.rendererHost.appendChild(label);
        this.#clickMeLabel = label;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const petMeshes = [];
        this.#pet.group.traverse(obj => { if (obj.isMesh) petMeshes.push(obj); });

        const canvas = this.#renderer.domElement;

        canvas.addEventListener('mousemove', (e) => {
            if (this.#ui.root.classList.contains('scene-expanded')) {
                ring.style.opacity = '0';
                return;
            }

            const rect = canvas.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, this.#camera);
            const hits = raycaster.intersectObjects(petMeshes);

            if (hits.length > 0) {
                const buddyPos = new THREE.Vector3();
                this.#pet.group.getWorldPosition(buddyPos);
                buddyPos.y += 0.6;
                buddyPos.project(this.#camera);

                const x = (buddyPos.x * 0.5 + 0.5) * rect.width;
                const y = (-buddyPos.y * 0.5 + 0.5) * rect.height;
                ring.style.left = `${x}px`;
                ring.style.top = `${y}px`;
                ring.style.opacity = '1';
                canvas.style.cursor = 'pointer';
                this.#buddyHovered = true;
            } else {
                ring.style.opacity = '0';
                canvas.style.cursor = 'default';
                this.#buddyHovered = false;
            }
        });

        canvas.addEventListener('mouseleave', () => {
            ring.style.opacity = '0';
            this.#buddyHovered = false;
        });
    }

    #setupResizeHandling() {
        window.addEventListener('resize', () => {
            this.#requestRendererResize();
        }, { passive: true });

        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => {
                this.#requestRendererResize();
            });
            resizeObserver.observe(this.#ui.rendererHost);
        }
    }

    #requestRendererResize() {
        if (this.#resizeFrameId !== 0) {
            return;
        }

        this.#resizeFrameId = window.requestAnimationFrame(() => {
            this.#resizeFrameId = 0;
            this.#updateRendererSize();
        });
    }

    #startRenderLoop() {
        this.#renderer.setAnimationLoop(() => {
            this.#animate();
        });
    }

    #animate() {
        this.#updateCameraTransition(performance.now());

        const elapsed = this.#clock.getElapsedTime();
        const pulse = (Math.sin(elapsed * 0.8) + 1) / 2;

        this.#pet.group.position.y = 0.14 + Math.sin(elapsed * 2.2) * 0.09;
        this.#pet.group.rotation.y = Math.sin(elapsed * 0.9) * 0.23;
        this.#pet.tail.rotation.y = Math.sin(elapsed * 5.2) * 0.85;

        if (!this.#pet.isHappy) {
            const blink = Math.sin(elapsed * 3.2) > 0.96 ? 0.12 : 1;
            this.#pet.leftEye.scale.y = blink;
            this.#pet.rightEye.scale.y = blink;
        }

        this.#pet.bodyMaterial.color.copy(this.#calmColor).lerp(this.#energizedColor, pulse);
        this.#pet.bodyMaterial.emissive.setRGB(0.52 + pulse * 0.04, 0.14 + pulse * 0.02, 0.08);
        this.#pet.accentMaterial.emissive.setRGB(0.32 + pulse * 0.02, 0.55 + pulse * 0.03, 0.28 + pulse * 0.02);

        this.#controls.update();
        this.#updateDebugInfo();
        this.#updateClickMeLabel();
        this.#renderPipeline.render();
    }

    #startSceneFocusCameraTransition() {
        const fromPosition = this.#camera.position.clone();
        const fromTarget = this.#controls.target.clone();
        const toPosition = this.#sceneFocusCameraPosition.clone();
        const toTarget = this.#sceneFocusCameraTarget.clone();

        this.#cameraTransition = {
            startMs: performance.now(),
            durationMs: 850,
            fromPosition,
            fromTarget,
            toPosition,
            toTarget
        };
    }

    #updateCameraTransition(nowMs) {
        if (!this.#cameraTransition) {
            return;
        }

        const progress = THREE.MathUtils.clamp((nowMs - this.#cameraTransition.startMs) / this.#cameraTransition.durationMs, 0, 1);
        const easedProgress = 1 - (1 - progress) ** 3;

        this.#camera.position.lerpVectors(
            this.#cameraTransition.fromPosition,
            this.#cameraTransition.toPosition,
            easedProgress
        );
        this.#controls.target.lerpVectors(
            this.#cameraTransition.fromTarget,
            this.#cameraTransition.toTarget,
            easedProgress
        );
        this.#camera.lookAt(this.#controls.target);

        if (progress >= 1) {
            this.#camera.position.copy(this.#cameraTransition.toPosition);
            this.#controls.target.copy(this.#cameraTransition.toTarget);
            this.#controls.update();
            this.#cameraTransition = null;
        }
    }

    #updateRendererSize() {
        const clientWidth = Math.max(this.#ui.rendererHost.clientWidth, 1);
        const clientHeight = Math.max(this.#ui.rendererHost.clientHeight, 1);

        if (clientWidth === this.#lastRendererWidth && clientHeight === this.#lastRendererHeight) {
            return;
        }

        this.#lastRendererWidth = clientWidth;
        this.#lastRendererHeight = clientHeight;

        this.#renderer.setSize(clientWidth, clientHeight, false);
        this.#camera.aspect = clientWidth / clientHeight;
        this.#camera.updateProjectionMatrix();

        if (this.#renderPipeline) {
            this.#renderPipeline.render();
        }
    }

    #enterSceneFocus() {
        if (this.#ui.root.classList.contains('scene-expanded')) {
            return;
        }

        this.#startSceneFocusCameraTransition();
        this.#ui.root.classList.add('scene-expanded');
        if (this.#plate) this.#plate.visible = true;
        this.#ui.buddyChat.removeAttribute('inert');
        this.#ui.buddyChat.setAttribute('aria-hidden', 'false');
        this.#ui.chatInputLane.setAttribute('aria-hidden', 'false');
        this.#requestRendererResize();
    }

    #setPendingState(isPending) {
        this.#ui.chatInput.disabled = isPending;
        this.#ui.chatSend.disabled = isPending;
    }

    async #handleChatSubmit(event) {
        event.preventDefault();

        const userMessage = this.#ui.chatInput.value.trim();
        if (!userMessage) {
            return;
        }

        const apiKey = HARDCODED_GEMINI_API_KEY ? HARDCODED_GEMINI_API_KEY.trim() : '';
        if (!apiKey) {
            appendChatMessage(
                this.#ui.chatLog,
                'model',
                'Gemini key is not configured yet. Add it to `js/config.js` to enable chat replies.'
            );
            return;
        }

        appendChatMessage(this.#ui.chatLog, 'user', userMessage);
        this.#ui.chatInput.value = '';

        this.#conversationHistory.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });
        trimConversationHistory(this.#conversationHistory);

        this.#setPendingState(true);

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [
                            {
                                text: BUDDY_SYSTEM_PROMPT
                            }
                        ]
                    },
                    contents: this.#conversationHistory,
                    generationConfig: {
                        temperature: 0.7
                    }
                })
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                const errorMessage = errorPayload?.error?.message || `Gemini request failed (${response.status})`;
                throw new Error(errorMessage);
            }

            const responseData = await response.json();
            const buddyReply = getGeminiResponseText(responseData);

            if (!buddyReply) {
                throw new Error('Gemini returned an empty response.');
            }

            appendChatMessage(this.#ui.chatLog, 'model', buddyReply);

            this.#conversationHistory.push({
                role: 'model',
                parts: [{ text: buddyReply }]
            });
            trimConversationHistory(this.#conversationHistory);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unexpected Gemini API error.';
            appendChatMessage(this.#ui.chatLog, 'model', `I ran into a connection issue: ${message}`);
        } finally {
            this.#setPendingState(false);
            this.#ui.chatInput.focus();
        }
    }

    #setupDebugTool() {
        this.#debugUI = document.createElement('div');
        Object.assign(this.#debugUI.style, {
            position: 'fixed',
            top: '300px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#00ff44',
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: '11px',
            zIndex: '1000000',
            border: '1px solid #00ff44',
            borderRadius: '4px',
            display: 'none',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '220px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            userSelect: 'none',
            pointerEvents: 'auto'
        });

        this.#debugUI.innerHTML = `
            <div style="font-weight: bold; border-bottom: 1px solid #00ff44; padding-bottom: 5px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <span>CAM_DCC_CONTROLLER</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 9px; opacity: 0.7;">v1.0.5</span>
                    <button id="debug-hide-btn" style="background: rgba(0,255,68,0.2); color: #00ff44; border: 1px solid #00ff44; padding: 0 5px; cursor: pointer; font-size: 10px; border-radius: 2px; font-weight: bold;">_</button>
                </div>
            </div>
            <div id="debug-content-body" style="display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,255,68,0.1); padding: 4px; border-radius: 2px;">
                    <span>MANUAL_OVERRIDE:</span>
                    <input type="checkbox" id="debug-mode-toggle" style="cursor: pointer; accent-color: #00ff44;">
                </div>

                <div id="debug-trackpad" style="height: 40px; background: rgba(0,255,68,0.05); border: 1px dashed rgba(0,255,68,0.3); border-radius: 2px; position: relative; cursor: crosshair; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <span style="font-size: 9px; color: #00ff44; opacity: 0.5; pointer-events: none;">ORBIT_TRACKPAD</span>
                    <div id="trackpad-cursor" style="position: absolute; width: 6px; height: 6px; border: 1px solid #00ff44; border-radius: 50%; pointer-events: none; opacity: 0;"></div>
                </div>

                <div id="debug-panpad" style="height: 40px; background: rgba(0,255,68,0.05); border: 1px dashed rgba(0,255,68,0.3); border-radius: 2px; position: relative; cursor: move; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <span style="font-size: 9px; color: #00ff44; opacity: 0.5; pointer-events: none;">PAN_TRACKPAD</span>
                    <div id="panpad-cursor" style="position: absolute; width: 6px; height: 6px; border: 1px solid #00ff44; border-radius: 50%; pointer-events: none; opacity: 0;"></div>
                </div>

                <div id="debug-zoompad" style="height: 40px; background: rgba(0,255,68,0.05); border: 1px dashed rgba(0,255,68,0.3); border-radius: 2px; position: relative; cursor: ns-resize; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <span style="font-size: 9px; color: #00ff44; opacity: 0.5; pointer-events: none;">ZOOM_TRACKPAD</span>
                    <div id="zoompad-cursor" style="position: absolute; width: 6px; height: 6px; border: 1px solid #00ff44; border-radius: 50%; pointer-events: none; opacity: 0;"></div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="color: #888; margin-bottom: 2px;">POSITION</div>
                        X: <span id="cam-pos-x" style="color: #fff;">0.00</span><br>
                        Y: <span id="cam-pos-y" style="color: #fff;">0.00</span><br>
                        Z: <span id="cam-pos-z" style="color: #fff;">0.00</span>
                    </div>
                    <div>
                        <div style="color: #888; margin-bottom: 2px;">TARGET</div>
                        X: <span id="cam-tar-x" style="color: #fff;">0.00</span><br>
                        Y: <span id="cam-tar-y" style="color: #fff;">0.00</span><br>
                        Z: <span id="cam-tar-z" style="color: #fff;">0.00</span>
                    </div>
                </div>
                <div style="font-size: 9px; color: #888;">
                    FOV: <span id="cam-fov" style="color: #fff;">0</span> |
                    DIST: <span id="cam-dist" style="color: #fff;">0.00</span>
                </div>
                <button id="copy-cam-data" style="background: transparent; color: #00ff44; border: 1px solid #00ff44; padding: 6px; cursor: pointer; font-family: monospace; font-size: 10px; font-weight: bold; transition: all 0.2s;">COPY_COORDINATES</button>
            </div>
        `;

        document.body.appendChild(this.#debugUI);

        const hideBtn = this.#debugUI.querySelector('#debug-hide-btn');
        const body = this.#debugUI.querySelector('#debug-content-body');

        hideBtn?.addEventListener('click', () => {
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'flex' : 'none';
            hideBtn.textContent = isHidden ? '_' : '+';
            this.#debugUI.style.minWidth = isHidden ? '220px' : '0';
        });

        const toggle = this.#debugUI.querySelector('#debug-mode-toggle');
        toggle?.addEventListener('change', (event) => {
            this.#debugMode = event.target.checked;
            this.#controls.enabled = this.#debugMode;
            if (this.#debugMode) {
                this.#cameraTarget = null;
                this.#controlsTarget = null;
            }
        });

        const trackpad = this.#debugUI.querySelector('#debug-trackpad');
        const tpCursor = this.#debugUI.querySelector('#trackpad-cursor');
        let isDraggingTP = false;
        let lastX = 0;
        let lastY = 0;

        trackpad?.addEventListener('pointerdown', (event) => {
            isDraggingTP = true;
            lastX = event.clientX;
            lastY = event.clientY;
            tpCursor.style.opacity = '1';
            trackpad.style.backgroundColor = 'rgba(0,255,68,0.15)';
            trackpad.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        trackpad?.addEventListener('pointermove', (event) => {
            if (!isDraggingTP) {
                return;
            }

            const dx = (event.clientX - lastX) * 0.01;
            const dy = (event.clientY - lastY) * 0.01;
            lastX = event.clientX;
            lastY = event.clientY;

            const offset = this.#camera.position.clone().sub(this.#controls.target);
            const radius = offset.length();
            let theta = Math.atan2(offset.x, offset.z);
            let phi = Math.acos(Math.min(Math.max(offset.y / radius, -1), 1));

            theta -= dx;
            phi -= dy;
            phi = Math.min(Math.max(phi, 0.1), Math.PI / 2.1);

            offset.x = radius * Math.sin(phi) * Math.sin(theta);
            offset.y = radius * Math.cos(phi);
            offset.z = radius * Math.sin(phi) * Math.cos(theta);

            this.#camera.position.copy(this.#controls.target).add(offset);
            this.#camera.lookAt(this.#controls.target);
            this.#controls.update();

            const rect = trackpad.getBoundingClientRect();
            tpCursor.style.left = `${event.clientX - rect.left}px`;
            tpCursor.style.top = `${event.clientY - rect.top}px`;

            this.#cameraTarget = null;
            this.#controlsTarget = null;
        });

        trackpad?.addEventListener('pointerup', (event) => {
            if (!isDraggingTP) {
                return;
            }

            isDraggingTP = false;
            tpCursor.style.opacity = '0';
            trackpad.style.backgroundColor = 'rgba(0,255,68,0.05)';
            trackpad.releasePointerCapture(event.pointerId);
        });

        const panpad = this.#debugUI.querySelector('#debug-panpad');
        const panCursor = this.#debugUI.querySelector('#panpad-cursor');
        let isDraggingPan = false;

        panpad?.addEventListener('pointerdown', (event) => {
            isDraggingPan = true;
            lastX = event.clientX;
            lastY = event.clientY;
            panCursor.style.opacity = '1';
            panpad.style.backgroundColor = 'rgba(0,255,68,0.15)';
            panpad.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        panpad?.addEventListener('pointermove', (event) => {
            if (!isDraggingPan) {
                return;
            }

            const dx = (event.clientX - lastX) * 0.15;
            const dy = (event.clientY - lastY) * 0.15;
            lastX = event.clientX;
            lastY = event.clientY;

            const vector = new THREE.Vector3();
            const right = new THREE.Vector3();
            const up = new THREE.Vector3();

            this.#camera.getWorldDirection(vector);
            up.copy(this.#camera.up);
            right.crossVectors(vector, up).normalize();
            up.crossVectors(right, vector).normalize();

            const translation = right.clone().multiplyScalar(-dx).add(up.clone().multiplyScalar(dy));

            this.#camera.position.add(translation);
            this.#controls.target.add(translation);
            this.#controls.update();

            const rect = panpad.getBoundingClientRect();
            panCursor.style.left = `${event.clientX - rect.left}px`;
            panCursor.style.top = `${event.clientY - rect.top}px`;

            this.#cameraTarget = null;
            this.#controlsTarget = null;
        });

        panpad?.addEventListener('pointerup', (event) => {
            if (!isDraggingPan) {
                return;
            }

            isDraggingPan = false;
            panCursor.style.opacity = '0';
            panpad.style.backgroundColor = 'rgba(0,255,68,0.05)';
            panpad.releasePointerCapture(event.pointerId);
        });

        const zoompad = this.#debugUI.querySelector('#debug-zoompad');
        const zoomCursor = this.#debugUI.querySelector('#zoompad-cursor');
        let isDraggingZoom = false;

        zoompad?.addEventListener('pointerdown', (event) => {
            isDraggingZoom = true;
            lastX = event.clientX;
            lastY = event.clientY;
            zoomCursor.style.opacity = '1';
            zoompad.style.backgroundColor = 'rgba(0,255,68,0.15)';
            zoompad.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        zoompad?.addEventListener('pointermove', (event) => {
            if (!isDraggingZoom) {
                return;
            }

            const dy = (event.clientY - lastY) * 0.5;
            lastX = event.clientX;
            lastY = event.clientY;

            const offset = this.#camera.position.clone().sub(this.#controls.target);
            const radius = offset.length();
            const newRadius = Math.max(radius + dy, 0.1);
            offset.normalize().multiplyScalar(newRadius);

            this.#camera.position.copy(this.#controls.target).add(offset);
            this.#camera.lookAt(this.#controls.target);
            this.#controls.update();

            const rect = zoompad.getBoundingClientRect();
            zoomCursor.style.left = `${event.clientX - rect.left}px`;
            zoomCursor.style.top = `${event.clientY - rect.top}px`;

            this.#cameraTarget = null;
            this.#controlsTarget = null;
        });

        zoompad?.addEventListener('pointerup', (event) => {
            if (!isDraggingZoom) {
                return;
            }

            isDraggingZoom = false;
            zoomCursor.style.opacity = '0';
            zoompad.style.backgroundColor = 'rgba(0,255,68,0.05)';
            zoompad.releasePointerCapture(event.pointerId);
        });

        const copyBtn = this.#debugUI.querySelector('#copy-cam-data');
        copyBtn?.addEventListener('mouseenter', () => {
            copyBtn.style.backgroundColor = '#00ff44';
            copyBtn.style.color = 'black';
        });

        copyBtn?.addEventListener('mouseleave', () => {
            copyBtn.style.backgroundColor = 'transparent';
            copyBtn.style.color = '#00ff44';
        });

        copyBtn?.addEventListener('click', () => {
            const p = this.#camera.position;
            const t = this.#controls.target;
            const data = `POS: { x: ${p.x.toFixed(2)}, y: ${p.y.toFixed(2)}, z: ${p.z.toFixed(2)} }, TAR: { x: ${t.x.toFixed(2)}, y: ${t.y.toFixed(2)}, z: ${t.z.toFixed(2)} }`;

            navigator.clipboard.writeText(data).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'COPIED!';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }).catch(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'COPY_FAILED';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            });
        });

        this.#updateDebugInfo();
    }

    #updateDebugInfo() {
        if (!this.#debugUI) {
            return;
        }

        const p = this.#camera.position;
        const t = this.#controls.target;

        this.#debugUI.querySelector('#cam-pos-x').textContent = p.x.toFixed(2);
        this.#debugUI.querySelector('#cam-pos-y').textContent = p.y.toFixed(2);
        this.#debugUI.querySelector('#cam-pos-z').textContent = p.z.toFixed(2);
        this.#debugUI.querySelector('#cam-tar-x').textContent = t.x.toFixed(2);
        this.#debugUI.querySelector('#cam-tar-y').textContent = t.y.toFixed(2);
        this.#debugUI.querySelector('#cam-tar-z').textContent = t.z.toFixed(2);
        this.#debugUI.querySelector('#cam-fov').textContent = Math.round(this.#camera.fov);
        this.#debugUI.querySelector('#cam-dist').textContent = p.distanceTo(t).toFixed(2);
    }
}

export async function initThreeScene() {
    setupGamesOverlay();
    const budgetBuddyScene = new BudgetBuddyScene();
    await budgetBuddyScene.init();
}