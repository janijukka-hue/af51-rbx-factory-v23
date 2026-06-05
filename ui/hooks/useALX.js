// ui/hooks/useALX.js
// ALX Connection Hook - React Native

import { useState, useCallback, useEffect } from "react";

export function useALX(alxInstance) {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (alxInstance) {
      setIsReady(true);
      setSessionId(alxInstance.getStatus?.()?.sessionId || null);
    }
  }, [alxInstance]);

  const sendMessage = useCallback(async (message, context = {}) => {
    if (!alxInstance || isProcessing) return null;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await alxInstance.process({
        input: message,
        context
      });

      setLastResponse(response);
      setIsProcessing(false);
      return response;

    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
      return { ok: false, error: err.message };
    }
  }, [alxInstance, isProcessing]);

  const getMemory = useCallback((count) => {
    if (!alxInstance) return [];
    return alxInstance.getMemory?.(count) || [];
  }, [alxInstance]);

  const getStatus = useCallback(() => {
    if (!alxInstance) return null;
    return alxInstance.getStatus?.() || { state: "UNKNOWN" };
  }, [alxInstance]);

  return {
    isReady,
    isProcessing,
    lastResponse,
    sessionId,
    error,
    sendMessage,
    getMemory,
    getStatus
  };
}

export default useALX;