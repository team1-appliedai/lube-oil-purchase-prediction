# Node.js to Next.js Conversion Guide

## Current Environment Details

### Tech Stack
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Package Manager**: npm or pnpm (typically pnpm in modern setups)

### File Structure Expected

```
your-app/
├── app/
│   ├── layout.tsx          # Root layout (already configured)
│   ├── page.tsx            # Main page (home route)
│   ├── globals.css         # Global styles with Tailwind
│   ├── api/                # API routes (if needed)
│   │   └── your-endpoint/
│   │       └── route.ts    # API endpoint
│   └── [other-routes]/     # Additional pages
│       └── page.tsx
├── components/
│   ├── ui/                 # shadcn/ui components (pre-installed)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   └── custom-component.tsx # Your custom components
├── lib/
│   └── utils.ts            # Utility functions
├── public/                 # Static assets (images, fonts, etc.)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── .env.local             # Environment variables
```

---

## Conversion Prompt Template

Use this prompt in your Node.js Claude Code instance:

```
Please convert my existing Node.js application to a Next.js 16+ App Router structure with the following specifications:

TARGET ENVIRONMENT:
- Framework: Next.js 16+ with App Router (NOT Pages Router)
- Language: TypeScript
- Styling: Tailwind CSS
- UI Library: shadcn/ui components available at @/components/ui/*
- Runtime: React 18+ Server Components by default

FILE STRUCTURE REQUIREMENTS:
1. app/page.tsx - Main homepage component (use "use client" directive only if needed for interactivity)
2. app/layout.tsx - Root layout (should already exist, don't modify unless necessary)
3. components/ - Extract reusable components here
4. components/ui/ - shadcn/ui components are already available (button, card, input, etc.)
5. lib/ - Utility functions, helpers, types
6. app/api/ - Convert any backend routes to Next.js API routes using route.ts files
7. public/ - Static assets

CONVERSION REQUIREMENTS:
- Convert all .js files to .tsx or .ts files
- Use TypeScript with proper typing
- Use functional React components with hooks
- Server Components by default; add "use client" only when necessary (useState, useEffect, event handlers, browser APIs)
- Convert Express/backend routes to Next.js API routes (app/api/*/route.ts)
- Use Tailwind CSS classes instead of inline styles or CSS modules
- Replace any UI libraries with shadcn/ui components where possible
- Use async/await for data fetching in Server Components
- Environment variables should use NEXT_PUBLIC_ prefix for client-side access

API ROUTES FORMAT:
If I have backend endpoints, convert them to:
app/api/[endpoint-name]/route.ts with exports:
- export async function GET(request: Request) {}
- export async function POST(request: Request) {}
- etc.

PACKAGE.JSON:
Update package.json to include only necessary dependencies:
- Remove Express, Koa, or other server frameworks
- Keep business logic libraries
- Add Next.js compatible versions of any packages
- Note any packages that won't work in Next.js

SPECIFIC CONVERSIONS NEEDED:
- Database connections: Use in API routes or server components
- Authentication: Convert to Next.js middleware or API routes
- File uploads: Use Next.js API routes with formidable or similar
- WebSockets: Note these need special handling (explain how)
- Sessions: Convert to Next.js compatible session management

OUTPUT STRUCTURE:
Please provide:
1. Complete file structure with all file paths
2. Full content of each file
3. Updated package.json with correct dependencies and versions
4. Any environment variables needed in .env.local format
5. Installation instructions
6. Notes on any features that need special handling in Next.js

AVAILABLE SHADCN/UI COMPONENTS:
button, card, input, label, select, textarea, dialog, dropdown-menu,
popover, tooltip, alert, badge, checkbox, radio-group, switch, tabs,
accordion, avatar, separator, skeleton, toast, and more.

Please start the conversion now.
```

---

## Key Differences to Understand

### 1. Server vs Client Components

**Server Component (default) - NO "use client"**
```tsx
// app/page.tsx
export default async function Page() {
  const data = await fetch('https://api.example.com/data')
  return <div>{/* render data */}</div>
}
```

**Client Component - needs "use client"**
```tsx
// components/interactive-form.tsx
"use client"
import { useState } from 'react'

export default function InteractiveForm() {
  const [value, setValue] = useState('')
  return <input value={value} onChange={(e) => setValue(e.target.value)} />
}
```

### 2. API Routes

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const users = await fetchUsers()
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await createUser(body)
  return NextResponse.json(user)
}
```

### 3. Package.json Dependencies

```json
{
  "name": "your-app-name",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.0.0"
  }
}
```

---

## What Won't Work & Alternatives

| Node.js Pattern | Next.js Alternative |
|----------------|---------------------|
| Express middleware | Next.js middleware.ts or API route logic |
| app.listen() | Not needed (Next.js handles server) |
| res.send() | NextResponse.json() or return JSX |
| EJS/Pug templates | React components |
| body-parser | request.json() built-in |
| CORS middleware | headers in next.config.js |
| Sessions (express-session) | next-auth or custom JWT |
| Socket.io | Needs custom server or Pusher/Ably |

---

## Quick Checklist Before Conversion

- [ ] All files are .tsx or .ts (not .js or .jsx)
- [ ] Client components have "use client" directive
- [ ] API routes use app/api/*/route.ts format
- [ ] No Express/Koa server code
- [ ] Tailwind classes used for styling
- [ ] TypeScript types added
- [ ] Environment variables noted

---

## After Conversion - Next Steps

Once you have the converted files, provide:

1. **Brief description of your app**
2. **Key files**: page.tsx, any API routes, main components
3. **Dependencies**: Any special packages you need
4. **Environment variables**: API keys, database URLs, etc.

The Next.js environment will:
- Review the structure
- Fix any compatibility issues
- Add the files to the environment
- Test and refine
- Update package.json name to match your app

---

## Common Patterns Reference

### Data Fetching in Server Components
```tsx
// app/page.tsx
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store' // or 'force-cache' for static
  })
  return res.json()
}

export default async function Page() {
  const data = await getData()
  return <div>{data.title}</div>
}
```

### Forms with Server Actions
```tsx
// app/page.tsx
async function submitForm(formData: FormData) {
  'use server'
  const name = formData.get('name')
  // Process form
}

export default function Page() {
  return (
    <form action={submitForm}>
      <input name="name" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

### Environment Variables
```bash
# .env.local
DATABASE_URL=postgresql://...           # Server-side only
NEXT_PUBLIC_API_URL=https://api.com     # Client-side accessible
```

```tsx
// Usage
const dbUrl = process.env.DATABASE_URL              // Server only
const apiUrl = process.env.NEXT_PUBLIC_API_URL      // Client & Server
```

### Dynamic Routes
```
app/
├── blog/
│   └── [slug]/
│       └── page.tsx    # Accessible at /blog/my-post
```

```tsx
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <div>Post: {params.slug}</div>
}
```

---

## Need Help?

If you encounter issues during conversion:

1. **TypeScript errors**: Check that all types are properly defined
2. **"use client" errors**: Add directive to components using hooks or browser APIs
3. **API route issues**: Ensure using NextResponse and proper HTTP methods
4. **Styling issues**: Verify Tailwind classes are correct
5. **Import errors**: Check path aliases (@/* for absolute imports)

Good luck with your conversion! 🚀
