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