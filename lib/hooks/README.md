# User Hooks

## useUser

Hook to fetch current user data with subscription status using React Query.

### Usage

```tsx
import { useUser } from '@/lib/hooks/use-user'

function MyComponent() {
  const { user, isLoading, isSignedIn, isSubscribed, error, refetch } = useUser()

  if (isLoading) return <div>Loading...</div>
  if (!isSignedIn) return <div>Please sign in</div>
  if (error) return <div>Error loading user</div>

  return (
    <div>
      <p>Email: {user?.email}</p>
      <p>Subscription: {isSubscribed ? 'Active' : 'Inactive'}</p>
    </div>
  )
}
```

### Returns

- `user`: User object from database (includes subscription status)
- `isLoading`: Loading state
- `isSignedIn`: Whether there is a sign-in session (Better Auth)
- `isSubscribed`: Shortcut for `user?.subscribed ?? false`
- `error`: Error object if fetch failed
- `refetch`: Function to manually refetch user data

## useUpdateUser

Hook to update user data.

### Usage

```tsx
import { useUpdateUser } from '@/lib/hooks/use-user'

function UpdateEmailForm() {
  const { mutate, isPending } = useUpdateUser()

  const handleSubmit = (email: string) => {
    mutate({ email })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```
