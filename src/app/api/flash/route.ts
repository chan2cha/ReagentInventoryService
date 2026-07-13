import { clearFlashMessage } from "@/lib/flash-message";

export async function DELETE() {
  await clearFlashMessage();
  return new Response(null, { status: 204 });
}
