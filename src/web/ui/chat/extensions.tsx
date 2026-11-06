import type { UserInputPart } from '@shared/domain';

// Hook point for the `/` and `@` menus (US3: SlashMenu, MentionMenu). Empty until US3.

export function ComposerExtensions(_props: {
  conversationId: string;
  text: string;
  setText(t: string): void;
  model: string | null;
  addPart(p: UserInputPart): void;
}) {
  return null;
}
