import { z } from 'zod';

/**
 * Validierung des Kontaktformulars.
 * Dieselben Regeln gelten im Browser (schnelle Rückmeldung) und auf dem Server
 * (verbindliche Prüfung).
 */

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Bitte gib deinen Namen an (mindestens 2 Zeichen).')
    .max(100, 'Der Name darf höchstens 100 Zeichen lang sein.'),

  email: z
    .string()
    .trim()
    .min(1, 'Bitte gib deine E-Mail-Adresse an.')
    .max(160, 'Die E-Mail-Adresse ist zu lang.')
    .email('Bitte gib eine gültige E-Mail-Adresse an.'),

  organisation: z
    .string()
    .trim()
    .max(120, 'Der Name der Organisation darf höchstens 120 Zeichen lang sein.')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  category: z.string().trim().min(1, 'Bitte wähle eine Kategorie.').max(50),

  subject: z
    .string()
    .trim()
    .min(3, 'Bitte gib einen Betreff an (mindestens 3 Zeichen).')
    .max(150, 'Der Betreff darf höchstens 150 Zeichen lang sein.'),

  message: z
    .string()
    .trim()
    .min(20, 'Bitte beschreibe dein Anliegen etwas ausführlicher (mindestens 20 Zeichen).')
    .max(5000, 'Die Nachricht darf höchstens 5000 Zeichen lang sein.'),

  privacy: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .refine((value) => value === 'on' || value === 'true' || value === true, {
      message: 'Bitte bestätige die Datenschutzerklärung.',
    }),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export type ContactFormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  reference?: string;
  fieldErrors?: Partial<Record<keyof ContactFormValues | 'attachment' | 'captcha', string>>;
};

export const initialContactState: ContactFormState = { status: 'idle', message: '' };

/** Name des unsichtbaren Honeypot-Feldes. Wird von Bots häufig ausgefüllt. */
export const HONEYPOT_FIELD = 'website_url';
