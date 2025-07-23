import React from 'react';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  className?: string;
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚'],
  'Gestures': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  'Objects': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '⭐', '🌟', '💫', '⚡', '🔥', '💯', '👑', '🎯', '🎪', '🎭', '🎨', '🎬'],
};

export function EmojiPicker({ onEmojiSelect, className }: EmojiPickerProps) {
  return (
    <div className={cn('w-64 bg-popover border rounded-lg shadow-lg p-4', className)}>
      <div className="space-y-3">
        {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
          <div key={category}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{category}</h4>
            <div className="grid grid-cols-6 gap-1">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onEmojiSelect(emoji)}
                  className="w-8 h-8 text-lg hover:bg-muted rounded transition-colors flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
