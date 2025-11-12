import { StackServerApp } from "@stackframe/stack";

// Only initialize if required env vars are present
const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const publishableClientKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY;
const secretServerKey = process.env.STACK_SECRET_SERVER_KEY;

export const stackServerApp = projectId && publishableClientKey && secretServerKey
  ? new StackServerApp({
      tokenStore: "nextjs-cookie",
      urls: {
        signIn: "/auth/signin",
        signUp: "/auth/signup",
        afterSignIn: "/",
        afterSignOut: "/",
      },
      projectId,
      publishableClientKey,
      secretServerKey,
    })
  : null;

