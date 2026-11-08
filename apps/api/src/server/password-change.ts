import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

const CODE_LENGTH = 6;

export function createPasswordChangeCode(userId: string) {
  const code = randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, "0");

  return {
    code,
    codeHash: hashPasswordChangeCode(userId, code),
  };
}

export function hashPasswordChangeCode(userId: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET must be configured to protect password codes.");
  }

  return createHmac("sha256", secret)
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function passwordChangeCodeMatches(
  userId: string,
  code: string,
  expectedHash: string
) {
  const actual = Buffer.from(hashPasswordChangeCode(userId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function sendPasswordChangeCodeEmail(
  email: string,
  code: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Código para cambiar tu contraseña de DevBattle",
      text: `Tu código para cambiar la contraseña es ${code}. Expira en 10 minutos. Si no solicitaste este cambio, ignora este correo.`,
    }),
  });

  if (!response.ok) {
    const responseDetails = await response.text();
    console.error(
      `Resend rejected password-change email (${response.status}): ${responseDetails}`
    );
    throw new Error("El proveedor de correo no pudo enviar el mensaje.");
  }
}
