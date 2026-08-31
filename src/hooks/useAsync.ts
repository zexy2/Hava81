/**
 * useAsync Hook
 * Generic async operation handler with loading, error, and data states
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ErrorCode, LoadingState, type AppError } from '../types';
import { ApiError } from '../api/errors/ApiError';
import i18n from '../i18n';

interface AsyncState<T> {
  data: T | null;
  error: AppError | null;
  status: LoadingState;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isIdle: boolean;
}

interface UseAsyncReturn<T, Args extends unknown[]> extends AsyncState<T> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
  clearError: () => void;
  setData: (data: T | null) => void;
}

export function useAsync<T, Args extends unknown[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: {
    immediate?: boolean;
    immediateArgs?: Args;
    onSuccess?: (data: T) => void;
    onError?: (error: AppError) => void;
    preserveDataOnReload?: boolean;
  } = {}
): UseAsyncReturn<T, Args> {
  const {
    immediate = false,
    immediateArgs,
    onSuccess,
    onError,
    preserveDataOnReload = false,
  } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    status: LoadingState.IDLE,
    isLoading: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
  });

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  const lastCallIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      const callId = ++lastCallIdRef.current;

      setState(prev => ({
        data: preserveDataOnReload ? prev.data : null,
        error: null,
        status: LoadingState.LOADING,
        isLoading: true,
        isError: false,
        isSuccess: false,
        isIdle: false,
      }));

      try {
        const result = await asyncFunction(...args);

        // Only update state if this is the latest call and component is mounted
        if (mountedRef.current && callId === lastCallIdRef.current) {
          setState({
            data: result,
            error: null,
            status: LoadingState.SUCCESS,
            isLoading: false,
            isError: false,
            isSuccess: true,
            isIdle: false,
          });
          onSuccess?.(result);
        }

        return result;
      } catch (error) {
        const appError: AppError =
          error instanceof ApiError
            ? error.toJSON()
            : {
                code: ErrorCode.UNKNOWN,
                message: i18n.t('errors.genericError'),
                timestamp: new Date(),
                retryable: false,
              };

        if (mountedRef.current && callId === lastCallIdRef.current) {
          setState(prev => ({
            data: preserveDataOnReload ? prev.data : null,
            error: appError,
            status: LoadingState.ERROR,
            isLoading: false,
            isError: true,
            isSuccess: false,
            isIdle: false,
          }));
          onError?.(appError);
        }

        return null;
      }
    },
    [asyncFunction, onSuccess, onError, preserveDataOnReload]
  );

  const reset = useCallback(() => {
    // Reset is also a cancellation boundary for stale result delivery. The underlying
    // request may still finish, but it must no longer be allowed to repopulate state.
    lastCallIdRef.current += 1;
    setState({
      data: null,
      error: null,
      status: LoadingState.IDLE,
      isLoading: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      status: prev.data === null ? LoadingState.IDLE : LoadingState.SUCCESS,
      isError: false,
      isSuccess: prev.data !== null,
      isIdle: prev.data === null,
    }));
  }, []);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({
      ...prev,
      data,
      error: null,
      status: data === null ? LoadingState.IDLE : LoadingState.SUCCESS,
      isLoading: false,
      isError: false,
      isSuccess: data !== null,
      isIdle: data === null,
    }));
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate && immediateArgs) {
      execute(...immediateArgs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return {
    ...state,
    execute,
    reset,
    clearError,
    setData,
  };
}

export default useAsync;
