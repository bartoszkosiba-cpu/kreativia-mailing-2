// Placeholder klienta Gmail: tylko interfejsy i szkielety metod

export type GmailSendParams = {
  to: string;
  subject: string;
  html: string;
  label?: string;
};

export async function sendEmailViaGmail(_params: GmailSendParams) {
  // TODO: implementacja w kolejnych etapach
  throw new Error("Gmail not implemented (skeleton)");
}

export async function ensureLabelExists(_label: string) {
  // TODO: sprawdzenie/utworzenie etykiety
  return { id: "placeholder-label-id" };
}

export async function pollReplies(_label: string) {
  // TODO: polling odpowiedzi dla danej etykiety
  return [] as Array<{ threadId: string; snippet: string }>;
}



