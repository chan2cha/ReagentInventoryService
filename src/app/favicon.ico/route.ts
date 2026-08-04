export function GET() {
  // public 자산은 빌드 시 import하지 않고 정적 URL로 리다이렉트한다.
  return new Response(null, {
    status: 307,
    headers: { Location: "/logo.png" }
  });
}
