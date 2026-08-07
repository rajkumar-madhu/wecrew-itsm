import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '../lib/api';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useGlobalSearch(query: string, type: string = 'all') {
  const debouncedQuery = useDebounce(query, 300);
  return useQuery({
    queryKey: ['search', debouncedQuery, type],
    queryFn: async () => {
      const params = new URLSearchParams({ q: debouncedQuery });
      if (type !== 'all') params.append('type', type);
      const { data } = await api.get(`/search?${params}`);
      return data;
    },
    staleTime: 30000,
    enabled: debouncedQuery.length >= 2,
  });
}
