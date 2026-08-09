'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function SignOutButton({ endpoint = '/api/auth/logout' }: { endpoint?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch(endpoint, { method: 'POST' });
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
