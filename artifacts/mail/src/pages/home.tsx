import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useRegister, 
  useCheckUsername, 
  useGetMe,
  getGetMeQueryKey,
  getCheckUsernameQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1, "Display name is required"),
});

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: isCheckingAuth } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (user && !isCheckingAuth) {
      setLocation("/inbox");
    }
  }, [user, isCheckingAuth, setLocation]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      displayName: "",
    },
  });

  const usernameValue = form.watch("username");
  const debouncedUsername = useDebounce(usernameValue, 300);

  const { data: usernameStatus, isFetching: isCheckingUsername } = useCheckUsername(
    { username: debouncedUsername },
    {
      query: {
        enabled: debouncedUsername.length >= 3,
        retry: false,
        queryKey: getCheckUsernameQueryKey({ username: debouncedUsername }),
      }
    }
  );

  const register = useRegister();

  function onSubmit(values: z.infer<typeof formSchema>) {
    register.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
            title: "Account created",
            description: "Welcome to MasonPowers Mail.",
          });
          setLocation("/inbox");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Error creating account",
            description: (error as any)?.error || "Please try again.",
          });
        },
      }
    );
  }

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col lg:flex-row bg-background">
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create your <br />
              <span className="text-primary">@masonpowers.co</span> email.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A sleek, modern webmail client. Fast, clean, and confident.
            </p>
          </div>

          <div className="mt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input 
                            placeholder="johndoe" 
                            className="pr-20"
                            {...field} 
                          />
                        </FormControl>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          {isCheckingUsername && debouncedUsername === field.value && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          {!isCheckingUsername && usernameStatus && debouncedUsername === field.value && (
                            usernameStatus.available ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )
                          )}
                        </div>
                      </div>
                      <FormDescription>
                        Your address will be {field.value ? field.value : "username"}@masonpowers.co
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={register.isPending || (usernameStatus && !usernameStatus.available && debouncedUsername === form.watch("username"))}
                  >
                    {register.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Account
                  </Button>
                </div>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <div className="relative hidden w-full lg:block lg:w-1/2 bg-sidebar p-12">
        <div className="flex h-full flex-col justify-center items-center">
          <div className="rounded-xl bg-card border shadow-2xl overflow-hidden w-full max-w-2xl aspect-[4/3] flex flex-col relative">
            <div className="h-12 border-b bg-muted/50 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="flex-1 flex">
              <div className="w-48 border-r bg-muted/20 p-4 space-y-4">
                <div className="h-6 w-24 bg-muted rounded"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-primary/10 rounded"></div>
                  <div className="h-8 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </div>
              </div>
              <div className="flex-1 p-6 space-y-4">
                <div className="h-8 w-64 bg-muted rounded"></div>
                <div className="space-y-2">
                  <div className="h-20 bg-muted/30 rounded border p-4"></div>
                  <div className="h-20 bg-muted/30 rounded border p-4"></div>
                  <div className="h-20 bg-muted/30 rounded border p-4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
