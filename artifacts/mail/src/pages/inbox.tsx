import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { 
  useGetMe, 
  useListEmails, 
  useUpdateEmail, 
  useDeleteEmail,
  getListEmailsQueryKey,
  getGetEmailStatsQueryKey,
  type Email,
  type ListEmailsFolder
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
  MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useDebounce } from "@/hooks/use-debounce";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function InboxPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isCheckingAuth } = useGetMe({ query: { retry: false } });
  
  const searchParams = new URLSearchParams(window.location.search);
  const folder = (searchParams.get("folder") as ListEmailsFolder) || "inbox";
  
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  useEffect(() => {
    if (!user && !isCheckingAuth) {
      setLocation("/login");
    }
  }, [user, isCheckingAuth, setLocation]);

  const { data: listResponse, isLoading: isLoadingEmails } = useListEmails(
    { folder, search: debouncedSearch || undefined, limit: 50 },
    { query: { enabled: !!user } }
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
            queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
          }
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
          queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
        }
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
          queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
        }
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
            queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
          }
        }
      );
    } else {
      updateEmail.mutate(
        { id: email.id, data: { folder: "trash" } },
        {
          onSuccess: () => {
            if (selectedEmailId === email.id) setSelectedEmailId(null);
            queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
          }
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

  const selectedEmail = listResponse?.emails.find(e => e.id === selectedEmailId);

  return (
    <AppLayout>
      <div className="flex h-full w-full">
        {/* Email List Panel */}
        <div className={cn(
          "flex flex-col border-r bg-background",
          selectedEmail ? "hidden md:flex w-full md:w-2/5 lg:w-[400px]" : "w-full"
        )}>
          <div className="flex h-14 items-center px-4 border-b gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
                <h3 className="text-lg font-medium text-foreground">Nothing here</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {folder === "inbox" ? "You're all caught up." : `No emails in ${folder}.`}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {listResponse?.emails.map((email) => {
                  const isSelected = selectedEmailId === email.id;
                  const isUnread = !email.isRead && folder === "inbox";
                  
                  return (
                    <button
                      key={email.id}
                      onClick={() => handleEmailSelect(email)}
                      className={cn(
                        "flex w-full flex-col items-start gap-2 p-4 text-left transition-all hover:bg-muted/50 focus:outline-none",
                        isSelected && "bg-muted/80",
                        isUnread && "bg-primary/5"
                      )}
                    >
                      <div className="flex w-full items-start justify-between">
                        <div className="flex items-center gap-2 max-w-[80%]">
                          <span className={cn(
                            "truncate font-medium text-sm",
                            isUnread ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {folder === "sent" ? `To: ${email.toName || email.toEmail}` : email.fromName || email.fromEmail}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(email.createdAt), "MMM d")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex w-full items-start justify-between gap-4">
                        <div className="flex-1 overflow-hidden">
                          <span className={cn(
                            "block truncate text-sm mb-1",
                            isUnread ? "font-semibold text-foreground" : "text-foreground"
                          )}>
                            {email.subject || "(No subject)"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {email.body}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={(e) => handleToggleStar(e, email)}
                          >
                            <Star className={cn("h-4 w-4", email.isStarred && "fill-yellow-400 text-yellow-400")} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive"
                            onClick={(e) => handleMoveToTrash(e, email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Email Detail Panel */}
        <div className={cn(
          "flex-1 flex-col bg-background h-full",
          !selectedEmail ? "hidden md:flex items-center justify-center bg-muted/10" : "flex"
        )}>
          {!selectedEmail ? (
            <div className="flex flex-col items-center justify-center text-center max-w-sm px-6">
              <div className="rounded-full bg-muted p-6 mb-6">
                <Mail className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h2 className="text-xl font-medium text-foreground">Select an item to read</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Click on an email in the list to view its contents here.
              </p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex h-14 items-center justify-between px-4 border-b bg-background z-10">
                <div className="flex items-center gap-2">
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
                  >
                    <Star className={cn("h-4 w-4", selectedEmail.isStarred && "fill-yellow-400 text-yellow-400")} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => handleToggleRead(e, selectedEmail)}
                  >
                    {selectedEmail.isRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => handleMoveToTrash(e, selectedEmail)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="hidden sm:flex"
                    onClick={() => setLocation(`/compose?replyTo=${selectedEmail.id}`)}
                  >
                    <Reply className="mr-2 h-4 w-4" />
                    Reply
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="sm:hidden"
                    onClick={() => setLocation(`/compose?replyTo=${selectedEmail.id}`)}
                  >
                    <Reply className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl mx-auto">
                  <h1 className="text-2xl font-bold text-foreground mb-8">
                    {selectedEmail.subject || "(No subject)"}
                  </h1>

                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 border">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(selectedEmail.fromName || selectedEmail.fromEmail).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {selectedEmail.fromName || selectedEmail.fromEmail}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          to {selectedEmail.toEmail === user.email ? "me" : selectedEmail.toEmail}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      {format(new Date(selectedEmail.createdAt), "MMM d, yyyy, h:mm a")}
                    </div>
                  </div>

                  <Separator className="my-6" />

                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">{selectedEmail.body}</p>
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
