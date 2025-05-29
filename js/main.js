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
    grass: { color: 0x559955 }, // 녹색 계열
    dirt: { color: 0x8B4513 },  // 갈색 (SaddleBrown)
    stone: { color: 0x808080 }  // 회색
};

// --- 초기화 함수 ---
function init() {
    // 1. Scene 생성
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 하늘색 배경

    // 2. Camera 생성
    const aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(5, 8, 10); // 카메라 위치 조정 (더 넓은 시야)
    camera.lookAt(5, 0, 5); // 카메라가 생성될 땅 중앙을 바라보도록 설정

    // 3. Renderer 생성
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    sceneContainer.appendChild(renderer.domElement);

    // 4. Controls 생성 (OrbitControls)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(5, 0, 5); // 컨트롤의 타겟도 땅 중앙으로

    // 5. 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10); // 빛 위치 조정
    directionalLight.castShadow = true; // 그림자 생성 활성화
    scene.add(directionalLight);

    // 그림자 설정
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;

    // 6. 블록 생성
    createWorldFromData();

    // 7. 창 크기 변경 시 처리
    window.addEventListener('resize', onWindowResize, false);
}

// --- 월드 생성 함수 ---
function createWorldFromData() {
    // 임시 월드 데이터 (JSON 파일에서 불러올 데이터와 유사한 구조)
    // 10x1x10 크기의 땅을 만듭니다. y=0은 잔디, 그 아래 y=-1은 흙으로.
    const worldData = {
        blocks: []
    };
    const worldSize = 10; // 가로, 세로 크기
    const groundLevel = 0;

    for (let x = 0; x < worldSize; x++) {
        for (let z = 0; z < worldSize; z++) {
            // 표면은 grass
            worldData.blocks.push({ x: x, y: groundLevel, z: z, type: 'grass' });
            // 그 아래 한 층은 dirt
            worldData.blocks.push({ x: x, y: groundLevel - 1, z: z, type: 'dirt' });
        }
    }

    // 데이터 기반으로 블록 생성
    worldData.blocks.forEach(blockData => {
        addBlock(blockData.x, blockData.y, blockData.z, blockData.type);
    });
}

// --- 블록 추가 함수 ---
function addBlock(x, y, z, type) {
    const blockInfo = blockTypes[type] || blockTypes.stone; // 정의되지 않은 타입은 stone으로

    // Geometry: 모든 블록은 동일한 BoxGeometry를 공유하여 성능 향상 가능 (여기선 각자 생성)
    // 최적화를 위해서는 하나의 Geometry를 여러 Mesh에서 재사용하는 것이 좋습니다.
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Material: 각 블록 타입에 맞는 색상으로 Material 생성
    // 이것도 동일 타입의 Material은 재사용 가능합니다.
    const material = new THREE.MeshStandardMaterial({ color: blockInfo.color });
    
    const block = new THREE.Mesh(geometry, material);
    // 블록의 중심이 (x,y,z) 그리드 셀의 중앙에 오도록 위치 조정
    block.position.set(x + 0.5, y + 0.5, z + 0.5); 

    block.castShadow = true;    // 블록이 그림자를 드리우도록 설정
    block.receiveShadow = true; // 블록이 다른 객체의 그림자를 받도록 설정

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

// --- 애니메이션 루프 ---
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update(); // 컨트롤 업데이트
    if (renderer && scene && camera) renderer.render(scene, camera); // 렌더링
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
        color: red; 
        position: absolute; 
        top: 10px; left: 10px; 
        padding: 10px; 
        background-color: white; 
        border: 1px solid red; 
        z-index: 1000;`; // z-index 추가
    if (sceneContainer) { // sceneContainer가 있는지 확인 후 추가
        sceneContainer.appendChild(errorDiv);
    } else {
        document.body.appendChild(errorDiv); // 최후의 수단으로 body에 추가
    }
}