import React, { useEffect, useRef, useState, useCallback, memo } from 'react';

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  animationDuration?: number; // Duration of animation in seconds
}

const MarqueeComponent: React.FC<MarqueeProps> = ({ 
  children, 
  className = ''}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const checkAndApplyAnimation = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;

    const container = containerRef.current;
    const content = contentRef.current;

    // Убираем класс анимации и сбрасываем переменную сдвига
    content.classList.remove('marquee-animated');
    content.style.removeProperty('--shift');

    // Ждем завершения всех изменений DOM
    requestAnimationFrame(() => {
      // Измеряем ширину
      const containerWidth = container.offsetWidth;
      const contentWidth = content.offsetWidth;
      const shift = contentWidth - containerWidth;

      // Если текст действительно не помещается
      if (shift > 0) {
        // Устанавливаем CSS-переменную со значением смещения
        content.style.setProperty('--shift', `-${shift}px`);
        // Добавляем класс для активации анимации
        content.classList.add('marquee-animated');
      }
    });
  }, []);

  useEffect(() => {
    // После первого рендера и применения стилей проверяем необходимость анимации
    const init = () => {
      checkAndApplyAnimation();
      setIsInitialized(true);
    };

    // Проверяем сразу и при изменении размеров окна
    if (!isInitialized) {
      init();
    } else {
      checkAndApplyAnimation();
    }

    const handleResize = () => {
      checkAndApplyAnimation();
    };

    window.addEventListener('resize', handleResize);

    // Также следим за изменениями размеров элемента
    let resizeObserver: ResizeObserver | null = null;
    
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        checkAndApplyAnimation();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [children, checkAndApplyAnimation, isInitialized]);

  return (
    <span className={`marquee-container ${className}`} ref={containerRef}>
      <span 
        className="marquee-content" 
        ref={contentRef}
      >
        {children}
      </span>
    </span>
  );
};

export default memo(MarqueeComponent);