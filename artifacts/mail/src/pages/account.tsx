import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTheme } from "next-themes";
import { AppLayout } from "@/components/layout";
import {
  useGetMe,
  useUpdateProfile,
  useChangePassword,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccent, ACCENT_COLORS, type AccentColor } from "@/hooks/use-accent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Lock,
  Palette,
  Sun,
  Moon,
  Monitor,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useAccent();

  const { data: user, isLoading } = useGetMe({
    query: { retry: false, queryKey: getGetMeQueryKey() },
  });

  useEffect(() => {
    if (!user && !isLoading) setLocation("/login");
  }, [user, isLoading, setLocation]);

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { displayName: user?.displayName ?? "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSaveProfile = (values: z.infer<typeof profileSchema>) => {
    updateProfile.mutate(
      { data: { displayName: values.displayName } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          toast({ title: "Profile updated" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: err?.error ?? "Failed to update profile" });
        },
      }
    );
  };

  const onChangePassword = (values: z.infer<typeof passwordSchema>) => {
    changePassword.mutate(
      { data: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
      {
        onSuccess: () => {
          passwordForm.reset();
          toast({ title: "Password changed successfully" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: err?.error ?? "Failed to change password" });
        },
      }
    );
  };

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-auto">
        <div className="flex h-14 items-center px-6 border-b bg-background shrink-0">
          <h1 className="font-semibold text-base text-foreground">Account Settings</h1>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto py-8 px-6 space-y-10">

            {/* Profile Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Profile</h2>
              </div>
              <div className="rounded-lg border bg-card p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Email address</p>
                    <p className="font-medium text-foreground">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Username</p>
                    <p className="font-medium text-foreground">@{user.username}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Member since</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(user.createdAt), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <Separator />

                <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      {...profileForm.register("displayName")}
                      placeholder="Your name"
                    />
                    {profileForm.formState.errors.displayName && (
                      <p className="text-xs text-destructive">
                        {profileForm.formState.errors.displayName.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </div>
            </section>

            {/* Password Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Password</h2>
              </div>
              <div className="rounded-lg border bg-card p-6">
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("currentPassword")}
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("newPassword")}
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("confirmPassword")}
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-xs text-destructive">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={changePassword.isPending}
                  >
                    {changePassword.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Change Password
                  </Button>
                </form>
              </div>
            </section>

            {/* Appearance Section */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Appearance</h2>
              </div>
              <div className="rounded-lg border bg-card p-6 space-y-6">

                {/* Light / Dark / System */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Theme</p>
                  <div className="flex gap-2">
                    {([
                      { id: "light", label: "Light", icon: Sun },
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "system", label: "System", icon: Monitor },
                    ] as const).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setTheme(id)}
                        className={cn(
                          "flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-all",
                          theme === id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground/50"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Accent Colors */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Accent Color</p>
                  <div className="flex gap-3 flex-wrap">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setAccent(color.id as AccentColor)}
                        title={color.label}
                        className="relative h-8 w-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
                        style={{
                          backgroundColor: `hsl(${color.hsl})`,
                          focusRingColor: `hsl(${color.hsl})`,
                        }}
                      >
                        {accent === color.id && (
                          <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Currently: {ACCENT_COLORS.find((c) => c.id === accent)?.label}
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
