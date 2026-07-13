import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type FlashMessage = {
  kind: "success" | "error";
  message: string;
};

const FLASH_COOKIE = "reagent_flash";
const FLASH_MAX_AGE_SECONDS = 120;
const MAX_MESSAGE_LENGTH = 300;

function isProductionEnvironment() {
  return [process.env.NODE_ENV, process.env.APP_ENV, process.env.VERCEL_ENV]
    .some((value) => value?.trim().toLowerCase() === "production");
}

export async function setFlashMessage(kind: FlashMessage["kind"], message: string) {
  const normalized = message.trim().slice(0, MAX_MESSAGE_LENGTH);
  const value = Buffer.from(JSON.stringify({ kind, message: normalized }), "utf8")
    .toString("base64url");
  const cookieStore = await cookies();

  cookieStore.set(FLASH_COOKIE, value, {
    httpOnly: true,
    maxAge: FLASH_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: isProductionEnvironment(),
    path: "/"
  });
}

export async function getFlashMessage(): Promise<FlashMessage | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(FLASH_COOKIE)?.value;
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<FlashMessage>;
    if (
      (parsed.kind !== "success" && parsed.kind !== "error") ||
      typeof parsed.message !== "string" ||
      !parsed.message ||
      parsed.message.length > MAX_MESSAGE_LENGTH
    ) return null;

    return { kind: parsed.kind, message: parsed.message };
  } catch {
    return null;
  }
}

export async function clearFlashMessage() {
  const cookieStore = await cookies();
  cookieStore.delete(FLASH_COOKIE);
}

export async function redirectWithFlash(
  path: string,
  kind: FlashMessage["kind"],
  message: string
): Promise<never> {
  await setFlashMessage(kind, message);
  redirect(path as never);
}
