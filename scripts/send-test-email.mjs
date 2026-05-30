import "dotenv/config";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "noreply@mail.joinayni.com";
const to = process.argv[2];

if (!apiKey) {
  console.error("RESEND_API_KEY is missing");
  process.exit(1);
}

if (!to) {
  console.error("Usage: node scripts/send-test-email.mjs <email>");
  process.exit(1);
}

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "Test Ayni",
  text: "Ceci est un email de test depuis le backend Ayni (Resend + mail.joinayni.com).",
  html: "<p>Ceci est un email de test depuis le backend Ayni (<strong>mail.joinayni.com</strong>).</p>",
  tags: [{ name: "category", value: "transactional" }],
});

if (error) {
  console.error("Send failed:", error);
  process.exit(1);
}

console.log("Sent:", data);
