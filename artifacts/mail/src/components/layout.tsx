import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Inbox, 
  SendHorizontal, 
  FileEdit, 
  Trash2, 
  Star,
  LogOut,
  PenSquare
} from "lucide-react";
import { useGetMe, useGetEmailStats, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { retry: false } });
  const { data: stats } = useGetEmailStats({ query: { enabled: !!user } });
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/login");
      }
    });
  };

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const navItems = [
    { name: "Inbox", icon: Inbox, folder: "inbox", count: stats?.inbox },
    { name: "Starred", icon: Star, folder: "starred", count: stats?.starred },
    { name: "Sent", icon: SendHorizontal, folder: "sent", count: stats?.sent },
    { name: "Drafts", icon: FileEdit, folder: "drafts", count: stats?.drafts },
    { name: "Trash", icon: Trash2, folder: "trash", count: stats?.trash },
  ];

  // Parse folder from URL
  const currentFolder = new URLSearchParams(window.location.search).get("folder") || "inbox";
  const isCompose = location === "/compose";

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-14 items-center px-4 border-b border-sidebar-border/50">
          <span className="font-semibold text-lg tracking-tight truncate">
            masonpowers.co
          </span>
        </div>

        <div className="p-4">
          <Button 
            className="w-full justify-start shadow-sm" 
            size="lg"
            asChild
          >
            <Link href="/compose">
              <PenSquare className="mr-2 h-4 w-4" />
              Compose
            </Link>
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = !isCompose && currentFolder === item.folder;
            return (
              <Link 
                key={item.folder} 
                href={`/inbox?folder=${item.folder}`}
                className={cn(
                  "flex items-center justify-between px-3 py-2 text-sm rounded-md group transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <div className="flex items-center">
                  <item.icon className={cn(
                    "mr-3 h-4 w-4",
                    isActive ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground"
                  )} />
                  {item.name}
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    item.folder === "inbox" && isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-sidebar-accent/50 text-sidebar-foreground/70"
                  )}>
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-sidebar-accent/50">
                <Avatar className="h-8 w-8 border border-sidebar-border bg-sidebar-accent">
                  <AvatarFallback className="bg-transparent text-sidebar-foreground">
                    {getInitials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium text-sidebar-foreground">
                    {user.displayName}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {user.email}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
