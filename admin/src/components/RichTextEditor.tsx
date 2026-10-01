import { useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
  Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2,
  Strikethrough, Underline as UnderlineIcon, Undo2, Youtube as YoutubeIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { mediaUrl, uploadFile } from '../lib/storage';
import { useToast } from './Toast';
import { Modal, Spinner, TextInput } from './ui';
import Button from './Button';

function ToolbarButton({ icon: Icon, label, active, disabled, onClick }: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`p-2 rounded-md transition-colors disabled:opacity-40 ${active ? 'bg-brand-blue/10 text-brand-blue' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

const Divider = () => <span className="mx-1 w-px self-stretch bg-slate-200" />;

type Prompt = { kind: 'link'; value: string } | { kind: 'youtube'; value: string } | null;

function Toolbar({ editor, folder }: { editor: Editor; folder: string }) {
  const notify = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const insertImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadFile('blog', file, folder);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      editor.chain().focus().setImage({ src: mediaUrl('blog', path)!, alt }).run();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyPrompt = () => {
    if (!prompt) return;
    const value = prompt.value.trim();
    if (prompt.kind === 'link') {
      if (!value) editor.chain().focus().extendMarkRange('link').unsetLink().run();
      else {
        const href = /^(https?:\/\/|mailto:|tel:|\/)/.test(value) ? value : `https://${value}`;
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
      }
    } else if (value) {
      const ok = editor.commands.setYoutubeVideo({ src: value });
      if (!ok) return notify('That does not look like a YouTube link.', 'error');
    }
    setPrompt(null);
  };

  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white/95 backdrop-blur px-2 py-1.5 rounded-t-lg">
      <ToolbarButton icon={Heading2} label="Heading" active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton icon={Heading3} label="Subheading" active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Divider />
      <ToolbarButton icon={Bold} label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolbarButton icon={Italic} label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolbarButton icon={UnderlineIcon} label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolbarButton icon={Strikethrough} label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <Divider />
      <ToolbarButton icon={List} label="Bullet list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolbarButton icon={ListOrdered} label="Numbered list" active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolbarButton icon={Quote} label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolbarButton icon={Minus} label="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <Divider />
      <ToolbarButton
        icon={Link2}
        label="Link"
        active={state.link}
        onClick={() => setPrompt({ kind: 'link', value: editor.getAttributes('link').href ?? '' })}
      />
      <ToolbarButton icon={ImagePlus} label="Insert image" disabled={uploading} onClick={() => fileRef.current?.click()} />
      <ToolbarButton icon={YoutubeIcon} label="Embed YouTube video" onClick={() => setPrompt({ kind: 'youtube', value: '' })} />
      <Divider />
      <ToolbarButton icon={Undo2} label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <ToolbarButton icon={Redo2} label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />
      {uploading && <span className="ml-2 inline-flex items-center gap-2 text-xs text-slate-500"><Spinner className="w-3.5 h-3.5" /> Uploading image…</span>}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => insertImage(e.target.files?.[0])} />

      <Modal
        open={prompt !== null}
        onClose={() => setPrompt(null)}
        title={prompt?.kind === 'youtube' ? 'Embed YouTube video' : 'Add link'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPrompt(null)}>Cancel</Button>
            <Button onClick={applyPrompt}>{prompt?.kind === 'link' && !prompt.value.trim() ? 'Remove link' : 'Apply'}</Button>
          </>
        }
      >
        <form onSubmit={e => { e.preventDefault(); applyPrompt(); }}>
          <TextInput
            autoFocus
            value={prompt?.value ?? ''}
            onChange={e => setPrompt(p => (p ? { ...p, value: e.target.value } : p))}
            placeholder={prompt?.kind === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://example.com'}
          />
          {prompt?.kind === 'link' && <p className="mt-2 text-xs text-slate-500">Leave empty to remove the link.</p>}
        </form>
      </Modal>
    </div>
  );
}

export default function RichTextEditor({ value, onChange, folder, editable = true }: {
  value: string;
  onChange: (html: string) => void;
  /** Storage folder for images inserted into the content */
  folder: string;
  editable?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      Youtube.configure({ nocookie: true, width: 640, height: 360, HTMLAttributes: { class: 'video-embed' } }),
      Placeholder.configure({ placeholder: 'Start writing your post…' }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    editorProps: {
      attributes: { class: 'rte-content min-h-80 px-4 py-4 focus:outline-none' },
    },
  });

  return (
    <div className="rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-brand-cyan/40 focus-within:border-brand-cyan">
      {editor && editable && <Toolbar editor={editor} folder={folder} />}
      <EditorContent editor={editor} />
    </div>
  );
}
