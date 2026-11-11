import { useEffect, useRef } from 'react';

interface ModalEntry {
  id: symbol;
  onClose: () => void;
  poppedByBack: boolean;
}

const modalStack: ModalEntry[] = [];
let activeDummyHistoryCount = 0;
let ignoreNextPopCount = 0;
let lastModalPopTimestamp = 0;
let listenerAttached = false;

function handleGlobalPopState() {
  if (ignoreNextPopCount > 0) {
    ignoreNextPopCount--;
    lastModalPopTimestamp = Date.now();
    return;
  }

  if (modalStack.length > 0) {
    const top = modalStack.pop()!;
    top.poppedByBack = true;
    if (activeDummyHistoryCount > 0) {
      activeDummyHistoryCount--;
    }
    lastModalPopTimestamp = Date.now();
    try {
      top.onClose();
    } catch (err) {
      console.warn('[backNavigation] Modal onClose notice:', err);
    }
  }
}

function ensureListener() {
  if (typeof window !== 'undefined' && !listenerAttached) {
    window.addEventListener('popstate', handleGlobalPopState);
    listenerAttached = true;
  }
}

/**
 * Returns true if a modal/overlay was just closed by the hardware/browser Back button
 * or if an ignore-pop is currently in flight, so route-level popstate handlers don't jump away.
 */
export function wasHandledByModalBack(): boolean {
  return ignoreNextPopCount > 0 || modalStack.length > 0 || (Date.now() - lastModalPopTimestamp < 150);
}

/**
 * Intercepts mobile/browser Back button presses while a modal/dialog/overlay is open,
 * closing only that topmost overlay instead of navigating away from the current page.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    ensureListener();

    const entry: ModalEntry = {
      id: Symbol('modal'),
      onClose: () => onCloseRef.current(),
      poppedByBack: false,
    };

    modalStack.push(entry);
    activeDummyHistoryCount++;
    try {
      window.history.pushState({ ...(window.history.state || {}), __prescriptoModal: true }, '');
    } catch {
      // Ignore history restrictions in restricted frames
    }

    return () => {
      const idx = modalStack.findIndex((m) => m.id === entry.id);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }

      if (!entry.poppedByBack && activeDummyHistoryCount > 0) {
        activeDummyHistoryCount--;
        ignoreNextPopCount++;
        try {
          window.history.back();
        } catch {
          ignoreNextPopCount = Math.max(0, ignoreNextPopCount - 1);
        }
      }
    };
  }, [isOpen]);
}

