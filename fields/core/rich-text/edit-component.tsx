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
  Send,
  Loader2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
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
  const [inlinePrompt, setInlinePrompt] = useState("");
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
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

  const syncIssueStatuses = useCallback(async () => {
    if (!editor || !config) return;

    const issueRegex = new RegExp(`https:\\/\\/github\\.com\\/${config.owner}\\/${config.repo}\\/issues\\/(\\d+)`, 'i');
    const issueNumbers: string[] = [];

    editor.state.doc.descendants((node) => {
      node.marks.forEach(mark => {
        if (mark.type.name === 'link') {
          let num = mark.attrs['data-issue-number'];
          if (!num && mark.attrs.href) {
            const match = mark.attrs.href.match(issueRegex);
            if (match) num = match[1];
          }
          if (num && !issueNumbers.includes(num)) issueNumbers.push(num);
        }
      });
    });

    if (issueNumbers.length === 0) return;

    try {
      const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/github-issues?numbers=${issueNumbers.join(',')}&t=${Date.now()}`, { cache: "no-store" });
      const data = await response.json();

      if (data.status === 'success' && Array.isArray(data.data)) {
        const issueMap = new Map<string, any>(data.data.map((issue: any) => [issue.number.toString(), issue]));
        let saveNeeded = false;
        editor.commands.command(({ tr }) => {
          let modified = false;
          tr.doc.descendants((node, pos) => {
            const linkMark = node.marks.find(m => m.type.name === 'link');
            if (linkMark) {
              const currentAttrs = linkMark.attrs;
              let issueNumber = currentAttrs['data-issue-number'];
              if (!issueNumber && currentAttrs.href) {
                const match = currentAttrs.href.match(issueRegex);
                if (match) issueNumber = match[1];
              }
              if (issueNumber) {
                const issue = issueMap.get(issueNumber);
                if (issue) {
                  const newState = (issue as any).state;
                  const newTitle = (issue as any).title;
                  if (currentAttrs['data-issue-state'] !== newState || !currentAttrs['class']?.includes('gh-issue-link')) {
                    tr.addMark(pos, pos + node.nodeSize, editor.schema.marks.link.create({
                      ...currentAttrs,
                      'data-issue-number': issueNumber,
                      'data-issue-state': newState,
                      'data-issue-title': newTitle || currentAttrs['data-issue-title'],
                      class: 'gh-issue-link'
                    }));
                    modified = true;
                    saveNeeded = true;
                  }
                }
              }
            }
          });
          return modified;
        });
        if (saveNeeded) onChange(editor.getHTML());
      }
    } catch (error) {
      console.error('Failed to sync issue statuses:', error);
    }
  }, [editor, config, onChange]);

  useEffect(() => {
    if (editor && editor.isEditable && isContentReady) syncIssueStatuses();
  }, [editor?.isEditable, editor, isContentReady, syncIssueStatuses]);

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

  const handleIssueAction = async (action: 'create' | 'update' | 'close' | 'reopen', title?: string, description?: string) => {
    if (!editor || !config) return;
    const selection = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, "\n");
    const pagePath = params.path ? decodeURIComponent(params.path as string) : '';
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';


    if (action === 'create') {
      // Split the prompt by newline to separate Title and Description
      const lines = description?.split('\n').map(l => l.trim()).filter(Boolean) || [];
      const finalTitle = title || lines[0] || (selectedText ? (selectedText.length > 60 ? selectedText.slice(0, 60) + "..." : selectedText) : "New Issue");
      const finalDescription = lines.length > 1 ? lines.slice(1).join('\n') : "No additional description provided.";

      const fullBody = `${finalDescription}\n\n---\n**Context:**\n- **Selected Text:** \`${selectedText || 'None'}\`\n- **File:** \`${pagePath}\`\n- **Editor:** [Link](${pageUrl})`;
      setIsCreatingIssue(true);
      try {
        const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/github-issues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle, body: fullBody }),
        });
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || "Failed to create issue");
        toast.success("Issue created successfully");
        const issue = data.data;
        editor.chain().focus().setLink({
          href: issue.html_url,
          'data-issue-number': issue.number.toString(),
          'data-issue-state': 'open',
          'data-issue-title': issue.title,
          class: 'gh-issue-link'
        } as any).run();
      } catch (err: any) {
        toast.error(err.message);
      } finally { setIsCreatingIssue(false); }
    } else if (action === 'close' || action === 'reopen') {
      const issueAttrs = editor.getAttributes('link');
      const issueNumber = issueAttrs['data-issue-number'];
      if (!issueNumber) return;
      const newState = action === 'close' ? 'closed' : 'open';
      setIsUpdatingStatus(true);
      try {
        const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/github-issues`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number: parseInt(issueNumber), state: newState }),
        });
        const data = await response.json();
        if (!response.ok || data.status !== "success") throw new Error(data.message || `Failed to ${action} issue`);
        toast.success(`Issue #${issueNumber} ${newState === 'closed' ? 'closed' : 'reopened'}`);
        editor.chain().focus().extendMarkRange('link').updateAttributes('link', { 'data-issue-state': newState }).run();
        syncIssueStatuses();
      } catch (err: any) {
        toast.error(err.message);
      } finally { setIsUpdatingStatus(false); }
    }
  };

  const renderedBubbleMenu = useMemo(() => {
    if (!editor) return null;
    const issueAttrs = editor.getAttributes('link');
    const isIssue = editor.isActive('link') && !!issueAttrs['data-issue-number'];

    return (
      <BubbleMenu editor={editor} tippyOptions={{ duration: 25, animation: "scale", maxWidth: "450px" }}>
        <div className="flex flex-col rounded-xl bg-popover border border-border/50 shadow-2xl backdrop-blur-md overflow-hidden" ref={bubbleMenuRef}>
          <div className="p-1.5 flex gap-x-1 items-center bg-muted/30 border-b border-border/40">
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
          <div className="p-3 bg-background flex flex-col gap-2">
            {isIssue ? (
              <div className="flex items-center justify-between gap-3 bg-muted/20 p-2 rounded-lg border border-border/30">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Linked Issue</span>
                  <span className="text-xs font-semibold truncate max-w-[240px]">#{issueAttrs['data-issue-number']} {issueAttrs['data-issue-title']}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="xxs" className="h-7 text-[10px] px-2" onClick={() => window.open(issueAttrs.href, '_blank')}>View</Button>
                  {issueAttrs['data-issue-state'] === 'closed' ? (
                    <Button variant="outline" size="xxs" className="h-7 text-[10px] px-2 bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white" disabled={isUpdatingStatus} onClick={() => handleIssueAction('reopen')}>{isUpdatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reopen'}</Button>
                  ) : (
                    <Button variant="destructive" size="xxs" className="h-7 text-[10px] px-2 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white" disabled={isUpdatingStatus} onClick={() => handleIssueAction('close')}>{isUpdatingStatus ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Close'}</Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative flex flex-col gap-1.5">
                <div className="relative grid w-full">
                  <div className="col-start-1 row-start-1 whitespace-pre-wrap break-words min-w-0 invisible pointer-events-none min-h-[80px] max-h-[160px] pr-8 text-sm px-3 py-2 border border-transparent rounded-md font-sans">
                    {inlinePrompt + " "}
                  </div>
                  <Textarea
                    placeholder="Enter issue description..."
                    className="col-start-1 row-start-1 h-full min-h-[80px] max-h-[160px] pr-8 text-sm bg-muted/5 border-border/40 focus-visible:ring-1 focus-visible:ring-primary/20 resize-none transition-all rounded-md overflow-hidden"
                    value={inlinePrompt}
                    onChange={(e) => setInlinePrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (inlinePrompt) handleIssueAction('create', undefined, inlinePrompt).then(() => setInlinePrompt("")); } }}
                  />
                  {inlinePrompt && (
                    <button
                      onClick={() => setInlinePrompt("")}
                      className="absolute right-2 top-2 p-1 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground transition-colors z-10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-center px-0.5">
                  <span className="text-[10px] text-muted-foreground/50 font-medium italic">⌘+Enter to create</span>
                  <Button
                    size="xxs"
                    className="h-7 px-3 gap-1.5"
                    disabled={isCreatingIssue}
                    onClick={() => handleIssueAction('create', undefined, inlinePrompt).then(() => setInlinePrompt(""))}
                  >
                    {isCreatingIssue ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    <span>Create Issue</span>
                  </Button>
                </div>
              </div>
            )}
            {isIssue && (
              <div className="flex items-center justify-between px-1">
                <p className="text-[9px] text-muted-foreground/60 italic font-medium">Text selection & context auto-attached</p>
              </div>
            )}
          </div>
        </div>
      </BubbleMenu>
    );
  }, [editor, inlinePrompt, linkUrl, isCreatingIssue, isUpdatingStatus, selectionTick]);

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