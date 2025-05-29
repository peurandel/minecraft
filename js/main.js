// js/main.js
console.log("CSS Minecraft 3D Project Initialized!");

document.addEventListener('DOMContentLoaded', () => {
    const world = document.querySelector('.world');

    // 예시: 간단한 마우스 드래그로 월드 회전 (옵션)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let currentRotation = { x: 60, y: 0, z: 45 }; // 초기 CSS와 동일하게 설정

    // 현재 transform 값을 파싱하여 초기 회전 값을 가져오는 더 견고한 방법이 필요할 수 있습니다.
    // 여기서는 CSS에 정의된 초기 값을 사용합니다.

    document.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        // Y축 회전 (마우스 좌우) / X축 회전 (마우스 상하)
        currentRotation.y += deltaX * 0.5; // 회전 감도 조절
        currentRotation.x -= deltaY * 0.5; // Y축 움직임에 따라 X축 회전 (반대로 하려면 +)

        // X축 회전 범위 제한 (예: -90도 ~ 90도)
        currentRotation.x = Math.max(-89, Math.min(89, currentRotation.x));


        world.style.transform = `rotateX(${currentRotation.x}deg) rotateY(${currentRotation.y}deg) rotateZ(${currentRotation.z}deg) translateX(0px) translateY(-150px) translateZ(-200px)`; // 기존 transform 값 유지

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    document.addEventListener('mouseleave', () => { // 창 밖으로 나가도 드래그 중지
        isDragging = false;
    });


    // (추후) 여기에 블록 생성 및 관리, 사용자 입력 처리 등의 로직을 추가합니다.
    // 예: createBlock(x, y, z, type);
});
// js/main.js

// --- 전역 변수 및 상수 ---
let scene, camera, renderer, controls;
const sceneContainer = document.getElementById('scene-container');

// 블록 타입 정의 (색상 등)
const blockTypes = {
    grass: { color: 0x559955 },
    dirt: { color: 0x8B4513 },
    stone: { color: 0x808080 }
};

// --- NEW: Keyboard state and movement parameters ---
const keysPressed = {
    w: false, a: false, s: false, d: false,
    shift: false, // For moving down
    space: false  // For moving up
};
const cameraMoveSpeed = 0.2; // Adjust for desired speed
const cameraLookSpeed = 0.002; // For mouse look, if you add it later

// --- 초기화 함수 ---
function init() {
    // 1. Scene 생성
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);

    // 2. Camera 생성
    const aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(5, 8, 10);
    // camera.lookAt(5, 0, 5); // OrbitControls will manage the lookAt target initially

    // 3. Renderer 생성
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    sceneContainer.appendChild(renderer.domElement);

    // 4. Controls 생성 (OrbitControls)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(5, 0, 5);
    // IMPORTANT for WASD control:
    // OrbitControls can interfere with direct position updates.
    // You might want to disable its panning or disable it entirely if WASD is primary.
    // For now, we'll try to make them coexist.
    // Or, if you prefer direct WASD control and mouse look, you might remove OrbitControls
    // and implement PointerLockControls.
    // controls.enablePan = false; // Option: Disable OrbitControls panning

    // 5. 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;

    // 6. 블록 생성
    createWorldFromData();

    // 7. 창 크기 변경 시 처리
    window.addEventListener('resize', onWindowResize, false);

    // --- NEW: Add Keyboard Event Listeners ---
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
}

// --- 월드 생성 함수 ---
function createWorldFromData() {
    const worldData = { blocks: [] };
    const worldSize = 10;
    const groundLevel = 0;
    for (let x = 0; x < worldSize; x++) {
        for (let z = 0; z < worldSize; z++) {
            worldData.blocks.push({ x: x, y: groundLevel, z: z, type: 'grass' });
            worldData.blocks.push({ x: x, y: groundLevel - 1, z: z, type: 'dirt' });
        }
    }
    worldData.blocks.forEach(blockData => {
        addBlock(blockData.x, blockData.y, blockData.z, blockData.type);
    });
}

