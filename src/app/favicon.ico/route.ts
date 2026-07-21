import companyLogo from "@/lib/logo.png.png";

export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: companyLogo.src }
  });
}
