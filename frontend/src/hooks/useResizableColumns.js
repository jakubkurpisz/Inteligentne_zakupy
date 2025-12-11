import React, { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook do obsługi ręcznej zmiany szerokości kolumn w tabelach
 * @param {Object} initialWidths - Początkowe szerokości kolumn { columnKey: width }
 * @param {string} storageKey - Klucz do zapisania szerokości w localStorage (opcjonalny)
 * @param {number} minWidth - Minimalna szerokość kolumny (domyślnie 50px)
 */
export const useResizableColumns = (initialWidths = {}, storageKey = null, minWidth = 50) => {
  // Wczytaj zapisane szerokości z localStorage lub użyj początkowych
  const [columnWidths, setColumnWidths] = useState(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`columnWidths_${storageKey}`);
        if (saved) {
          return { ...initialWidths, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.warn('Błąd wczytywania szerokości kolumn:', e);
      }
    }
    return initialWidths;
  });

  const isResizing = useRef(false);
  const currentColumn = useRef(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Zapisz szerokości do localStorage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(`columnWidths_${storageKey}`, JSON.stringify(columnWidths));
      } catch (e) {
        console.warn('Błąd zapisywania szerokości kolumn:', e);
      }
    }
  }, [columnWidths, storageKey]);

  // Rozpocznij resize
  const startResize = useCallback((columnKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    currentColumn.current = columnKey;
    startX.current = e.clientX || e.touches?.[0]?.clientX || 0;
    startWidth.current = columnWidths[columnKey] || 100;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

  // Obsługa ruchu myszy
  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current || !currentColumn.current) return;

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const diff = clientX - startX.current;
    const newWidth = Math.max(minWidth, startWidth.current + diff);

    setColumnWidths(prev => ({
      ...prev,
      [currentColumn.current]: newWidth
    }));
  }, [minWidth]);

  // Zakończ resize
  const stopResize = useCallback(() => {
    isResizing.current = false;
    currentColumn.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Dodaj globalne event listenery
  useEffect(() => {
    const handleMove = (e) => handleMouseMove(e);
    const handleUp = () => stopResize();

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleUp);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [handleMouseMove, stopResize]);

  // Reset do domyślnych szerokości
  const resetWidths = useCallback(() => {
    setColumnWidths(initialWidths);
  }, [initialWidths]);

  // Pobierz style dla kolumny
  const getColumnStyle = useCallback((columnKey) => {
    const width = columnWidths[columnKey];
    if (!width) return {};
    return {
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`
    };
  }, [columnWidths]);

  // Komponent uchwytu do resize
  const ResizeHandle = useCallback(({ columnKey, className = '' }) => {
    return React.createElement('div', {
      className: `absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-blue-400 active:bg-blue-600 z-10 ${className}`,
      onMouseDown: (e) => startResize(columnKey, e),
      onTouchStart: (e) => startResize(columnKey, e),
      style: { touchAction: 'none' }
    });
  }, [startResize]);

  return {
    columnWidths,
    setColumnWidths,
    startResize,
    resetWidths,
    getColumnStyle,
    ResizeHandle,
    isResizing: isResizing.current
  };
};

export default useResizableColumns;
