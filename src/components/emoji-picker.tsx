'use client';

import { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Business',
    emojis: ['💼', '📊', '📈', '📉', '💰', '💳', '🏦', '🧾', '📋', '📑', '🗂️', '📁', '🗃️', '💵', '💶', '🪙', '🏷️', '🎯', '🏪', '🧮'],
  },
  {
    label: 'Tech',
    emojis: ['💻', '🖥️', '📱', '⌨️', '🖱️', '💾', '🔌', '🤖', '🧠', '⚙️', '🔧', '🛠️', '🔬', '🧪', '📡', '🌐', '🔗', '🧩', '🎮', '📟'],
  },
  {
    label: 'Creative',
    emojis: ['🎨', '✏️', '📝', '🖊️', '🖌️', '📐', '📏', '🎬', '📸', '🎵', '🎤', '📰', '📚', '📖', '✍️', '💡', '🪄', '🎭', '🖼️', '🎧'],
  },
  {
    label: 'Nature',
    emojis: ['🌱', '🌿', '🍃', '🌳', '🌻', '🌾', '🍀', '🌊', '🔥', '⚡', '❄️', '☀️', '🌙', '⭐', '🌈', '🌸', '🍄', '🪴', '🌵', '🦋'],
  },
  {
    label: 'Animals',
    emojis: ['🐐', '🦊', '🐺', '🦁', '🐻', '🦅', '🐝', '🐙', '🦑', '🐬', '🦈', '🐢', '🐍', '🦎', '🐸', '🐞', '🦀', '🐈', '🐕', '🦉'],
  },
  {
    label: 'Transport',
    emojis: ['🚀', '✈️', '🚁', '🚂', '🚛', '🚗', '🏎️', '🛳️', '⛵', '🚲', '🛵', '🏗️', '🏠', '🏢', '🏭', '🏰', '⛪', '🗼', '🌉', '🛣️'],
  },
  {
    label: 'Food',
    emojis: ['☕', '🍕', '🍔', '🍣', '🍰', '🍷', '🍺', '🧁', '🌮', '🥗', '🍲', '🧀', '🥐', '🍩', '🫖', '🥂', '🍽️', '🧊', '🍿', '🥡'],
  },
  {
    label: 'Symbols',
    emojis: ['✅', '❌', '⚠️', '🔴', '🟢', '🔵', '🟡', '🟣', '⬛', '🔶', '💎', '🏆', '🥇', '🎖️', '🛡️', '⚔️', '🔑', '🔒', '❤️', '💯'],
  },
  {
    label: 'Flags',
    emojis: ['🇷🇴', '🇬🇪', '🇺🇸', '🇬🇧', '🇩🇪', '🇫🇷', '🇪🇸', '🇮🇹', '🇯🇵', '🇰🇷', '🇧🇷', '🇨🇦', '🇦🇺', '🇮🇳', '🇳🇱', '🇵🇹', '🇸🇪', '🇨🇭', '🇵🇱', '🏴‍☠️'],
  },
];

interface EmojiPickerProps {
  selected: string;
  onSelect: (emoji: string) => void;
  allowImage?: boolean;
}

export function EmojiPicker({ selected, onSelect, allowImage = true }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].label);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const category = EMOJI_CATEGORIES.find(c => c.label === activeCategory) || EMOJI_CATEGORIES[0];

  const isImageSelected = selected.includes('/') || selected.includes('.');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('directory', '_uploads/icons');
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      onSelect(data.path);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {/* Category tabs + upload button */}
      <div className="flex flex-wrap gap-1 items-center">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveCategory(cat.label)}
            className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
              activeCategory === cat.label
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
        {allowImage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-2 py-0.5 text-xs rounded-md transition-colors bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Image
            </button>
          </>
        )}
      </div>

      {/* Current image preview */}
      {isImageSelected && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
          <img
            src={`/api/files?path=${encodeURIComponent(selected)}`}
            alt="Current icon"
            className="h-8 w-8 rounded-sm object-cover"
          />
          <span className="text-xs text-muted-foreground flex-1">Custom image selected</span>
        </div>
      )}

      {/* Emoji grid */}
      <div className="flex flex-wrap gap-1.5">
        {category.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className={`w-9 h-9 text-lg rounded-md border-2 transition-colors flex items-center justify-center ${
              selected === emoji
                ? 'border-primary bg-primary/10'
                : 'border-transparent hover:bg-muted'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
