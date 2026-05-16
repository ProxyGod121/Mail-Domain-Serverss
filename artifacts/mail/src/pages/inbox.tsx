import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { AppLayout } from "@/components/layout";
import {
  useGetMe,
  useListEmails,
  useUpdateEmail,
  useDeleteEmail,
  getListEmailsQueryKey,
  getGetEmailStatsQueryKey,
  getGetMeQueryKey,
  type Email,
  type ListEmailsFolder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import {
  Star,
  Trash2,
  Mail,
  MailOpen,
  Reply,
  Clock,
  Loader2,
  Inbox as InboxIcon,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useDebounce } from "@/hooks/use-debounce";

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

export default function InboxPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isCheckingAuth } = useGetMe({
    query: { retry: false, queryKey: getGetMeQueryKey() },
  });

  const folder =
    (new URLSearchParams(search).get("folder") as ListEmailsFolder) || "inbox";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  // Clear selection when folder changes
  useEffect(() => {
    setSelectedEmailId(null);
    setSearchQuery("");
  }, [folder]);

  useEffect(() => {
    if (!user && !isCheckingAuth) {
      setLocation("/login");
    }
  }, [user, isCheckingAuth, setLocation]);

  const { data: listResponse, isLoading: isLoadingEmails } = useListEmails(
    { folder, search: debouncedSearch || undefined, limit: 50 },
    {
      query: {
        enabled: !!user,
        queryKey: getListEmailsQueryKey({
          folder,
          search: debouncedSearch || undefined,
          limit: 50,
        }),
        refetchInterval: 15_000,
      },
    }
  );

  const updateEmail = useUpdateEmail();
  const deleteEmail = useDeleteEmail();

  const handleEmailSelect = (email: Email) => {
    setSelectedEmailId(email.id);
    if (!email.isRead && folder === "inbox") {
      updateEmail.mutate(
        { id: email.id, data: { isRead: true } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListEmailsQueryKey(),
            });
            queryClient.invalidateQueries({
              queryKey: getGetEmailStatsQueryKey(),
            });
          },
        }
      );
    }
  };

  const handleToggleStar = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    updateEmail.mutate(
      { id: email.id, data: { isStarred: !email.isStarred } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetEmailStatsQueryKey(),
          });
        },
      }
    );
  };

  const handleToggleRead = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    updateEmail.mutate(
      { id: email.id, data: { isRead: !email.isRead } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetEmailStatsQueryKey(),
          });
        },
      }
    );
  };

  const handleMoveToTrash = (e: React.MouseEvent, email: Email) => {
    e.stopPropagation();
    if (folder === "trash") {
      deleteEmail.mutate(
        { id: email.id },
        {
          onSuccess: () => {
            if (selectedEmailId === email.id) setSelectedEmailId(null);
            queryClient.invalidateQueries({
              queryKey: getListEmailsQueryKey(),
            });
            queryClient.invalidateQueries({
              queryKey: getGetEmailStatsQueryKey(),
            });
          },
        }
      );
    } else {
      updateEmail.mutate(
        { id: email.id, data: { folder: "trash" } },
        {
          onSuccess: () => {
            if (selectedEmailId === email.id) setSelectedEmailId(null);
            queryClient.invalidateQueries({
              queryKey: getListEmailsQueryKey(),
            });
            queryClient.invalidateQueries({
              queryKey: getGetEmailStatsQueryKey(),
            });
          },
        }
      );
    }
  };

  if (!user || isCheckingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedEmail =
    listResponse?.emails.find((e) => e.id === selectedEmailId) ?? null;

  const handleEmptyTrash = () => {
    const trashEmails = listResponse?.emails ?? [];
    Promise.all(
      trashEmails.map((email) =>
        deleteEmail.mutateAsync({ id: email.id })
      )
    ).then(() => {
      setSelectedEmailId(null);
      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
    });
  };

  const folderLabel: Record<string, string> = {
    inbox: "Inbox",
    starred: "Starred",
    sent: "Sent",
    drafts: "Drafts",
    trash: "Trash",
  };

  return (
    <AppLayout>
      <div className="flex h-full w-full">
        {/* Email List Panel */}
        <div
          className={cn(
            "flex flex-col border-r bg-background",
            selectedEmail
              ? "hidden md:flex w-full md:w-2/5 lg:w-[400px]"
              : "w-full"
          )}
        >
          <div className="flex h-14 items-center px-4 border-b gap-3">
            <span className="font-semibold text-sm text-foreground shrink-0">
              {folderLabel[folder] ?? "Inbox"}
            </span>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:bg-background h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {folder === "trash" && (listResponse?.emails.length ?? 0) > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                onClick={handleEmptyTrash}
                disabled={deleteEmail.isPending}
              >
                {deleteEmail.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                )}
                Empty Trash
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isLoadingEmails ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : listResponse?.emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <InboxIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">
                  Nothing here
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {folder === "inbox"
                    ? "You're all caught up."
                    : `No emails in ${folder}.`}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {listResponse?.emails.map((email) => {
                  const isSelected = selectedEmailId === email.id;
                  const isUnread = !email.isRead && folder === "inbox";
                  const isExternal = email.fromUserId === null && folder === "inbox";
                  const bodyPreview = isHtml(email.body)
                    ? stripHtml(email.body)
                    : email.body;

                  return (
                    <button
                      key={email.id}
                      onClick={() => handleEmailSelect(email)}
                      className={cn(
                        "group flex w-full flex-col items-start gap-1.5 p-4 text-left transition-all hover:bg-muted/50 focus:outline-none",
                        isSelected && "bg-muted/80",
                        isUnread && "bg-primary/5"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span
                            className={cn(
                              "truncate text-sm",
                              isUnread
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground"
                            )}
                          >
                            {folder === "sent"
                              ? `To: ${email.toName || email.toEmail}`
                              : email.fromName || email.fromEmail}
                          </span>
                          {isExternal && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => handleToggleStar(e, email)}
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                email.isStarred &&
                                  "fill-yellow-400 text-yellow-400"
                              )}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={(e) => handleMoveToTrash(e, email)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(email.createdAt), "MMM d")}
                          </span>
                        </div>
                      </div>

                      <div className="w-full overflow-hidden pl-4">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            isUnread
                              ? "font-medium text-foreground"
                              : "text-foreground/80"
                          )}
                        >
                          {email.subject || "(No subject)"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground mt-0.5">
                          {bodyPreview}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Email Detail Panel */}
        <div
          className={cn(
            "flex-1 flex-col bg-background h-full",
            !selectedEmail
              ? "hidden md:flex items-center justify-center bg-muted/10"
              : "flex"
          )}
        >
          {!selectedEmail ? (
            <div className="flex flex-col items-center justify-center text-center max-w-sm px-6">
              <div className="rounded-full bg-muted p-6 mb-6">
                <Mail className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h2 className="text-xl font-medium text-foreground">
                Select an item to read
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Click on an email in the list to view its contents here.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center justify-between px-4 border-b bg-background z-10">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden mr-2"
                    onClick={() => setSelectedEmailId(null)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleToggleStar(e, selectedEmail)}
                    title="Star"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        selectedEmail.isStarred &&
                          "fill-yellow-400 text-yellow-400"
                      )}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleToggleRead(e, selectedEmail)}
                    title={selectedEmail.isRead ? "Mark unread" : "Mark read"}
                  >
                    {selectedEmail.isRead ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MailOpen className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleMoveToTrash(e, selectedEmail)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLocation(`/compose?replyTo=${selectedEmail.id}`)
                  }
                >
                  <Reply className="mr-2 h-4 w-4" />
                  Reply
                </Button>
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-2xl font-bold text-foreground mb-6">
                    {selectedEmail.subject || "(No subject)"}
                  </h1>

                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {(
                            selectedEmail.fromName || selectedEmail.fromEmail
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {selectedEmail.fromName || selectedEmail.fromEmail}
                          </span>
                          {selectedEmail.fromUserId === null && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              external
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {selectedEmail.fromEmail}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          to{" "}
                          {selectedEmail.toEmail === user.email
                            ? "me"
                            : selectedEmail.toEmail}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground shrink-0">
                      <Clock className="mr-1 h-3 w-3" />
                      {format(
                        new Date(selectedEmail.createdAt),
                        "MMM d, yyyy, h:mm a"
                      )}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="text-sm leading-relaxed text-foreground">
                    {isHtml(selectedEmail.body) ? (
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: selectedEmail.body
                            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                            .replace(/javascript:/gi, ""),
                        }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{selectedEmail.body}</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
