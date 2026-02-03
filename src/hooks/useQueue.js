import { useState, useCallback, useMemo } from 'react';

export const useQueue = (initialItems = []) => {
  const [queue, setQueue] = useState(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none'); // 'none' | 'one' | 'all'
  const [history, setHistory] = useState([]);

  // Current item
  const currentItem = useMemo(() => queue[currentIndex] || null, [queue, currentIndex]);

  // Has next/previous
  const hasNext = useMemo(() => {
    if (repeat === 'all') return queue.length > 0;
    return currentIndex < queue.length - 1;
  }, [currentIndex, queue.length, repeat]);

  const hasPrevious = useMemo(() => {
    return currentIndex > 0 || history.length > 0;
  }, [currentIndex, history.length]);

  // Add item to queue
  const addToQueue = useCallback((item) => {
    setQueue(q => [...q, item]);
  }, []);

  // Add multiple items
  const addMultipleToQueue = useCallback((items) => {
    setQueue(q => [...q, ...items]);
  }, []);

  // Insert next (play after current)
  const playNext = useCallback((item) => {
    setQueue(q => {
      const newQueue = [...q];
      newQueue.splice(currentIndex + 1, 0, item);
      return newQueue;
    });
  }, [currentIndex]);

  // Remove from queue
  const removeFromQueue = useCallback((index) => {
    setQueue(q => q.filter((_, i) => i !== index));
    if (index < currentIndex) {
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  // Clear queue
  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(0);
    setHistory([]);
  }, []);

  // Play specific item
  const playItem = useCallback((index) => {
    if (index >= 0 && index < queue.length) {
      setHistory(h => [...h, currentIndex]);
      setCurrentIndex(index);
    }
  }, [queue.length, currentIndex]);

  // Next item
  const next = useCallback(() => {
    if (repeat === 'one') {
      // Replay current
      return currentItem;
    }

    let nextIndex;
    if (shuffle) {
      // Random next (exclude current)
      const available = queue.map((_, i) => i).filter(i => i !== currentIndex);
      nextIndex = available[Math.floor(Math.random() * available.length)];
    } else {
      nextIndex = currentIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        return null; // End of queue
      }
    }

    setHistory(h => [...h, currentIndex]);
    setCurrentIndex(nextIndex);
    return queue[nextIndex];
  }, [currentIndex, queue, shuffle, repeat, currentItem]);

  // Previous item
  const previous = useCallback(() => {
    if (history.length > 0) {
      const prevIndex = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setCurrentIndex(prevIndex);
      return queue[prevIndex];
    }
    
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      return queue[currentIndex - 1];
    }

    return null;
  }, [history, currentIndex, queue]);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setShuffle(s => !s);
  }, []);

  // Cycle repeat mode
  const cycleRepeat = useCallback(() => {
    setRepeat(r => {
      if (r === 'none') return 'all';
      if (r === 'all') return 'one';
      return 'none';
    });
  }, []);

  // Reorder queue (drag & drop)
  const reorder = useCallback((fromIndex, toIndex) => {
    setQueue(q => {
      const newQueue = [...q];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      return newQueue;
    });

    // Adjust current index if needed
    if (fromIndex === currentIndex) {
      setCurrentIndex(toIndex);
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      setCurrentIndex(i => i - 1);
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex]);

  // Set entire queue
  const setQueueItems = useCallback((items, startIndex = 0) => {
    setQueue(items);
    setCurrentIndex(startIndex);
    setHistory([]);
  }, []);

  return {
    queue,
    currentIndex,
    currentItem,
    shuffle,
    repeat,
    hasNext,
    hasPrevious,
    addToQueue,
    addMultipleToQueue,
    playNext,
    removeFromQueue,
    clearQueue,
    playItem,
    next,
    previous,
    toggleShuffle,
    cycleRepeat,
    reorder,
    setQueueItems,
  };
};

export default useQueue;
