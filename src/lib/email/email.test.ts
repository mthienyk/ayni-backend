import { describe, expect, it } from "vitest";
import { buildMagicLinkEmail } from "./templates/auth.js";
import { buildNotificationEmail } from "./templates/notification.js";
import {
  buildSupportAckEmail,
  buildSupportRequestEmail,
} from "./templates/support.js";

describe("email templates", () => {
  it("builds magic link email", () => {
    const email = buildMagicLinkEmail({
      verifyUrl: "https://api.example.com/verify?token=abc",
      ttlMinutes: 15,
    });

    expect(email.subject).toBe("Connexion à Ayni");
    expect(email.text).toContain("https://api.example.com/verify?token=abc");
    expect(email.html).toContain("Se connecter");
  });

  it("builds notification email with optional action", () => {
    const email = buildNotificationEmail({
      title: "Nouveau match",
      body: "Quelqu'un a aimé ton objet.",
      actionUrl: "https://joinayni.com/matches/1",
      actionLabel: "Voir le match",
    });

    expect(email.subject).toBe("Nouveau match");
    expect(email.text).toContain("Quelqu'un a aimé ton objet.");
    expect(email.html).toContain("Voir le match");
  });

  it("builds support emails", () => {
    const request = buildSupportRequestEmail({
      userEmail: "user@example.com",
      subject: "Problème de connexion",
      message: "Je ne reçois pas le lien.",
    });
    const ack = buildSupportAckEmail({ subject: "Problème de connexion" });

    expect(request.subject).toContain("[Support Ayni]");
    expect(request.text).toContain("user@example.com");
    expect(ack.subject).toBe("Nous avons bien reçu ta demande");
  });
});
