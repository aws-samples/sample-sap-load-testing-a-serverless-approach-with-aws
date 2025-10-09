import { useState, useEffect, useCallback } from 'react';
import { fetchTests } from '../utils/load-test-utils';
import LoadTest from '../types/LoadTest';

export const useLoadTests = (accessToken: string, pageSize: string) => {
  const [tests, setTests] = useState<LoadTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTests = useCallback(async () => {
    if (!accessToken) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedTests = await fetchTests(accessToken, pageSize);
      setTests(fetchedTests || []);
    } catch (err) {
      console.error('Error fetching tests:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tests');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, pageSize]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  return {
    tests,
    isLoading,
    error,
    refetch: loadTests,
  };
};