// --- 블록 추가 함수 ---
function addBlock(x, y, z, type) {
    const blockInfo = blockTypes[type] || blockTypes.stone;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: blockInfo.color });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(x + 0.5, y + 0.5, z + 0.5);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
}

// --- 창 크기 변경 처리 함수 ---
function onWindowResize() {
    if (camera && renderer && sceneContainer) {
        camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    }
}

// --- NEW: Keyboard Event Handlers ---
function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'w': keysPressed.w = true; break;
        case 'a': keysPressed.a = true; break;
        case 's': keysPressed.s = true; break;
        case 'd': keysPressed.d = true; break;
        case ' ': event.preventDefault(); keysPressed.space = true; break; // Space for Up
        case 'shift': event.preventDefault(); keysPressed.shift = true; break; // Shift for Down
    }
}

function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': keysPressed.w = false; break;
        case 'a': keysPressed.a = false; break;
        case 's': keysPressed.s = false; break;
        case 'd': keysPressed.d = false; break;
        case ' ': keysPressed.space = false; break;
        case 'shift': keysPressed.shift = false; break;
    }
}

// --- NEW: Update Camera Position based on keys ---
function updateCameraMovement() {
    if (!camera) return;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward); // Gets the direction the camera is looking
    forward.y = 0; // Keep movement horizontal (don't fly up/down based on pitch)
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize(); // Get right vector, perpendicular to 'up' and 'forward'

    let moved = false;

    if (keysPressed.w) {
        camera.position.addScaledVector(forward, cameraMoveSpeed);
        if (controls) controls.target.addScaledVector(forward, cameraMoveSpeed); // Move target with camera
        moved = true;
    }
    if (keysPressed.s) {
        camera.position.addScaledVector(forward, -cameraMoveSpeed);
        if (controls) controls.target.addScaledVector(forward, -cameraMoveSpeed);
        moved = true;
    }
    if (keysPressed.d) {
        const strafeLeftDirection = new THREE.Vector3().crossVectors(camera.up, forward).negate().normalize();
        camera.position.addScaledVector(strafeLeftDirection, cameraMoveSpeed);
        if (controls) controls.target.addScaledVector(strafeLeftDirection, cameraMoveSpeed);
        moved = true;
    }
    if (keysPressed.a) {
        // To strafe right, we move in the positive 'right' direction.
        const strafeRightDirection = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
        camera.position.addScaledVector(strafeRightDirection, cameraMoveSpeed);
        if (controls) controls.target.addScaledVector(strafeRightDirection, cameraMoveSpeed);
        moved = true;
    }
    if (keysPressed.space) {
        camera.position.y += cameraMoveSpeed;
        if (controls) controls.target.y += cameraMoveSpeed;
        moved = true;
    }
    if (keysPressed.shift) {
        camera.position.y -= cameraMoveSpeed;
        if (controls) controls.target.y -= cameraMoveSpeed;
        moved = true;
    }
}


// --- 애니메이션 루프 ---
function animate() {
    requestAnimationFrame(animate);

    // --- NEW: Update camera movement ---
    updateCameraMovement();

    if (controls) {
        controls.update(); // OrbitControls update (handles damping, etc.)
                           // If you want WASD to be the ONLY position control,
                           // you might consider disabling OrbitControls or its pan/zoom features.
    }
    if (renderer && scene && camera) {
        renderer.render(scene, camera); // 렌더링
    }
}

// --- 실행 ---
try {
    init();
    animate();
} catch (error) {
    console.error("An error occurred during initialization or animation:", error);
    const errorDiv = document.createElement('div');
    errorDiv.textContent = '오류가 발생했습니다. 콘솔을 확인해주세요.';
    errorDiv.style.cssText = `
        color: red; position: absolute; top: 10px; left: 10px;
        padding: 10px; background-color: white; border: 1px solid red;
        z-index: 1000;`;
    if (sceneContainer) {
        sceneContainer.appendChild(errorDiv);
    } else {
        document.body.appendChild(errorDiv);
    }
}