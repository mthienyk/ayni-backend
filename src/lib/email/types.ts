export type EmailCategory = "auth" | "transactional" | "support";

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  category: EmailCategory;
  tags?: EmailTag[];
}

export interface EmailSendResult {
  id: string | null;
  devMode: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}
