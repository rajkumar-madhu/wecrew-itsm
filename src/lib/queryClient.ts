import { QueryClient, MutationCache } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (error: any, _variables, _context, mutation) => {
      // Only show default toast if the mutation doesn't have its own onError
      if (!mutation.options.onError) {
        const msg = error?.response?.data?.error || error?.message || 'Something went wrong';
        toast.error(msg);
      }
    },
  }),
});
