import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type CookieItem = { name: string; value: string; options?: Record<string, unknown> }

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet: CookieItem[]) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request: req })
            cookiesToSet.forEach(({ name, value, options }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              supabaseResponse.cookies.set(name, value, options as any)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const isLoginPage = req.nextUrl.pathname === '/login'

    if (!user && !isLoginPage) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    if (user && isLoginPage) {
      return NextResponse.redirect(new URL('/projects', req.url))
    }
  } catch {
    // Supabase 初始化或 auth 失败时，放行请求不做重定向
    // 页面本身会处理未登录状态
    return NextResponse.next({ request: req })
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
