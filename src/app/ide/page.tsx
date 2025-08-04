'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CodeNestLayout from '@/components/CodeNestLayout';

export default function IDEPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const auth = localStorage.getItem('codenest-auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    } else {
      router.push('/login');
      return;
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
          <span className="text-muted-foreground">Loading CodeNest...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return <CodeNestLayout />;
}