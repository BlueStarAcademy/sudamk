// 이미지 Lazy Loading 유틸리티
// Intersection Observer를 사용하여 화면에 보이는 이미지만 로드

export const setupLazyImage = (imgElement: HTMLImageElement, src: string) => {
    if (!imgElement || !src) return;

    // 이미 로드된 이미지는 스킵
    if (imgElement.src && imgElement.src === src) return;

    // Intersection Observer 생성
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    img.src = src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        },
        {
            rootMargin: '50px', // 화면에 들어오기 50px 전에 미리 로드
            threshold: 0.01
        }
    );

    // 초기에는 placeholder 또는 빈 이미지 사용
    imgElement.dataset.src = src;
    imgElement.classList.add('lazy-load');
    
    observer.observe(imgElement);
};

