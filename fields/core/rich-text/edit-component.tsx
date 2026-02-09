"use client";

import { forwardRef, useCallback, useRef, useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
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
  DropdownMenuSeparator,
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
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Bug
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

  const mediaDialogRef = mediaConfig
    ? useRef<MediaDialogHandle>(null)
    : undefined;

  const bubbleMenuRef = useRef<HTMLDivElement | null>(null);

  const [isContentReady, setContentReady] = useState(false);

  const [linkUrl, setLinkUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [isClosingIssue, setIsClosingIssue] = useState(false);
  const [existingIssueAttrs, setExistingIssueAttrs] = useState<any>(null);

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
      StarterKit.configure({
        dropcursor: { width: 2 }
      }),
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
            },
            'data-issue-state': {
              default: 'open',
              parseHTML: element => element.getAttribute('data-issue-state'),
            },
            'data-issue-title': {
              default: null,
              parseHTML: element => element.getAttribute('data-issue-title'),
            },
            class: {
              default: null,
              parseHTML: element => element.getAttribute('class'),
            },
          };
        },
        renderHTML({ HTMLAttributes }) {
          const isIssue = !!HTMLAttributes['data-issue-number'];
          const { class: className, ...rest } = HTMLAttributes;
          const mergedClass = isIssue
            ? Array.from(new Set([...(className?.split(' ') || []), 'gh-issue-link'])).filter(Boolean).join(' ')
            : className;

          return ['a', { ...rest, class: mergedClass }, 0];
        },
      }).configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: null,
          target: null,
          // Removed global class: 'gh-issue-link'
        }
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands…",
      }),
      Commands.configure({
        suggestion: suggestion(openMediaDialog)
      }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline
    ],
    content: "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onCreate: async ({ editor }) => {
      if (config && value) {
        try {
          const initialContent = mediaConfig
            ? await relativeToRawUrls(config.owner, config.repo, config.branch, mediaConfig.name, value, isPrivate)
            : value;
          editor.commands.setContent(initialContent || "<p></p>");
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.warn(errorMessage);
          toast.error(`${errorMessage} Check if the image exists or if media configuration is correct.`);
          editor.commands.setContent(value);
        }
      }
      setContentReady(true);
    }
  });

  const syncIssueStatuses = useCallback(async () => {
    if (!editor || !config) return;

    const issueNumbers: string[] = [];
    editor.state.doc.descendants((node) => {
      node.marks.forEach(mark => {
        if (mark.type.name === 'link' && mark.attrs['data-issue-number']) {
          const num = mark.attrs['data-issue-number'];
          if (!issueNumbers.includes(num)) {
            issueNumbers.push(num);
          }
        }
      });
    });

    if (issueNumbers.length === 0) return;

    try {
      const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/github-issues?numbers=${issueNumbers.join(',')}`);
      const data = await response.json();

      if (data.status === 'success' && Array.isArray(data.data)) {
        data.data.forEach((issue: any) => {
          editor.commands.command(({ tr }) => {
            let modified = false;
            tr.doc.descendants((node, pos) => {
              const linkMark = node.marks.find(m => m.type.name === 'link');
              if (linkMark && linkMark.attrs['data-issue-number'] === issue.number.toString()) {
                const newState = issue.state;
                const currentAttrs = linkMark.attrs;

                if (currentAttrs['data-issue-state'] !== newState || currentAttrs['class'] !== 'gh-issue-link') {
                  tr.addMark(pos, pos + node.nodeSize, editor.schema.marks.link.create({
                    ...currentAttrs,
                    'data-issue-state': newState,
                    class: 'gh-issue-link'
                  }));
                  modified = true;
                }
              }
            });
            return modified;
          });
        });
      }
    } catch (error) {
      console.error("Failed to sync issues:", error);
    }
  }, [editor, config]);

  useEffect(() => {
    if (isContentReady) {
      syncIssueStatuses();
    }

    const handleFocus = () => {
      syncIssueStatuses();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isContentReady, syncIssueStatuses]);

  const handleMediaDialogSubmit = useCallback(async (images: string[]) => {
    if (!mediaConfig) return;

    if (config && editor) {
      const content = await Promise.all(images.map(async (image) => {
        try {
          // Use unencoded path for API call, but encode for the final URL
          const url = await getRawUrl(config.owner, config.repo, config.branch, mediaConfig?.name, image, isPrivate);
          if (url) {
            // Replace the unencoded path with encoded path in the URL
            const encodedImage = image.split('/').map(encodeURIComponent).join('/');
            const encodedUrl = url.replace(image, encodedImage);
            return `<p><img src="${encodedUrl}"></p>`;
          }
          // return `<p><img src="${url}"></p>`;
          return `<p><img src="" alt="${image}" class="border border-destructive bg-destructive/10 rounded-md" /></p>`;
        } catch {
          toast.error(`Failed to load image: ${image}`);
          // Return a placeholder with error styling
          return `<p><img src="" alt="${image}" class="border border-destructive bg-destructive/10 rounded-md" /></p>`;
        }
      }));
      editor.chain().focus().insertContent(content.join('\n')).run();
    }
  }, [config, editor, isPrivate, mediaConfig?.name]);

  const getBlockIcon = (editor: any) => {
    if (editor.isActive("heading", { level: 1 })) return <Heading1 className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 2 })) return <Heading2 className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 3 })) return <Heading3 className="h-4 w-4" />;
    if (editor.isActive("bulletList")) return <List className="h-4 w-4" />;
    if (editor.isActive("orderedList")) return <ListOrdered className="h-4 w-4" />;
    if (editor.isActive("codeBlock")) return <Code className="h-4 w-4" />;
    if (editor.isActive("blockquote")) return <Quote className="h-4 w-4" />;
    return <Pilcrow className="h-4 w-4" />;
  };

  const getAlignIcon = (editor: any) => {
    if (editor.isActive({ textAlign: "center" })) return <AlignCenter className="h-4 w-4" />;
    if (editor.isActive({ textAlign: "right" })) return <AlignRight className="h-4 w-4" />;
    if (editor.isActive({ textAlign: "justify" })) return <AlignJustify className="h-4 w-4" />;
    return <AlignLeft className="h-4 w-4" />;
  };

  const handleCreateIssue = async () => {
    if (!editor || !config || !issueTitle) return;

    // If it's an existing issue and the title is the only thing we might be changing on the link
    if (existingIssueAttrs) {
      editor.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({
          ...existingIssueAttrs,
          'data-issue-title': issueTitle,
          class: 'gh-issue-link'
        } as any)
        .run();

      setIsIssueDialogOpen(false);
      setExistingIssueAttrs(null);
      setIssueTitle("");

      // Also trigger a sync to make sure state is correct
      syncIssueStatuses();
      return;
    }

    const selection = editor.state.selection;
    const text = editor.state.doc.textBetween(selection.from, selection.to, "\n");

    // Double check for existing open issues in selection to prevent duplicates
    let hasOpenIssue = false;
    editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
      if (node.marks.some(m => m.type.name === 'link' && m.attrs['data-issue-state'] === 'open')) {
        hasOpenIssue = true;
      }
    });

    if (hasOpenIssue && !existingIssueAttrs) {
      toast.error("This selection already contains an open issue.");
      return;
    }

    const body = text;

    const pagePath = params.path ? decodeURIComponent(params.path as string) : '';
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    const fullBody = `${body}\n\n---\n**Context:**\n- **File:** \`${pagePath}\`\n- **Editor:** [Link](${pageUrl})`;

    setIsCreatingIssue(true);
    try {
      const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/github-issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: issueTitle,
          body: fullBody,
          labels: [],
        }),
      });

      if (!response.ok) throw new Error(`Failed to create issue: ${response.status}`);
      const data = await response.json();
      if (data.status !== "success") throw new Error(data.message);

      toast.success(data.message || "Issue created successfully");

      const issue = data.data;
      if (issue && issue.html_url) {
        editor.chain()
          .focus()
          .extendMarkRange('link')
          .setLink({
            href: issue.html_url,
            'data-issue-number': issue.number.toString(),
            'data-issue-state': 'open',
            'data-issue-title': issue.title,
            class: 'gh-issue-link'
          } as any)
          .run();
      }

      setIsIssueDialogOpen(false);
      setIssueTitle("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsCreatingIssue(false);
    }
  };

  const handleCloseIssue = async () => {
    if (!editor || !existingIssueAttrs || !config) return;

    // 1. Optimistically update the editor UI immediately
    editor.chain()
      .focus()
      .extendMarkRange('link')
      .updateAttributes('link', { 'data-issue-state': 'closed' })
      .run();

    // 2. Update local state so UI reflects "Closed" immediately
    setExistingIssueAttrs((prev: any) => prev ? { ...prev, 'data-issue-state': 'closed' } : null);

    setIsClosingIssue(true);
    try {
      const response = await fetch(`/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/github-issues`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: parseInt(existingIssueAttrs['data-issue-number']),
          state: 'closed'
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        // Permission error (Issues: Write)
        console.error("GitHub sync failed:", data.message);
        toast.error(`Sync Failed: ${data.message}. The link is closed locally, but to sync with GitHub you must enable "Issues: Write" in your GitHub App Permissions.`);

        // We stay in the "Closed" local state, but close the dialog after a short delay
        setTimeout(() => {
          setIsIssueDialogOpen(false);
          setExistingIssueAttrs(null);
          setIssueTitle("");
        }, 1500);
      } else {
        toast.success("Issue closed on GitHub and link updated");
        setIsIssueDialogOpen(false);
        setExistingIssueAttrs(null);
        setIssueTitle("");
        syncIssueStatuses(); // Only sync with GitHub on success
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsClosingIssue(false);
    }
  };


  return (
    <>
      <Skeleton className={cn("rounded-md h-[8.5rem]", isContentReady ? "hidden" : "")} />
      <div className={!isContentReady ? "hidden" : ""}>
        {editor && <BubbleMenu editor={editor} tippyOptions={{ duration: 25, animation: "scale", maxWidth: "370px" }}>
          <div className="p-1 rounded-md bg-popover border flex gap-x-[1px] items-center focus-visible:outline-none shadow-md" ref={bubbleMenuRef}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xxs"
                  className="gap-x-1"
                >
                  {getBlockIcon(editor)}
                  <ChevronsUpDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" portalProps={{ container: bubbleMenuRef.current }}>
                <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className="gap-x-1.5">
                  <Pilcrow className="h-4 w-4" />
                  Text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 1 }).run()} className="gap-x-1.5">
                  <Heading1 className="h-4 w-4" />
                  Heading 1
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 2 }).run()} className="gap-x-1.5">
                  <Heading2 className="h-4 w-4" />
                  Heading 2
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 3 }).run()} className="gap-x-1.5">
                  <Heading3 className="h-4 w-4" />
                  Heading 3
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()} className="gap-x-1.5">
                  <List className="h-4 w-4" />
                  Bulleted list
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()} className="gap-x-1.5">
                  <ListOrdered className="h-4 w-4" />
                  Numbered list
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().toggleBlockquote().run()} className="gap-x-1.5">
                  <Quote className="h-4 w-4" />
                  Quote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()} className="gap-x-1.5">
                  <Code className="h-4 w-4" />
                  Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xxs"
                  className={cn("shrink-0", editor.isActive("link") ? "bg-muted" : "")}
                  onClick={() => setLinkUrl(editor.isActive("link") ? editor.getAttributes('link').href : "")}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-1">
                <div className="flex gap-x-1 items-center">
                  <Input
                    className="h-8 flex-1"
                    placeholder="e.g. http://pagescms.org"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xxs"
                    className="shrink-0"
                    onClick={() => linkUrl
                      ? editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
                      : editor.chain().focus().extendMarkRange('link').unsetLink()
                        .run()
                    }
                  >Link</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xxs"
                    className="shrink-0"
                    onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink()
                      .run()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            {(editor.isActive("paragraph") || editor.isActive("heading")) &&
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xxs"
                    className="gap-x-1"
                  >
                    {getAlignIcon(editor)}
                    <ChevronsUpDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent portalProps={{ container: bubbleMenuRef.current }}>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("left").run()} className="gap-x-1.5">
                    <AlignLeft className="h-4 w-4" />
                    Align left
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("right").run()} className="gap-x-1.5">
                    <AlignRight className="h-4 w-4" />
                    Align right
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("center").run()} className="gap-x-1.5">
                    <AlignCenter className="h-4 w-4" />
                    Center
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("justify").run()} className="gap-x-1.5">
                    <AlignJustify className="h-4 w-4" />
                    Justify
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={cn("shrink-0", editor.isActive("bold") ? "bg-muted" : "")}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={cn("shrink-0", editor.isActive("italic") ? "bg-muted" : "")}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={cn("shrink-0", editor.isActive("strike") ? "bg-muted" : "")}
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={cn("shrink-0", editor.isActive("underline") ? "bg-muted" : "")}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={cn("shrink-0", editor.isActive("code") ? "bg-muted" : "")}
            >
              <Code className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => {
                const selection = editor.state.selection;
                const text = editor.state.doc.textBetween(selection.from, selection.to, "\n");
                if (!text) {
                  toast.error("Please select some text first");
                  return;
                }

                // Detect existing issue in selection
                let existingIssue: any = null;
                editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
                  const mark = node.marks.find(m => m.type.name === 'link' && m.attrs['data-issue-number']);
                  if (mark) {
                    existingIssue = mark.attrs;
                  }
                });

                if (existingIssue) {
                  setExistingIssueAttrs(existingIssue);
                  setIssueTitle(existingIssue['data-issue-title'] || "");
                } else {
                  setExistingIssueAttrs(null);
                  setIssueTitle("");
                }

                setIsIssueDialogOpen(true);
              }}
              className={cn("shrink-0", (editor.isActive('link') && editor.getAttributes('link')['data-issue-state'] === 'open') ? "text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20" : "")}
              title="Create GitHub Issue"
            >
              <Bug className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xxs"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              className={cn("shrink-0", editor.isActive("code") ? "bg-muted" : "")}
            >
              <RemoveFormatting className="h-4 w-4" />
            </Button>
            {editor.isActive("table") &&
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xxs"
                    className="gap-x-1"
                  >
                    <TableIcon className="h-4 w-4" />
                    <ChevronsUpDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" portalProps={{ container: bubbleMenuRef.current }}>
                  <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>Add a column</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>Add a row</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                    <span className="text-red-500">Delete column</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                    <span className="text-red-500">Delete row</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            {mediaConfig && editor.isActive("image") &&
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xxs"
                    className="shrink-0 text-[0.6rem]"
                    onClick={() => setImageAlt(editor.getAttributes('image').alt || "")}
                  >
                    ALT
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1">
                  <div className="flex gap-x-1 items-center">
                    <Input
                      className="h-8 flex-1"
                      placeholder="Image description"
                      value={imageAlt}
                      onChange={e => setImageAlt(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="xxs"
                      className="shrink-0"
                      onClick={() => {
                        editor.chain().focus().updateAttributes('image', { alt: imageAlt }).run();
                      }}
                    >Set</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xxs"
                      className="shrink-0"
                      onClick={() => {
                        editor.chain().focus().updateAttributes('image', { alt: "" }).run();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            }
          </div>
        </BubbleMenu>}
        <EditorContent editor={editor} />
        {mediaConfig && <MediaDialog
          ref={mediaDialogRef}
          media={mediaConfig?.name}
          initialPath={rootPath}
          extensions={allowedExtensions}
          selected={[]}
          onSubmit={handleMediaDialogSubmit}
        />}
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{existingIssueAttrs ? `Update Issue Link (#${existingIssueAttrs['data-issue-number']})` : 'Create GitHub Issue'}</DialogTitle>
              <DialogDescription>
                {existingIssueAttrs
                  ? "Update the display title or sync status for this issue link."
                  : "Create a new issue using the selected text as the description."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {existingIssueAttrs && (
                <div className={cn(
                  "flex items-center gap-x-2 p-3 rounded-md border text-sm",
                  existingIssueAttrs['data-issue-state'] === 'open'
                    ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
                    : "bg-muted border-muted text-muted-foreground"
                )}>
                  <Bug className="h-4 w-4" />
                  <span className="font-medium">
                    Status: {existingIssueAttrs['data-issue-state'] === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="issue-title">Title</Label>
                <Input
                  id="issue-title"
                  placeholder="Issue title"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateIssue();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <div className="flex-1">
                {existingIssueAttrs && existingIssueAttrs['data-issue-state'] === 'open' && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCloseIssue}
                    disabled={isClosingIssue}
                    className="w-full sm:w-auto"
                  >
                    {isClosingIssue ? "Closing..." : "Close Issue"}
                  </Button>
                )}
              </div>
              <div className="flex gap-x-2">
                <Button type="button" variant="outline" onClick={() => setIsIssueDialogOpen(false)}>Cancel</Button>
                <Button type="button" onClick={handleCreateIssue} disabled={!issueTitle || isCreatingIssue}>
                  {isCreatingIssue ? "Creating..." : (existingIssueAttrs ? "Update Link" : "Create Issue")}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
});

export { EditComponent };