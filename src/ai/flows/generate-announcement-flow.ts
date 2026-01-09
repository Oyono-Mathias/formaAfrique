
'use server';

/**
 * @fileOverview Implements a Genkit flow to assist admins with marketing announcements.
 *
 * - generateAnnouncement - The main function to generate a marketing message.
 * - GenerateAnnouncementInput - Input type for the function.
 * - GenerateAnnouncementOutput - Output type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const GenerateAnnouncementInputSchema = z.object({
  topic: z.string().describe('The topic or existing text of the announcement message. For example: "a flash sale for the weekend", "a new course about AI", or an existing message to be improved.'),
});
export type GenerateAnnouncementInput = z.infer<typeof GenerateAnnouncementInputSchema>;

export const GenerateAnnouncementOutputSchema = z.object({
  announcement: z.string().describe('The generated marketing announcement message, tailored for a pan-african audience. It should be engaging, professional, and concise. It MUST be in French and should also include a creative and culturally relevant translation in Sango and Lingala at the end, like: "Sango: ... - Lingala: ..."'),
});
export type GenerateAnnouncementOutput = z.infer<typeof GenerateAnnouncementOutputSchema>;

export async function generateAnnouncement(input: GenerateAnnouncementInput): Promise<GenerateAnnouncementOutput> {
  return generateAnnouncementFlow(input);
}

const generateAnnouncementPrompt = ai.definePrompt({
  name: 'generateAnnouncementPrompt',
  input: { schema: GenerateAnnouncementInputSchema },
  output: { schema: GenerateAnnouncementOutputSchema },
  prompt: `You are a marketing expert for FormaAfrique, an online learning platform for French-speaking Africa.
  Your task is to take a given topic or an existing announcement text and rewrite it to be a short, engaging, and professional marketing message.
  This message will be displayed in a banner on top of the website.
  The tone should be exciting and create a sense of urgency or opportunity.
  You MUST respond in French.

  After crafting the main French message, you MUST also provide a creative, culturally relevant, and brief translation of the core message in Sango and Lingala.
  Format the end of your response exactly like this:
  "Sango: [Your Sango translation] - Lingala: [Your Lingala translation]"

  Topic / Text to improve: {{{topic}}}

  Generate the improved announcement message.`,
});

const generateAnnouncementFlow = ai.defineFlow(
  {
    name: 'generateAnnouncementFlow',
    inputSchema: GenerateAnnouncementInputSchema,
    outputSchema: GenerateAnnouncementOutputSchema,
  },
  async (input) => {
    const { output } = await generateAnnouncementPrompt(input);
    return output!;
  }
);
