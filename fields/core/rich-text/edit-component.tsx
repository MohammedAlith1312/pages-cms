"use client";

import { forwardRef, useCallback, useRef, useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { useConfig } from "@/contexts/config-context";
import { useRepo } from "@/contexts/repo-context";
import { getRawUrl, relativeToRawUrls } from "@/lib/githubImage";
import { MediaDialog, MediaDialogHandle } from "@/components/media/media-dialog";
import "./edit-component.css";
import Commands from './slash-command/commands';
import suggestion from './slash-command/suggestion';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsUpDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Strikethrough,
} from "lucide-react";
import { getSchemaByName } from "@/lib/schema";
import { extensionCategories, normalizePath } from "@/lib/utils/file";

const EditComponent = forwardRef((props: any, ref) => {
  const { config } = useConfig();
  const { isPrivate } = useRepo();
  const params = useParams();

  const { value, field, onChange } = props;

  const mediaConfig = useMemo(() => {
    return (config?.object?.media?.length && field.options?.media !== false)
      ? field.options?.media && typeof field.options.media === 'string'
        ? getSchemaByName(config.object, field.options.media, "media")
        : config.object.media[0]
      : undefined;
  }, [field.options?.media, config?.object]);

  const allowedExtensions = useMemo(() => {
    if (!mediaConfig) return [];
    let extensions = extensionCategories['image'];
    const fieldExtensions = field.options?.extensions
      ? field.options.extensions
      : field.options?.categories
        ? field.options.categories.flatMap((category: string) => extensionCategories[category])
        : [];
    if (fieldExtensions.length) {
      extensions = extensions.filter(ext => fieldExtensions.includes(ext));
    }
    if (mediaConfig.extensions) {
      extensions = extensions.filter(ext => mediaConfig.extensions.includes(ext));
    }
    return extensions;
  }, [field.options?.extensions, field.options?.categories, mediaConfig]);

  const mediaDialogRef = mediaConfig ? useRef<MediaDialogHandle>(null) : undefined;
  const bubbleMenuRef = useRef<HTMLDivElement | null>(null);
  const [isContentReady, setContentReady] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [selectionTick, setSelectionTick] = useState(0);

  const openMediaDialog = mediaConfig?.input
    ? () => { if (mediaDialogRef?.current) mediaDialogRef.current.open() }
    : undefined;

  const rootPath = useMemo(() => {
    if (!mediaConfig) return undefined;
    if (!field.options?.path) return mediaConfig?.input;
    const normalizedPath = normalizePath(field.options.path);
    const normalizedMediaPath = normalizePath(mediaConfig?.input);
    if (!normalizedPath.startsWith(normalizedMediaPath)) {
      console.warn(`"${field.options.path}" is not within media root "${mediaConfig?.input}". Defaulting to media root.`);
      return mediaConfig?.input;
    }
    return normalizedPath;
  }, [field.options?.path, mediaConfig?.input]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ dropcursor: { width: 2 } }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            class: { default: null },
            style: { default: null },
            width: { default: null },
            height: { default: null }
          };
        }
      }).configure({ inline: true }),
      Link.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            'data-issue-number': {
              default: null,
              parseHTML: element => element.getAttribute('data-issue-number'),
              renderHTML: attributes => attributes['data-issue-number'] ? { 'data-issue-number': attributes['data-issue-number'] } : {},
            },
            'data-issue-state': {
              default: 'open',
              parseHTML: element => element.getAttribute('data-issue-state'),
              renderHTML: attributes => attributes['data-issue-number'] ? { 'data-issue-state': attributes['data-issue-state'] || 'open' } : {},
            },
            'data-issue-title': {
              default: null,
              parseHTML: element => element.getAttribute('data-issue-title'),
              renderHTML: attributes => attributes['data-issue-number'] ? { 'data-issue-title': attributes['data-issue-title'] } : {},
            },
            class: {
              default: null,
              parseHTML: element => element.getAttribute('class'),
              renderHTML: attributes => {
                const isIssue = !!attributes['data-issue-number'];
                const classes = [attributes.class, isIssue ? 'gh-issue-link' : ''].filter(Boolean).join(' ');
                return classes ? { class: classes } : {};
              },
            },
          };
        },
        renderHTML({ HTMLAttributes }) {
          return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
        },
      }).configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: null }
      }),
      Placeholder.configure({ placeholder: "Type '/' for commands…" }),
      Commands.configure({ suggestion: suggestion(openMediaDialog) }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline
    ],
    content: "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onSelectionUpdate: () => setSelectionTick(t => t + 1),
    onCreate: async ({ editor }) => {
      if (config && value) {
        try {
          const initialContent = mediaConfig
            ? await relativeToRawUrls(config.owner, config.repo, config.branch, mediaConfig.name, value, isPrivate)
            : value;
          editor.commands.setContent(initialContent || "<p></p>");
        } catch (error) {
          console.warn(error);
          editor.commands.setContent(value);
        }
      }
      setContentReady(true);
    }
  });


  const handleMediaDialogSubmit = useCallback(async (images: string[]) => {
    if (!mediaConfig || !config || !editor) return;
    const content = await Promise.all(images.map(async (image) => {
      try {
        const url = await getRawUrl(config.owner, config.repo, config.branch, mediaConfig?.name, image, isPrivate);
        if (url) {
          const encodedImage = image.split('/').map(encodeURIComponent).join('/');
          const encodedUrl = url.replace(image, encodedImage);
          return `<p><img src="${encodedUrl}"></p>`;
        }
        return `<p><img src="" alt="${image}" /></p>`;
      } catch {
        return `<p><img src="" alt="${image}" /></p>`;
      }
    }));
    editor.chain().focus().insertContent(content.join('\n')).run();
  }, [config, editor, isPrivate, mediaConfig]);

  const getBlockIcon = (editor: any) => {
    if (editor.isActive("heading", { level: 1 })) return <Heading1 className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 2 })) return <Heading2 className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 3 })) return <Heading3 className="h-4 w-4" />;
    if (editor.isActive("bulletList")) return <List className="h-4 w-4" />;
    if (editor.isActive("orderedList")) return <ListOrdered className="h-4 w-4" />;
    return <Pilcrow className="h-4 w-4" />;
  };


  const renderedBubbleMenu = useMemo(() => {
    if (!editor) return null;

    return (
      <BubbleMenu editor={editor} tippyOptions={{ duration: 25, animation: "scale", maxWidth: "450px" }}>
        <div className="flex flex-row rounded-xl bg-popover border border-border/50 shadow-2xl backdrop-blur-md overflow-hidden p-1.5 gap-x-1 items-center bg-muted/30" ref={bubbleMenuRef}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="xxs" className="gap-x-1 hover:bg-muted/50 text-xs py-1">
                {getBlockIcon(editor)}
                <ChevronsUpDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" portalProps={{ container: bubbleMenuRef.current }}>
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className="gap-x-1.5 text-xs"><Pilcrow className="h-3 w-3" /> Text</DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 1 }).run()} className="gap-x-1.5 text-xs"><Heading1 className="h-3 w-3" /> Heading 1</DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 2 }).run()} className="gap-x-1.5 text-xs"><Heading2 className="h-3 w-3" /> Heading 2</DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 3 }).run()} className="gap-x-1.5 text-xs"><Heading3 className="h-3 w-3" /> Heading 3</DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()} className="gap-x-1.5 text-xs"><List className="h-3 w-3" /> Bullet list</DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()} className="gap-x-1.5 text-xs"><ListOrdered className="h-3 w-3" /> Numbered list</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-[1px] h-4 bg-border/40 mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xxs" className={cn("shrink-0 hover:bg-muted/50", editor.isActive("link") ? "bg-muted text-primary" : "")} onClick={() => setLinkUrl(editor.isActive("link") ? editor.getAttributes('link').href : "")}><Link2 className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="p-1 w-64 border-border/50 shadow-xl" sideOffset={8}>
              <div className="flex gap-x-1 items-center">
                <Input
                  className="h-8 flex-1 text-sm bg-muted/20 border-border/40"
                  placeholder="URL (e.g. google.com)"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { if (linkUrl) { editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run(); } else { editor.chain().focus().extendMarkRange('link').unsetLink().run(); } } }}
                />
                <Button type="button" variant="ghost" size="xxs" className="shrink-0 hover:bg-primary hover:text-primary-foreground" onClick={() => linkUrl ? editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run() : editor.chain().focus().extendMarkRange('link').unsetLink().run()}>Link</Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="ghost" size="icon-xxs" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("shrink-0 hover:bg-muted/50", editor.isActive("bold") ? "bg-muted text-primary px-1.5" : "")}><Bold className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon-xxs" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("shrink-0 hover:bg-muted/50", editor.isActive("italic") ? "bg-muted text-primary" : "")}><Italic className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon-xxs" onClick={() => editor.chain().focus().toggleStrike().run()} className={cn("shrink-0 hover:bg-muted/50", editor.isActive("strike") ? "bg-muted text-primary" : "")}><Strikethrough className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon-xxs" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="shrink-0 hover:bg-muted/50 text-muted-foreground"><RemoveFormatting className="h-4 w-4" /></Button>
        </div>
      </BubbleMenu>
    );
  }, [editor, linkUrl, selectionTick]);

  return (
    <>
      <Skeleton className={cn("rounded-md h-[8.5rem]", isContentReady ? "hidden" : "")} />
      <div className={!isContentReady ? "hidden" : ""}>
        {renderedBubbleMenu}
        <EditorContent editor={editor} />
        {mediaConfig && (
          <MediaDialog
            ref={mediaDialogRef}
            media={mediaConfig?.name}
            initialPath={rootPath}
            extensions={allowedExtensions}
            selected={[]}
            onSubmit={handleMediaDialogSubmit}
          />
        )}
      </div>
    </>
  );
});


EditComponent.displayName = "EditComponent";

export { EditComponent };