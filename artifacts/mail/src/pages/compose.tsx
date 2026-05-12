import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppLayout } from "@/components/layout";
import { 
  useGetMe, 
  useSendEmail, 
  useGetEmail,
  getListEmailsQueryKey,
  getGetEmailStatsQueryKey,
  getGetMeQueryKey,
  getGetEmailQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  toEmail: z.string().email("Please enter a valid email address"),
  subject: z.string(),
  body: z.string().min(1, "Message body cannot be empty"),
});

export default function ComposePage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isCheckingAuth } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  
  const searchParams = new URLSearchParams(window.location.search);
  const replyToId = searchParams.get("replyTo") ? parseInt(searchParams.get("replyTo") as string) : null;
  const draftId = searchParams.get("draft") ? parseInt(searchParams.get("draft") as string) : null;

  const { data: sourceEmail } = useGetEmail(replyToId || draftId || 0, {
    query: {
      enabled: !!replyToId || !!draftId,
      queryKey: getGetEmailQueryKey(replyToId || draftId || 0),
    }
  });

  useEffect(() => {
    if (!user && !isCheckingAuth) {
      setLocation("/login");
    }
  }, [user, isCheckingAuth, setLocation]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toEmail: "",
      subject: "",
      body: "",
    },
  });

  useEffect(() => {
    if (sourceEmail) {
      if (replyToId) {
        form.reset({
          toEmail: sourceEmail.fromEmail,
          subject: sourceEmail.subject.startsWith("Re:") ? sourceEmail.subject : `Re: ${sourceEmail.subject}`,
          body: `\n\n\n--- On ${new Date(sourceEmail.createdAt).toLocaleString()}, ${sourceEmail.fromEmail} wrote:\n> ${sourceEmail.body.split('\n').join('\n> ')}`
        });
        // Focus the body so user can start typing
        setTimeout(() => {
          const bodyEl = document.querySelector('textarea[name="body"]') as HTMLTextAreaElement;
          if (bodyEl) {
            bodyEl.focus();
            bodyEl.setSelectionRange(0, 0);
          }
        }, 50);
      } else if (draftId) {
        form.reset({
          toEmail: sourceEmail.toEmail,
          subject: sourceEmail.subject,
          body: sourceEmail.body
        });
      }
    }
  }, [sourceEmail, replyToId, draftId, form]);

  const sendEmail = useSendEmail();

  function onSubmit(values: z.infer<typeof formSchema>) {
    sendEmail.mutate(
      { 
        data: {
          ...values,
          isDraft: false,
          replyToId: replyToId
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
          toast({
            title: "Email sent",
            description: "Your message has been sent successfully.",
          });
          setLocation("/inbox?folder=sent");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to send",
            description: (error as any)?.error || "An error occurred while sending.",
          });
        },
      }
    );
  }

  function handleSaveDraft() {
    const values = form.getValues();
    if (!values.toEmail && !values.subject && !values.body) {
      setLocation("/inbox");
      return;
    }

    sendEmail.mutate(
      { 
        data: {
          toEmail: values.toEmail || "draft@local", // Placeholder for drafts without recipient
          subject: values.subject,
          body: values.body,
          isDraft: true,
          replyToId: replyToId
        } 
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey() });
          toast({
            title: "Draft saved",
          });
          setLocation("/inbox?folder=drafts");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to save draft",
            description: (error as any)?.error || "An error occurred.",
          });
        },
      }
    );
  }

  if (!user || isCheckingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-background">
        <div className="flex h-14 items-center justify-between px-4 border-b">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/inbox")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">New Message</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              onClick={handleSaveDraft}
              disabled={sendEmail.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button 
              onClick={form.handleSubmit(onSubmit)}
              disabled={sendEmail.isPending}
            >
              {sendEmail.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-3xl border rounded-lg shadow-sm bg-card overflow-hidden">
            <Form {...form}>
              <form className="flex flex-col h-full">
                <FormField
                  control={form.control}
                  name="toEmail"
                  render={({ field }) => (
                    <FormItem className="border-b px-4 py-2 space-y-0 flex items-center">
                      <div className="text-sm font-medium text-muted-foreground w-16">To:</div>
                      <FormControl>
                        <Input 
                          placeholder="recipient@example.com" 
                          className="border-0 focus-visible:ring-0 shadow-none px-0 bg-transparent flex-1" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem className="border-b px-4 py-2 space-y-0 flex items-center">
                      <div className="text-sm font-medium text-muted-foreground w-16">Subject:</div>
                      <FormControl>
                        <Input 
                          placeholder="Email subject" 
                          className="border-0 focus-visible:ring-0 shadow-none px-0 bg-transparent flex-1 font-medium" 
                          {...field} 
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="body"
                  render={({ field }) => (
                    <FormItem className="flex-1 px-4 py-4 h-full min-h-[400px]">
                      <FormControl>
                        <Textarea 
                          placeholder="Write your message here..." 
                          className="min-h-[400px] h-full resize-none border-0 focus-visible:ring-0 shadow-none p-0 bg-transparent" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
